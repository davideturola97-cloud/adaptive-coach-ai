import { addDays, mondayOf } from "@/lib/dates";
import type { CompletedActivity, PlannedWorkout, Sport } from "@/lib/domain/types";
import { acuteChronicRatio, sessionLoad } from "./formulas";

export interface WeekSummary {
  weekStart: string;
  runKm: number;
  runMin: number;
  bikeMin: number;
  bikeKm: number;
  sessions: number;
  load: number;
  planned: number;
  completed: number;
}

/** Riepilogo per settimana (lunedì–domenica) delle ultime `weeks` settimane fino a `today`, la più vecchia per prima. */
export function weeklySummaries(activities: CompletedActivity[], plan: PlannedWorkout[], today: string, weeks: number): WeekSummary[] {
  const last = mondayOf(today);
  const out: WeekSummary[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(last, -7 * i);
    const end = addDays(start, 6);
    const acts = activities.filter((a) => a.date >= start && a.date <= end);
    const planned = plan.filter((p) => p.date >= start && p.date <= end && p.date < today);
    const sum = (sport: Sport, f: (a: CompletedActivity) => number) =>
      acts.filter((a) => a.sport === sport).reduce((t, a) => t + f(a), 0);
    out.push({
      weekStart: start,
      runKm: Math.round(sum("run", (a) => a.distanceKm ?? 0) * 10) / 10,
      runMin: sum("run", (a) => a.durationMin),
      bikeMin: sum("bike", (a) => a.durationMin),
      bikeKm: Math.round(sum("bike", (a) => a.distanceKm ?? 0) * 10) / 10,
      sessions: acts.length,
      load: acts.reduce((t, a) => t + (a.feedback ? sessionLoad(a.durationMin, a.feedback.rpe) : 0), 0),
      planned: planned.length,
      completed: planned.filter((p) => p.status === "completato").length,
    });
  }
  return out;
}

/** Carico giornaliero (session-RPE) degli ultimi `days` giorni fino a ieri incluso. */
export function dailyLoads(activities: CompletedActivity[], today: string, days = 28): number[] {
  const out: number[] = [];
  for (let i = days; i >= 1; i--) {
    const d = addDays(today, -i);
    out.push(
      activities.filter((a) => a.date === d).reduce((t, a) => t + (a.feedback ? sessionLoad(a.durationMin, a.feedback.rpe) : 0), 0),
    );
  }
  return out;
}

export type LoadState = "basso" | "equilibrato" | "in crescita" | "alto";

/** Stato del carico dal rapporto acuto/cronico. Soglie indicative, non diagnostiche. */
export function loadState(activities: CompletedActivity[], today: string): { ratio: number | null; state: LoadState | null } {
  const ratio = acuteChronicRatio(dailyLoads(activities, today, 28));
  if (ratio === null) return { ratio, state: null };
  const state: LoadState = ratio < 0.8 ? "basso" : ratio <= 1.3 ? "equilibrato" : ratio <= 1.5 ? "in crescita" : "alto";
  return { ratio, state };
}

/** Aderenza: sedute completate sulle sedute già passate del periodo. */
export function adherence(plan: PlannedWorkout[], from: string, today: string): number | null {
  const due = plan.filter((p) => p.date >= from && p.date < today);
  if (!due.length) return null;
  return due.filter((p) => p.status === "completato").length / due.length;
}
