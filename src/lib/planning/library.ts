/**
 * Libreria delle sedute di qualità, come le costruirebbe un allenatore: ogni famiglia ha una scala di livelli
 * che fa crescere il lavoro poco per volta (più ripetizioni, frazioni più lunghe, recuperi più brevi in proporzione).
 *
 * Recuperi proporzionati al tipo di lavoro:
 * - VO₂max e ritmo 5–10 km: circa metà del tempo della frazione, corricchiando;
 * - soglia e ritmo mezza: brevi (circa 1/5 – 1/4 del lavoro), per restare in zona;
 * - salite: discesa al passo o corricchiando; fartlek: la parte "piano" è corsa facile.
 */
import type { Sport, WorkoutStep, WorkoutStructure, WorkoutType } from "@/lib/domain/types";

export type Family =
  | "vo2" | "soglia" | "ritmo_10k" | "ritmo_mezza" | "fartlek" | "salite"
  | "bike_sweetspot" | "bike_soglia" | "bike_vo2" | "bike_tempo"
  | "swim_css" | "swim_veloce";

interface Rep {
  reps: number;
  /** Durata della frazione in minuti, oppure distanza in km. */
  min?: number;
  km?: number;
  /** Recupero in minuti (0 = blocco continuo). */
  rec: number;
}

interface FamilyDef {
  sport: Sport;
  type: WorkoutType;
  label: string;
  objective: string;
  zone: string;
  recZone: string;
  recText: (r: Rep) => string;
  rpe: [number, number];
  note?: string;
  warm: number;
  cool: number;
  /** Allunghi a fine riscaldamento (corsa). */
  strides?: boolean;
  levels: Rep[];
  tips: string[];
}

const secs = (min: number) => {
  const s = Math.round(min * 60);
  if (s < 60) return `${s}″`;
  return s % 60 ? `${Math.floor(s / 60)}'${String(s % 60).padStart(2, "0")}″` : `${s / 60}'`;
};
const dist = (km: number, sport: Sport) => (sport === "swim" || km < 1 ? `${Math.round(km * 1000)} m` : `${String(km).replace(".", ",")} km`);
const jog = (r: Rep) => (r.rec ? `${secs(r.rec)} di corsa lenta tra le frazioni` : "");

