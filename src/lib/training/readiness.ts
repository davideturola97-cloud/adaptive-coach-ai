/**
 * Controllo del mattino: sonno, fatica e dolori diventano un consiglio per la seduta di oggi.
 * Regole fisse e prudenti; non sono una valutazione medica.
 */
import type { PlannedWorkout } from "@/lib/domain/types";
import type { Disruption } from "@/lib/planning/reschedule";
import { isHard } from "@/lib/planning/engine";

export interface CheckIn {
  date: string;
  /** 1 malissimo ... 5 benissimo */
  sleep: number;
  /** 1 fresco ... 5 distrutto */
  fatigue: number;
  pain: "nessuno" | "leggero" | "forte";
  painWhere?: string;
}

export interface ReadinessAdvice {
  status: "via libera" | "attenzione" | "stop";
  text: string;
  /** Imprevisto da passare al motore di riprogrammazione per proporre una seduta più leggera. */
  disruption?: Disruption;
}

export function readinessAdvice(c: CheckIn, todays: PlannedWorkout[], recent: CheckIn[] = []): ReadinessAdvice {
  const planned = todays.filter((w) => w.status === "programmato");
  const hard = planned.find((w) => isHard(w.type));
  const main = hard ?? planned[0];
  const where = c.painWhere ? ` (${c.painWhere})` : "";
  const sport = main?.sport;

  if (c.pain === "forte") {
    return {
      status: "stop",
      text: `Dolore forte${where}: oggi niente allenamento che lo coinvolga. Se non passa in 2–3 giorni o peggiora, senti un medico o un fisioterapista.`,
      ...(main && { disruption: { kind: "dolore", from: c.date, painSport: sport, painSevere: true } }),
    };
  }
  if (c.pain === "leggero" && main) {
    return {
      status: "attenzione",
      text: `Fastidio leggero${where}: meglio togliere l'intensità per qualche giorno e vedere come risponde.`,
      disruption: { kind: "dolore", from: c.date, painSport: sport, painSevere: false },
    };
  }
  // Tre mattine di fila molto stanco: segnale da non ignorare, anche se oggi è un giorno facile.
  const tiredStreak = [c, ...recent.filter((r) => r.date < c.date)].slice(0, 3);
  const streak = tiredStreak.length === 3 && tiredStreak.every((r) => r.fatigue >= 4);
  const tired = c.fatigue >= 5 || (c.sleep <= 2 && c.fatigue >= 4) || streak;
  if (tired && hard) {
    return {
      status: "attenzione",
      text: `${streak ? "Terza mattina di fila molto stanco" : c.sleep <= 2 ? "Hai dormito male e sei stanco" : "Sei molto stanco"}: ${hard.title.toLowerCase()} oggi rischia di fare più male che bene. Il coach propone una versione più leggera.`,
      disruption: { kind: "stanco", from: c.date },
    };
  }
  if ((c.sleep <= 2 || c.fatigue >= 4) && hard) {
    return {
      status: "attenzione",
      text: `Non sei al meglio: fai ${hard.title.toLowerCase()} ma ascolta le sensazioni. Se dopo il riscaldamento le gambe non girano, passa a una seduta facile.`,
      disruption: { kind: "stanco", from: c.date },
    };
  }
  if (streak) return { status: "attenzione", text: "Terza mattina di fila molto stanco: oggi resta tranquillo e cura il sonno. Se continua, alleggerisci la settimana." };
  if (!planned.length) return { status: "via libera", text: "Oggi riposo: goditelo. Una camminata o un po' di mobilità vanno benissimo." };
  return { status: "via libera", text: c.sleep >= 4 && c.fatigue <= 2 ? "Via libera: sei in forma, oggi si può spingere come previsto." : "Via libera: segui la seduta come previsto." };
}
