/**
 * Stato di allenamento dalla storia reale: volume delle ultime settimane, lungo più lungo recente
 * e livello raggiunto in ogni famiglia di sedute (con il motivo, da mostrare all'atleta).
 */
import { addDays } from "@/lib/dates";
import type { AthleteProfile, CompletedActivity, Level, PlannedWorkout, Sport } from "@/lib/domain/types";
import { FAMILIES, maxLevel, type Family } from "./library";

export interface TrainingHistory {
  activities: CompletedActivity[];
  /** Sedute passate del programma (fatte o saltate), con la loro struttura. */
  plan: PlannedWorkout[];
}

export interface TrainingState {
  /** Minuti medi a settimana (tutti gli sport) nelle ultime 4 settimane; undefined se i dati sono troppo pochi. */
  weeklyMin?: number;
  /** Minuti del lungo più lungo nelle ultime 6 settimane, per sport. */
  longestMin: Partial<Record<Sport, number>>;
  levels: Partial<Record<Family, { level: number; reason: string }>>;
}

const START: Record<Level, number> = { principiante: 1, intermedio: 2, avanzato: 3 };

export function trainingState(history: TrainingHistory | undefined, athlete: Pick<AthleteProfile, "sports">, today: string): TrainingState {
  const levelOf = (s: Sport) => athlete.sports.find((x) => x.sport === s)?.level ?? "principiante";
  const state: TrainingState = { longestMin: {}, levels: {} };
  const acts = history?.activities ?? [];

  // Volume: servono almeno 4 attività nelle ultime 4 settimane e la prima non più recente di 2 settimane fa.
  const last28 = acts.filter((a) => a.date < today && a.date >= addDays(today, -28));
  if (last28.length >= 4 && last28.some((a) => a.date < addDays(today, -14))) {
    state.weeklyMin = Math.round(last28.reduce((t, a) => t + a.durationMin, 0) / 4);
  }
  for (const s of ["run", "bike", "swim"] as Sport[]) {
    const m = Math.max(0, ...acts.filter((a) => a.sport === s && a.date < today && a.date >= addDays(today, -42)).map((a) => a.durationMin));
    if (m > 0) state.longestMin[s] = m;
  }

  // Livelli: l'ultima seduta di ogni famiglia e com'è andata.
  for (const f of Object.keys(FAMILIES) as Family[]) {
    const def = FAMILIES[f];
    const past = (history?.plan ?? [])
      .filter((p) => p.structure?.session?.family === f && p.date < today && p.date >= addDays(today, -60))
      .sort((x, y) => y.date.localeCompare(x.date));
    const start = START[levelOf(def.sport)];
    if (!past.length) {
      state.levels[f] = { level: start, reason: `prima seduta di questo tipo: si parte dal livello ${start} adatto a un atleta ${levelOf(def.sport)}` };
      continue;
    }
    const last = past[0];
    const L = last.structure.session!.level;
    const hi = Math.max(...last.structure.main.map((m) => m.rpe[1]));
    const title = last.title;
    if (last.status === "saltato") {
      const twice = past[1]?.status === "saltato";
      state.levels[f] = twice
        ? { level: Math.max(1, L - 1), reason: `le ultime due sedute di questo tipo sono saltate: si riparte un gradino sotto` }
        : { level: L, reason: `l'ultima (${title}) è saltata: si ripropone lo stesso livello` };
      continue;
    }
    if (last.status !== "completato") {
      state.levels[f] = { level: L, reason: `si riprende dal livello dell'ultima seduta in programma` };
      continue;
    }
    const act = acts.find((a) => a.id === last.completedActivityId);
    const rpe = act?.feedback?.rpe;
    if (rpe === undefined) state.levels[f] = { level: Math.min(maxLevel(f), L + 1), reason: `l'ultima (${title}) è completata; senza RPE si sale di un gradino con prudenza` };
    else if (rpe <= hi) state.levels[f] = { level: Math.min(maxLevel(f), L + 1), reason: `l'ultima (${title}) l'hai chiusa a RPE ${rpe}, come previsto: si sale di un gradino` };
    else if (rpe === hi + 1) state.levels[f] = { level: L, reason: `l'ultima (${title}) è stata più dura del previsto (RPE ${rpe}): si consolida lo stesso livello` };
    else state.levels[f] = { level: Math.max(1, L - 1), reason: `l'ultima (${title}) è stata molto dura (RPE ${rpe}): si scende di un gradino` };
  }
  return state;
}
