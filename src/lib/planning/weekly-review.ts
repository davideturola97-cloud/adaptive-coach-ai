/**
 * Revisione della settimana, come la farebbe un allenatore la domenica sera:
 * guarda com'è andata (sedute fatte e saltate, RPE rispetto al previsto, fatica e dolori del mattino)
 * e prepara la settimana successiva già corretta. L'atleta conferma con un tocco; si può annullare.
 */
import { addDays, mondayOf, weekdayName, daysBetween } from "@/lib/dates";
import type { AthleteProfile, CompletedActivity, PlannedTest, PlannedWorkout, RaceEvent } from "@/lib/domain/types";
import type { CheckIn } from "@/lib/training/readiness";
import { generatePlan, type PlanDraft } from "./engine";

export interface ReviewInput {
  today: string;
  athlete: AthleteProfile;
  events: RaceEvent[];
  plan: PlannedWorkout[];
  activities: CompletedActivity[];
  plannedTests: PlannedTest[];
  checkins: CheckIn[];
  reviewedWeek?: string;
  thresholdSec?: number;
}

export interface DayChange {
  date: string;
  before: string;
  after: string;
}

export interface WeeklyReview {
  targetMonday: string;
  weeks: number;
  /** Com'è andata, in frasi brevi. */
  summary: string[];
  /** Decisione del coach per la prossima settimana. */
  decision: string;
  factor: number;
  changes: DayChange[];
  beforeMin: number;
  afterMin: number;
  draft: PlanDraft;
}

const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, "0")}'` : `${Math.round(m)}'`);

/** La settimana da rivedere: da sabato la prossima, il lunedì quella che inizia. Negli altri giorni nessuna revisione. */
export function reviewTarget(today: string): string | null {
  const d = weekdayName(today, true);
  if (d === "Sab" || d === "Dom") return addDays(mondayOf(today), 7);
  if (d === "Lun") return today;
  return null;
}

export function weeklyReview(input: ReviewInput, force = false): WeeklyReview | null {
  const { today } = input;
  const target = force ? addDays(mondayOf(today), weekdayName(today, true) === "Lun" ? 0 : 7) : reviewTarget(today);
  if (!target || (!force && input.reviewedWeek === target)) return null;
  const future = input.plan.filter((p) => p.date >= target);
  if (!future.length) return null; // nessun programma da adattare

  // Com'è andata negli ultimi 7 giorni.
  const from = addDays(today, -7);
  const past = input.plan.filter((p) => p.date >= from && p.date < today);
  const done = past.filter((p) => p.status === "completato");
  const skipped = past.filter((p) => p.status === "saltato");
  const unlogged = past.filter((p) => p.status === "programmato");
  const adherence = past.length ? done.length / past.length : 1;
  const tooHard = done.filter((p) => {
    const a = input.activities.find((x) => x.id === p.completedActivityId);
    const hi = Math.max(0, ...p.structure.main.map((m) => m.rpe[1]));
    return a?.feedback && hi && a.feedback.rpe >= hi + 2;
  });
  const recent = input.checkins.filter((c) => c.date >= from);
  const avgFatigue = recent.length ? recent.reduce((t, c) => t + c.fatigue, 0) / recent.length : 0;
  const avgSleep = recent.length ? recent.reduce((t, c) => t + c.sleep, 0) / recent.length : 0;
  const painDays = recent.filter((c) => c.pain !== "nessuno").length;

  const summary: string[] = [];
  if (past.length) summary.push(`Sedute fatte: ${done.length} su ${past.length}${skipped.length ? `, ${skipped.length} saltate` : ""}${unlogged.length ? `, ${unlogged.length} da registrare` : ""}.`);
  if (tooHard.length) summary.push(`${tooHard.length === 1 ? "Una seduta è stata" : `${tooHard.length} sedute sono state`} molto più dure del previsto (${tooHard.map((p) => p.title).join(", ")}).`);
  if (recent.length) summary.push(`Mattine: sonno medio ${avgSleep.toFixed(1).replace(".", ",")}/5, fatica media ${avgFatigue.toFixed(1).replace(".", ",")}/5${painDays ? `, fastidi in ${painDays} giorni` : ""}.`);

  // Decisione: più leggera se la settimana è stata pesante, altrimenti si prosegue con la progressione.
  let factor = 1;
  let decision = "Settimana regolare: si prosegue con la progressione prevista, le sedute salgono di livello dove le hai chiuse bene.";
  const heavy = tooHard.length >= 2 || avgFatigue >= 3.8 || painDays >= 2;
  if (heavy) {
    factor = 0.85;
    decision = `Settimana pesante${painDays >= 2 ? " e con fastidi" : ""}: la prossima ha il 15% di volume in meno e le sedute di qualità restano allo stesso livello, per recuperare senza perdere la forma.`;
  } else if (adherence < 0.6 && past.length >= 3) {
    factor = 0.85;
    decision = `Hai fatto poco più della metà delle sedute: la prossima settimana riparte un po' più leggera (−15%) invece di aggiungere carico.`;
  } else if (adherence >= 0.9 && past.length >= 3 && !tooHard.length && avgFatigue < 3) {
    decision = "Tutto fatto e senza segnali di fatica: si prosegue con la progressione, un gradino sopra nelle sedute di qualità.";
  }

  const last = future.reduce((m, p) => (p.date > m ? p.date : m), target);
  const weeks = Math.min(20, Math.max(4, Math.ceil((daysBetween(target, last) + 1) / 7)));
  const draft = generatePlan({
    today, startDate: target, athlete: input.athlete, events: input.events, tests: input.plannedTests, weeks,
    history: { activities: input.activities, plan: input.plan.filter((p) => p.date < today) },
    thresholdSec: input.thresholdSec,
    firstWeekFactor: factor,
  });

  // Differenze nella prossima settimana, giorno per giorno.
  const end = addDays(target, 6);
  const changes: DayChange[] = [];
  const label = (ws: { title: string }[]) => (ws.length ? ws.map((w) => w.title).join(" + ") : "riposo");
  for (let i = 0; i < 7; i++) {
    const d = addDays(target, i);
    const before = input.plan.filter((p) => p.date === d && p.status === "programmato");
    const after = draft.workouts.filter((w) => w.date === d);
    if (label(before) !== label(after)) changes.push({ date: d, before: label(before), after: label(after) });
  }
  const beforeMin = input.plan.filter((p) => p.date >= target && p.date <= end && p.status === "programmato").reduce((t, p) => t + p.durationMin, 0);
  const afterMin = draft.workouts.filter((w) => w.date >= target && w.date <= end).reduce((t, w) => t + w.durationMin, 0);
  if (!changes.length) decision += " Il programma della prossima settimana va già bene così.";
  else decision += ` Volume della settimana: ${fmtMin(beforeMin)} → ${fmtMin(afterMin)}.`;

  return { targetMonday: target, weeks, summary, decision, factor, changes, beforeMin, afterMin, draft };
}