export const FAMILIES: Record<Family, FamilyDef> = {
  vo2: {
    sport: "run", type: "ripetute", label: "Ripetute VO₂max", zone: "ripetute", recZone: "recuperoTraProve", rpe: [8, 9], warm: 15, cool: 10, strides: true,
    objective: "Alzare la potenza aerobica massima: il motore che rende più facili tutti i ritmi di gara.",
    note: "Ritmo dei 5 km o poco più veloce: forte ma uguale dalla prima all'ultima",
    recText: jog,
    levels: [
      { reps: 6, min: 2, rec: 1 }, { reps: 5, min: 3, rec: 1.5 }, { reps: 6, km: 0.8, rec: 1.5 }, { reps: 5, km: 1, rec: 2 },
      { reps: 6, km: 1, rec: 2 }, { reps: 5, km: 1.2, rec: 2.5 }, { reps: 4, km: 1.6, rec: 3 },
    ],
    tips: ["Se l'ultima frazione è più lenta di 5″/km rispetto alla prima, la prossima volta parti più piano.", "Recupero corricchiando, non da fermo."],
  },
  ritmo_10k: {
    sport: "run", type: "ripetute", label: "Ritmo 10 km", zone: "dieci", recZone: "recuperoTraProve", rpe: [7, 8], warm: 15, cool: 10, strides: true,
    objective: "Abituarsi al ritmo dei 10 km e ad allungare il tempo sostenuto a quel ritmo.",
    recText: jog,
    levels: [{ reps: 5, km: 1, rec: 1 }, { reps: 6, km: 1, rec: 1 }, { reps: 4, km: 1.5, rec: 1.5 }, { reps: 3, km: 2, rec: 2 }, { reps: 3, km: 3, rec: 2 }],
    tips: ["Recupero breve: il battito non deve scendere del tutto."],
  },
  soglia: {
    sport: "run", type: "tempo_run", label: "Soglia", zone: "soglia", recZone: "recuperoTraProve", rpe: [6, 7], warm: 15, cool: 10,
    objective: "Spostare più in alto il ritmo che sostieni a lungo senza andare in acido (soglia).",
    note: "Impegnativo ma controllato: frasi brevi, respiro regolare",
    recText: (r) => (r.rec ? `${secs(r.rec)} di corsa lenta tra i blocchi` : ""),
    levels: [
      { reps: 3, min: 8, rec: 2 }, { reps: 3, min: 10, rec: 2 }, { reps: 2, min: 15, rec: 3 }, { reps: 4, km: 2, rec: 1.5 },
      { reps: 3, km: 3, rec: 2 }, { reps: 2, km: 5, rec: 3 }, { reps: 3, km: 4, rec: 2 },
    ],
    tips: ["Non deve diventare una gara: meglio 5″ più lento che finire a tutta.", "Ogni blocco uguale o leggermente più veloce del precedente."],
  },
  ritmo_mezza: {
    sport: "run", type: "tempo_run", label: "Ritmo mezza", zone: "mezza", recZone: "recuperoTraProve", rpe: [6, 7], warm: 15, cool: 10,
    objective: "Rendere familiare e sostenibile il ritmo della mezza maratona.",
    note: "Il ritmo che vuoi tenere in gara: regolare, mai sopra",
    recText: (r) => (r.rec ? `${secs(r.rec)} di corsa lenta tra i blocchi` : ""),
    levels: [
      { reps: 3, km: 2, rec: 1.5 }, { reps: 3, km: 3, rec: 2 }, { reps: 2, km: 5, rec: 2 }, { reps: 4, km: 3, rec: 2 },
      { reps: 3, km: 4, rec: 2 }, { reps: 2, km: 6, rec: 3 }, { reps: 3, km: 5, rec: 2 },
    ],
    tips: ["Prova in allenamento gel e bevande che userai in gara.", "Se il ritmo costa più fatica del previsto, quel giorno conta l'RPE."],
  },
  fartlek: {
    sport: "run", type: "ripetute", label: "Fartlek", zone: "fartlek", recZone: "facile", rpe: [6, 7], warm: 15, cool: 10,
    objective: "Cambi di ritmo in libertà: velocità ed economia di corsa senza lo stress delle ripetute.",
    recText: (r) => `${secs(r.rec)} di corsa facile (non lentissima) dopo ogni tratto svelto`,
    levels: [{ reps: 8, min: 1, rec: 1 }, { reps: 10, min: 1, rec: 1 }, { reps: 6, min: 2, rec: 1 }, { reps: 5, min: 3, rec: 1.5 }, { reps: 4, min: 4, rec: 2 }],
    tips: ["Tratti svelti a sensazione, intorno al ritmo dei 10 km.", "Si fa ovunque: non serve una pista."],
  },
  salite: {
    sport: "run", type: "ripetute", label: "Salite brevi", zone: "rpe", recZone: "rpe", rpe: [8, 9], warm: 20, cool: 10,
    objective: "Forza specifica e spinta: proteggono dagli infortuni e preparano alle ripetute.",
    note: "Pendenza 5–8%, spinta decisa, busto alto, passo corto e rapido. Il passo al km in salita non conta",
    recText: () => "ritorno in discesa camminando o corricchiando piano",
    levels: [{ reps: 8, min: 0.5, rec: 1.5 }, { reps: 10, min: 0.5, rec: 1.5 }, { reps: 8, min: 0.75, rec: 2 }, { reps: 8, min: 1, rec: 2 }, { reps: 10, min: 1, rec: 2 }],
    tips: ["In discesa rilassati: è il recupero.", "Con il tendine d'Achille sensibile inizia dalle salite più dolci."],
  },
  bike_sweetspot: {
    sport: "bike", type: "sweet_spot", label: "Sweet spot", zone: "", recZone: "", rpe: [6, 7], warm: 15, cool: 10,
    objective: "Alzare la FTP con un carico alto ma sostenibile: il lavoro più redditizio per il triathlon medio.",
    recText: (r) => `${secs(r.rec)} agili tra i blocchi`,
    levels: [{ reps: 3, min: 10, rec: 3 }, { reps: 3, min: 12, rec: 3 }, { reps: 2, min: 20, rec: 5 }, { reps: 3, min: 15, rec: 4 }, { reps: 3, min: 20, rec: 5 }, { reps: 2, min: 30, rec: 5 }],
    tips: ["Cadenza 85–95 rpm, seduto e regolare.", "Mangia qualcosa ogni 30–40 minuti."],
  },
  bike_soglia: {
    sport: "bike", type: "soglia", label: "Soglia", zone: "", recZone: "", rpe: [7, 8], warm: 15, cool: 10,
    objective: "Lavorare alla FTP per spostarla più in alto.",
    recText: (r) => `${secs(r.rec)} agili tra i blocchi`,
    levels: [{ reps: 4, min: 6, rec: 3 }, { reps: 3, min: 10, rec: 4 }, { reps: 4, min: 8, rec: 4 }, { reps: 3, min: 12, rec: 5 }, { reps: 2, min: 20, rec: 6 }],
    tips: ["Meglio sui rulli o su una salita lunga e regolare."],
  },
  bike_vo2: {
    sport: "bike", type: "vo2max", label: "VO₂max", zone: "", recZone: "", rpe: [8, 9], warm: 15, cool: 10,
    objective: "Aumentare la potenza aerobica massima in bici.",
    recText: (r) => `${secs(r.rec)} agilissimi tra le ripetute`,
    levels: [{ reps: 5, min: 2, rec: 2 }, { reps: 5, min: 3, rec: 3 }, { reps: 6, min: 3, rec: 3 }, { reps: 5, min: 4, rec: 3 }, { reps: 4, min: 5, rec: 4 }],
    tips: ["Potenza uguale in tutte le ripetute: l'ultima deve riuscire come la prima."],
  },
  bike_tempo: {
    sport: "bike", type: "tempo_bici", label: "Tempo", zone: "", recZone: "", rpe: [5, 6], warm: 15, cool: 10,
    objective: "Resistenza a ritmo sostenuto, il ritmo della frazione in bici del triathlon.",
    recText: (r) => `${secs(r.rec)} agili tra i blocchi`,
    levels: [{ reps: 2, min: 15, rec: 5 }, { reps: 3, min: 12, rec: 4 }, { reps: 2, min: 20, rec: 5 }, { reps: 3, min: 20, rec: 5 }, { reps: 2, min: 30, rec: 5 }],
    tips: ["Posizione da gara se usi la bici da crono o le appendici."],
  },
  swim_css: {
    sport: "swim", type: "css_nuoto", label: "Ritmo CSS", zone: "", recZone: "", rpe: [6, 7], warm: 10, cool: 5,
    objective: "Alzare la velocità di soglia in acqua: il ritmo da tenere nella frazione del triathlon.",
    recText: (r) => `${secs(r.rec)} fermo a bordo vasca tra le frazioni`,
    levels: [{ reps: 8, km: 0.1, rec: 0.25 }, { reps: 10, km: 0.1, rec: 0.25 }, { reps: 6, km: 0.2, rec: 0.33 }, { reps: 4, km: 0.3, rec: 0.5 }, { reps: 3, km: 0.4, rec: 0.5 }, { reps: 12, km: 0.1, rec: 0.17 }],
    tips: ["Passo uguale in tutte le frazioni: usa il cronometro a bordo vasca."],
  },
  swim_veloce: {
    sport: "swim", type: "ripetute_nuoto", label: "Velocità", zone: "", recZone: "", rpe: [7, 8], warm: 10, cool: 5,
    objective: "Velocità e potenza di bracciata.",
    recText: (r) => `${secs(r.rec)} fermo tra le frazioni`,
    levels: [{ reps: 8, km: 0.05, rec: 0.5 }, { reps: 10, km: 0.05, rec: 0.5 }, { reps: 6, km: 0.1, rec: 0.75 }, { reps: 8, km: 0.1, rec: 0.75 }],
    tips: ["Bracciata lunga anche quando vai forte."],
  },
};

