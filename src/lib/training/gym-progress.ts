/**
 * Progressione dei carichi in palestra con la "doppia progressione", adattata a chi fa sport di resistenza:
 * - si sale di carico solo quando tutte le serie riescono al massimo delle ripetizioni previste per 2 sedute di fila
 *   (1 se le ripetizioni sono un numero fisso e la seduta è riuscita bene);
 * - aumento: +2,5 kg per la parte alta e gli esercizi piccoli, +5 kg per i grandi esercizi di gambe (squat, stacchi, leg press),
 *   arrotondato a 2,5 kg;
 * - due sedute di fila non riuscite: −5% (arrotondato) per ripartire pulito;
 * - nelle 3 settimane prima di una gara importante i carichi delle gambe si mantengono: è il momento di arrivare freschi.
 */
import { addDays } from "@/lib/dates";
import type { CompletedActivity, GymDay, GymExercise, GymLogEntry, RaceEvent } from "@/lib/domain/types";
import { isLegExercise } from "./gym-schedule";

export interface LoadSuggestion {
  name: string;
  /** Carico consigliato per la prossima seduta. */
  loadKg?: number;
  action: "aumenta" | "mantieni" | "riduci" | "nuovo";
  reason: string;
}

const BIG_LEGS = /squat|stacc|leg ?press|deadlift|hip thrust/i;
const round25 = (x: number) => Math.round(x / 2.5) * 2.5;
const topReps = (reps: string) => Number(reps.match(/(\d+)\s*$/)?.[1] ?? reps.match(/\d+/)?.[0] ?? 0);
const isRange = (reps: string) => /\d\s*[-–]\s*\d/.test(reps);
const kg = (n: number) => `${String(n).replace(".", ",")} kg`;
const norm = (s: string) => s.trim().toLowerCase();

/** Ultime sedute in cui l'esercizio è stato registrato, dalla più recente. */
export function history(name: string, activities: CompletedActivity[]): (GymLogEntry & { date: string })[] {
  return activities
    .filter((a) => a.gymLog?.length)
    .sort((x, y) => y.date.localeCompare(x.date))
    .flatMap((a) => a.gymLog!.filter((e) => norm(e.name) === norm(name)).map((e) => ({ ...e, date: a.date })));
}

export function suggestLoad(planned: GymExercise, activities: CompletedActivity[], events: RaceEvent[], today: string): LoadSuggestion {
  const h = history(planned.name, activities);
  const base = planned.loadKg;
  if (!h.length) return { name: planned.name, loadKg: base, action: "nuovo", reason: "nessuna seduta registrata: parti dal carico della scheda e annota quello che fai" };
  const last = h[0];
  const load = last.loadKg ?? base;
  const legs = isLegExercise(planned);
  const raceSoon = events.some((e) => e.priority === "A" && e.date >= today && e.date <= addDays(today, 21));
  const fullAt = (e: GymLogEntry) => e.done && topReps(e.reps) >= topReps(planned.reps) && (e.loadKg ?? 0) >= (load ?? 0);

  if (!last.done && h[1] && !h[1].done && load) {
    const down = round25(load * 0.95);
    return { name: planned.name, loadKg: down, action: "riduci", reason: `le ultime due sedute non sono riuscite a ${kg(load)}: scendi a ${kg(down)} e riparti con tecnica pulita` };
  }
  if (!load) return { name: planned.name, action: "mantieni", reason: last.done ? "esercizio a corpo libero riuscito: aggiungi 1–2 ripetizioni o un po' di zavorra" : "non tutte le serie sono riuscite: ripeti" };
  if (legs && raceSoon) return { name: planned.name, loadKg: load, action: "mantieni", reason: "gara importante entro 3 settimane: carichi delle gambe invariati per arrivare freschi" };

  const needed = isRange(planned.reps) ? 2 : 1;
  const ok = h.slice(0, needed).length === needed && h.slice(0, needed).every(fullAt);
  if (ok) {
    const step = legs && BIG_LEGS.test(planned.name) ? 5 : 2.5;
    const up = round25(load + step);
    return {
      name: planned.name,
      loadKg: up,
      action: "aumenta",
      reason: needed === 2
        ? `due sedute di fila con tutte le serie a ${topReps(planned.reps)} ripetizioni a ${kg(load)}: prova ${kg(up)} (e riparti dal basso dell'intervallo)`
        : `tutte le serie riuscite a ${kg(load)}: prova ${kg(up)}`,
    };
  }
  return { name: planned.name, loadKg: load, action: "mantieni", reason: last.done ? `resta a ${kg(load)} finché chiudi tutte le serie al massimo delle ripetizioni${needed === 2 ? " per due sedute di fila" : ""}` : `non tutte le serie sono riuscite a ${kg(load)}: ripeti lo stesso carico` };
}

/** Consigli di carico per tutta la scheda. */
export function scheduleProgress(schedule: GymDay[], activities: CompletedActivity[], events: RaceEvent[], today: string): (LoadSuggestion & { day: string })[] {
  return schedule.flatMap((d) => (d.exercises ?? []).map((e) => ({ ...suggestLoad(e, activities, events, today), day: d.day })));
}
