/**
 * Piano gara per le gare di corsa: passo per tratti, tempi di passaggio, alimentazione e checklist.
 * Si costruisce sull'obiettivo scelto (sicuro, possibile, ambizioso) calcolato dalle previsioni. Sono indicazioni, non regole:
 * in gara comandano le sensazioni.
 *
 * Strategia (negative split prudente, la più efficace per gli amatori):
 * - primo tratto (circa 25% della gara) 5″/km più lento del passo obiettivo: il cuore sale con calma;
 * - parte centrale al passo obiettivo;
 * - ultimo tratto (circa 20%) libero: se stai bene fino a 5″/km più veloce, altrimenti tieni.
 * Il tempo finale resta quello dell'obiettivo: i secondi persi all'inizio si recuperano nel finale.
 */
import type { RaceEvent } from "@/lib/domain/types";

export interface Segment {
  fromKm: number;
  toKm: number;
  paceSec: number;
  label: string;
}

export interface RacePlan {
  distanceKm: number;
  targetSec: number;
  segments: Segment[];
  /** Tempi di passaggio ogni 5 km (e all'arrivo). */
  splits: { km: number; timeSec: number }[];
  fueling: string[];
  checklist: { title: string; items: string[] }[];
  heatNote: string;
}

const pace = (s: number) => `${Math.floor(Math.round(s) / 60)}:${String(Math.round(s) % 60).padStart(2, "0")}`;

export function racePlan(e: Pick<RaceEvent, "distanceKm">, targetSec: number): RacePlan | null {
  const D = e.distanceKm;
  if (!D || D < 3 || D > 43) return null;
  const goal = targetSec / D;
  const a = Math.max(1, Math.round(D * 0.25));
  // Il finale parte da un km intero (es. dal 17° nella mezza): più facile da ricordare in gara.
  const endFrom = Math.floor(D - Math.max(1, Math.round(D * 0.2)));
  const c = D - endFrom;
  // Passo centrale ricalcolato perché il totale torni esatto: inizio +5″/km, finale −3″/km (in media, se si sta bene).
  const startP = goal + 5;
  const endP = goal - 3;
  const midKm = D - a - c;
  const midP = (targetSec - a * startP - c * endP) / midKm;
  const segments: Segment[] = [
    { fromKm: 0, toKm: a, paceSec: startP, label: "Partenza controllata: lasciati superare, il ritmo arriva da solo" },
    { fromKm: a, toKm: D - c, paceSec: midP, label: "Ritmo gara: regolare, respiro controllato" },
    { fromKm: D - c, toKm: D, paceSec: endP, label: "Finale: se stai bene accelera poco alla volta, altrimenti tieni" },
  ];
  const timeAt = (km: number) => {
    let t = 0;
    for (const s of segments) {
      const part = Math.max(0, Math.min(km, s.toKm) - s.fromKm);
      t += part * s.paceSec;
    }
    return t;
  };
  const splits = [];
  for (let k = 5; k < D; k += 5) splits.push({ km: k, timeSec: timeAt(k) });
  splits.push({ km: D, timeSec: targetSec });

  const minutes = targetSec / 60;
  const fueling =
    minutes < 50 ? ["Gara breve: niente gel. Colazione leggera 2–3 ore prima e un sorso d'acqua al ristoro se fa caldo."]
    : minutes < 80 ? ["Un gel verso metà gara (con acqua al ristoro) se ti sei allenato a prenderlo; altrimenti solo acqua.", "Bevi qualche sorso a ogni ristoro, senza fermarti."]
    : minutes < 150 ? [
        `Gel ogni 35–40 minuti: circa al km ${Math.round(D * 0.33)} e al km ${Math.round(D * 0.66)}, sempre con acqua.`,
        "Qualche sorso a ogni ristoro, anche senza sete: nei primi km è facile dimenticarsene.",
        "Solo gel già provati in allenamento: in gara niente novità.",
      ]
    : ["Circa 60 g di carboidrati all'ora: un gel ogni 30–35 minuti dal minuto 40, sempre con acqua.", "Bevi a ogni ristoro; con il caldo aggiungi sali minerali.", "Solo prodotti già provati nei lunghi."];

  const warm = D <= 10 ? "15' di corsa facile, 4–6 allunghi da 20″ e 2' al passo gara, finendo 10' prima della partenza" : "10' di corsa facile e 3–4 allunghi da 20″: non serve di più, il riscaldamento lo fanno i primi km";
  const checklist = [
    {
      title: "La sera prima",
      items: [
        "Cena normale con carboidrati (pasta, riso, pane), niente cibi nuovi o molto grassi.",
        "Prepara tutto: pettorale con 4 spille, scarpe già usate, calze, gel, orologio carico, maglia adatta al meteo.",
        "Controlla orario di partenza, parcheggio o treno e dove lasciare la sacca.",
        "Sveglia per fare colazione 3 ore prima del via.",
      ],
    },
    {
      title: "La mattina",
      items: [
        "Colazione 3 ore prima: carboidrati facili (pane, marmellata, fette biscottate, banana) e poca fibra; caffè se lo prendi sempre.",
        "Arriva con 45–60 minuti di anticipo; bagno prima di entrare in griglia.",
        `Riscaldamento: ${warm}.`,
        `Imposta l'orologio sul passo: i primi km intorno a ${pace(startP)} /km.`,
      ],
    },
    {
      title: "Dopo l'arrivo",
      items: [
        "Cammina 10 minuti, bevi e mangia qualcosa entro mezz'ora.",
        "Registra la gara (arriva da Strava) e segna l'RPE: le previsioni per le prossime gare diventano precise.",
        "Nei giorni dopo il programma prevede recupero: rispettalo anche se ti senti bene.",
      ],
    },
  ];
  const heatNote = "Con caldo (oltre 18–20 °C) o vento forte rallenta di 5–10″/km: il tempo finale conta meno del finire bene.";
  return { distanceKm: D, targetSec, segments, splits, fueling, checklist, heatNote };
}