/** Passo indicativo per stimare la durata delle frazioni a distanza (secondi/km), quando non c'è un dato migliore. */
const DEFAULT_PACE: Record<Sport, number> = { run: 300, bike: 120, swim: 1200, gym: 0 };
/** Moltiplicatori del ritmo di soglia per stimare la durata (corsa). */
const ZONE_MULT: Record<string, number> = { ripetute: 0.94, dieci: 0.97, soglia: 1.01, mezza: 1.03, fartlek: 1, rpe: 1 };

export interface LibrarySession {
  type: WorkoutType;
  title: string;
  objective: string;
  structure: WorkoutStructure;
  durationMin: number;
  technicalTips: string[];
  intensity: string;
}

/** Durata stimata della parte di lavoro di un livello (minuti), recuperi compresi. */
export function workMinutes(f: Family, level: number, thresholdSec?: number): number {
  const def = FAMILIES[f];
  const r = def.levels[Math.min(level, def.levels.length) - 1];
  const pace = def.sport === "run" && thresholdSec ? thresholdSec * (ZONE_MULT[def.zone] ?? 1) : DEFAULT_PACE[def.sport];
  const repMin = r.min ?? ((r.km ?? 0) * pace) / 60;
  return repMin * r.reps + r.rec * Math.max(0, r.reps - 1);
}

