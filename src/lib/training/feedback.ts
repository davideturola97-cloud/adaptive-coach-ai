import { addDays } from "@/lib/dates";
import type { CompletedActivity, PlannedWorkout, Sport } from "@/lib/domain/types";

/* ---------- Duplicati ---------- */

/** Impronta di un'attività: sport, giorno e durata arrotondata a 5 minuti. */
export function dedupeKey(sport: Sport, date: string, durationMin: number): string {
  return `${sport}|${date}|${Math.round(durationMin / 5) * 5}`;
}

/** Attività già registrate che sembrano la stessa: stesso sport e giorno, durata entro il 10% (minimo 5 minuti). */
export function findSimilar(activities: CompletedActivity[], sport: Sport, date: string, durationMin: number): CompletedActivity[] {
  const tol = Math.max(5, durationMin * 0.1);
  return activities.filter((a) => a.sport === sport && a.date === date && Math.abs(a.durationMin - durationMin) <= tol);
}

/** Seduta del programma da collegare a un'attività inserita a mano: stesso sport e giorno, ancora da fare. */
export function matchPlanned(plan: PlannedWorkout[], sport: Sport, date: string): PlannedWorkout | undefined {
  return plan.find((p) => p.sport === sport && p.date === date && p.status === "programmato");
}

/* ---------- Segnali dai feedback ---------- */

export interface Signal {
  id: "dolore" | "fatica" | "sonno" | "registrare";
  title: string;
  detail: string;
}

/** RPE previsto per una seduta: il valore più alto della parte centrale. */
export function expectedRpe(w: PlannedWorkout): number | null {
  const vals = w.structure.main.map((s) => s.rpe[1]);
  return vals.length ? Math.max(...vals) : null;
}

/**
 * Segnali che meritano attenzione. Un singolo feedback non basta mai:
 * servono episodi ripetuti in un periodo breve. I testi suggeriscono prudenza, non fanno diagnosi.
 */
export function feedbackSignals(activities: CompletedActivity[], plan: PlannedWorkout[], today: string): Signal[] {
  const out: Signal[] = [];
  const recent = (days: number) => activities.filter((a) => a.date > addDays(today, -days) && a.date <= today && a.feedback);

  const pain = recent(14).filter((a) => a.feedback!.pain);
  if (pain.length >= 2) {
    out.push({
      id: "dolore",
      title: "Dolore segnalato più volte",
      detail: `Hai indicato un dolore in ${pain.length} sedute nelle ultime 2 settimane. Riduci l'intensità finché non passa; se continua o peggiora, senti un medico o un fisioterapista.`,
    });
  }

  const byPlan = new Map(plan.map((p) => [p.completedActivityId, p]));
  const last5 = recent(21).slice(-5);
  const tooHard = last5.filter((a) => {
    const p = byPlan.get(a.id);
    const exp = p ? expectedRpe(p) : null;
    return exp !== null && a.feedback!.rpe >= exp + 2;
  });
  if (tooHard.length >= 3) {
    out.push({
      id: "fatica",
      title: "Sedute più dure del previsto",
      detail: `In ${tooHard.length} delle ultime ${last5.length} sedute lo sforzo è stato molto più alto del previsto. Può dipendere da stanchezza accumulata, sonno o stress: valuta qualche giorno più leggero.`,
    });
  }

  const sleep = recent(7).filter((a) => a.feedback!.sleepQuality !== undefined && a.feedback!.sleepQuality <= 2);
  if (sleep.length >= 3) {
    out.push({
      id: "sonno",
      title: "Sonno scarso negli ultimi giorni",
      detail: "Hai dormito male in più occasioni questa settimana. Il recupero ne risente: meglio non aggiungere intensità.",
    });
  }

  const unlogged = plan.filter((p) => p.status === "programmato" && p.date < today && p.date >= addDays(today, -7));
  if (unlogged.length) {
    out.push({
      id: "registrare",
      title: `${unlogged.length === 1 ? "Una seduta" : `${unlogged.length} sedute`} da registrare`,
      detail: "Segnale come fatte o saltate: il coach usa questi dati per carico e aderenza.",
    });
  }
  return out;
}