export const maxLevel = (f: Family) => FAMILIES[f].levels.length;

/** Il livello più alto (≤ desiderato) che sta nella durata massima della seduta. */
export function fitLevel(f: Family, wanted: number, maxMin: number, thresholdSec?: number): number {
  const def = FAMILIES[f];
  for (let l = Math.min(Math.max(1, wanted), def.levels.length); l > 1; l--) {
    if (def.warm + def.cool + workMinutes(f, l, thresholdSec) <= maxMin) return l;
  }
  return 1;
}

/** Costruisce la seduta della famiglia al livello indicato. */
export function buildSession(f: Family, level: number, thresholdSec?: number): LibrarySession {
  const def = FAMILIES[f];
  const L = Math.min(Math.max(1, level), def.levels.length);
  const r = def.levels[L - 1];
  const what = r.min !== undefined ? secs(r.min) : dist(r.km!, def.sport);
  const title = r.reps === 1 ? `${def.label}: ${what} continui` : `${def.label} ${r.reps} × ${what}`;
  const work = workMinutes(f, L, thresholdSec);
  const repMin = Math.round(((work - r.rec * Math.max(0, r.reps - 1)) / r.reps) * 10) / 10;
  const main: WorkoutStep = {
    label: r.reps === 1 ? `${what} continui` : r.min !== undefined ? `Frazione da ${what}` : `Frazione da ${what}`,
    durationMin: repMin,
    ...(r.km !== undefined && { distanceKm: r.km }),
    ...(r.reps > 1 && { repeat: r.reps }),
    rpe: def.rpe,
    ...(def.note && { note: def.note }),
    ...(def.zone && { zone: def.zone }),
  };
  const warmup: WorkoutStep[] = [{ label: "Riscaldamento progressivo", durationMin: def.warm, rpe: [2, 3] }];
  if (def.strides) warmup.push({ label: "Allunghi di 20″ (recupero 40″ camminando)", durationMin: 0.33, repeat: 4, rpe: [6, 7], zone: "rpe", note: "Brillanti, non a tutta" });
  const durationMin = Math.round(def.warm + def.cool + work + (def.strides ? 4 : 0));
  return {
    type: def.type,
    title,
    objective: def.objective,
    durationMin,
    intensity: `${def.rpe[0] >= 8 ? "Alta" : def.rpe[0] >= 6 ? "Medio-alta" : "Media"} (RPE ${def.rpe[0]}–${def.rpe[1]})`,
    technicalTips: def.tips,
    structure: {
      warmup,
      main: [main],
      ...(r.rec > 0 && { recoveries: def.recText(r), recoveryZone: def.recZone || undefined, recoveryMin: r.rec }),
      cooldown: [{ label: "Defaticamento", durationMin: def.cool, rpe: [1, 2] }],
      session: { family: f, level: L, maxLevel: def.levels.length },
    },
  };
}
