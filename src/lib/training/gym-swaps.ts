/**
 * Sostituzioni degli esercizi di una seduta di palestra in base alla settimana, come farebbe un preparatore:
 * gambe affaticate dalle ripetute di ieri, seduta chiave domani, stanchezza o fastidi del mattino, gara vicina,
 * nuoto di qualità il giorno dopo. Il coach propone, l'atleta sceglie quali accettare; la modifica vale solo per quella seduta.
 * Per gli esercizi nuovi niente chili inventati: il carico si indica con le ripetizioni di margine (RPE).
 */
import { addDays, daysBetween, weekdayName } from "@/lib/dates";
import type { CompletedActivity, GymExercise, PlannedWorkout, RaceEvent, WorkoutStep, WorkoutType } from "@/lib/domain/types";
import type { CheckIn } from "./readiness";
import { exerciseLine, exerciseMinutes, isLegExercise, reduceExercise } from "./gym-schedule";

const KEY_LEGS: WorkoutType[] = ["ripetute", "tempo_run", "progressivo", "lungo", "test_corsa", "sweet_spot", "soglia", "vo2max", "tempo_bici", "test_ftp", "brick"];
const KEY_SWIM: WorkoutType[] = ["css_nuoto", "ripetute_nuoto", "test_css"];
const LEG_PAIN = /gamb|polpacc|coscia|cosce|ginocch|quadric|femor|glute|anca|tibia|achille|caviglia|piede/i;

export interface SwapContext {
  reasons: string[];
  legsTired: boolean;
  legsFresh: boolean;
  raceInDays?: number;
  upperBeforeSwim: boolean;
}

export interface Swap {
  /** Posizione dell'esercizio nella parte centrale della seduta. */
  index: number;
  from: GymExercise;
  /** null = togliere l'esercizio per questa seduta. */
  to: GymExercise | null;
  why: string;
}

const day = (d: string) => weekdayName(d).toLowerCase();

export function swapContext(
  w: Pick<PlannedWorkout, "date">,
  plan: PlannedWorkout[],
  activities: CompletedActivity[],
  events: RaceEvent[],
  checkins: CheckIn[],
): SwapContext {
  const D = w.date;
  const reasons: string[] = [];
  // Ieri: una seduta chiave di corsa o bici (fatta o in programma), o un'attività dura registrata.
  const yPlan = plan.find((p) => p.date === addDays(D, -1) && KEY_LEGS.includes(p.type) && p.status !== "saltato");
  const yAct = activities.find((a) => a.date === addDays(D, -1) && (a.sport === "run" || a.sport === "bike") && ((a.feedback?.rpe ?? 0) >= 7 || a.durationMin >= 80));
  const prevHard = yPlan?.title ?? (yAct ? yAct.title || (yAct.sport === "run" ? "la corsa" : "la bici") : undefined);
  if (prevHard) reasons.push(`ieri ${prevHard.toLowerCase()}: gambe ancora affaticate`);
  const tomorrow = plan.find((p) => p.date === addDays(D, 1) && KEY_LEGS.includes(p.type) && p.status === "programmato");
  if (tomorrow) reasons.push(`${day(addDays(D, 1))} ${tomorrow.title.toLowerCase()}: servono gambe fresche`);
  const c = checkins.find((x) => x.date === D);
  const tired = Boolean(c && c.fatigue >= 4);
  const legPain = Boolean(c && c.pain !== "nessuno" && (!c.painWhere || LEG_PAIN.test(c.painWhere)));
  if (tired) reasons.push("stamattina sei stanco");
  if (legPain) reasons.push(`fastidio${c!.painWhere ? ` a ${c!.painWhere}` : ""}`);
  const race = events.filter((e) => e.priority !== "C" && e.date > D).sort((a, b) => a.date.localeCompare(b.date))[0];
  const raceInDays = race && daysBetween(D, race.date) <= 6 ? daysBetween(D, race.date) : undefined;
  if (raceInDays !== undefined) reasons.push(`mancano ${raceInDays} giorni a ${race!.name}`);
  const swim = plan.find((p) => p.date === addDays(D, 1) && KEY_SWIM.includes(p.type) && p.status === "programmato");
  if (swim) reasons.push(`${day(addDays(D, 1))} ${swim.title.toLowerCase()} in acqua`);
  return { reasons, legsTired: Boolean(prevHard) || tired || legPain, legsFresh: Boolean(tomorrow), raceInDays, upperBeforeSwim: Boolean(swim) };
}

const MODERATE = "carico moderato: 3 ripetizioni di margine (RPE 6)";

/** Sostituto più leggero per un esercizio di gambe. */
function legSwap(e: GymExercise, ctx: SwapContext): { to: GymExercise | null; why: string } | null {
  const n = e.name;
  if (ctx.raceInDays !== undefined && ctx.raceInDays <= 4) return { to: null, why: `a ${ctx.raceInDays} giorni dalla gara niente lavoro di gambe` };
  if (/salt|jump|pliometr|balz/i.test(n)) return { to: null, why: "i salti pesano sui tendini già stanchi: oggi si saltano" };
  if (/squat/i.test(n) && !/bulgar/i.test(n)) {
    return { to: { name: "Leg press", sets: Math.max(2, e.sets - 1), reps: "10-12", restSec: 90, note: MODERATE }, why: "la pressa lavora sugli stessi muscoli con meno carico su schiena e stabilizzatori" };
  }
  if (/affond|bulgar|lunge/i.test(n)) {
    return { to: { name: "Step up basso", sets: 2, reps: "10 per gamba", restSec: 60, note: "corpo libero o manubri leggeri" }, why: "gli affondi hanno tanta fase eccentrica: aumentano l'indolenzimento" };
  }
  if (/stacc|deadlift/i.test(n)) {
    return { to: { name: "Ponte glutei", sets: Math.max(2, e.sets - 1), reps: "12", restSec: 60, note: MODERATE }, why: "lo stacco carica i femorali già provati dalla corsa; il ponte lavora sui glutei senza stressarli" };
  }
  if (/calf|polpacc/i.test(n)) {
    return { to: { name: "Calf raise seduto", sets: 2, reps: "15", restSec: 45, note: "leggero, movimento completo" }, why: "i polpacci recuperano lentamente dopo corsa veloce o lunga" };
  }
  if (isLegExercise(e)) {
    const r = reduceExercise(e, 0.6, 0.8);
    return { to: { ...r, note: e.loadKg ? undefined : MODERATE }, why: "stesso esercizio, meno serie e carico −20%" };
  }
  return null;
}

/** Sostituto per spalle e dorsali pesanti il giorno prima del nuoto di qualità. */
function upperSwap(e: GymExercise): { to: GymExercise; why: string } | null {
  if (/military|lento|overhead|spinte sopra|press sopra/i.test(e.name)) return { to: { name: "Alzate laterali", sets: 2, reps: "15", restSec: 45, note: "leggere" }, why: "le spalle devono arrivare fresche in acqua" };
  if (/trazion|pull ?up/i.test(e.name)) return { to: { name: "Lat machine", sets: 3, reps: "10", restSec: 60, note: MODERATE }, why: "dorsali meno affaticati per la bracciata di domani" };
  return null;
}

export function proposeSwaps(w: Pick<PlannedWorkout, "structure">, ctx: SwapContext): Swap[] {
  const legsReason = ctx.legsTired || ctx.legsFresh || ctx.raceInDays !== undefined;
  const out: Swap[] = [];
  w.structure.main.forEach((s, index) => {
    const e = s.exercise;
    if (!e) return;
    const r = legsReason && isLegExercise(e) ? legSwap(e, ctx) : ctx.upperBeforeSwim ? upperSwap(e) : null;
    if (r) out.push({ index, from: e, to: r.to, why: r.why });
  });
  return out;
}

/** Applica le sostituzioni scelte alla struttura della seduta. */
export function applySwaps(w: PlannedWorkout, chosen: Swap[]): Pick<PlannedWorkout, "structure" | "durationMin" | "objective"> {
  const byIndex = new Map(chosen.map((s) => [s.index, s]));
  const main: WorkoutStep[] = [];
  w.structure.main.forEach((step, i) => {
    const sw = byIndex.get(i);
    if (!sw) return main.push(step);
    if (!sw.to) return;
    main.push({ label: sw.to.name, durationMin: exerciseMinutes(sw.to), rpe: [5, 6], note: `${exerciseLine(sw.to)} · al posto di ${sw.from.name.toLowerCase()}`, zone: "rpe", exercise: sw.to });
  });
  const extra = [...w.structure.warmup, ...w.structure.cooldown].reduce((t, s) => t + (s.durationMin ?? 0), 0);
  const durationMin = Math.round(extra + main.reduce((t, s) => t + (s.durationMin ?? 0), 0));
  const what = chosen.map((s) => (s.to ? `${s.from.name} → ${s.to.name}` : `senza ${s.from.name.toLowerCase()}`)).join(", ");
  return { structure: { ...w.structure, main }, durationMin, objective: `${w.objective} Adattata dal coach: ${what}.` };
}

/** Proposte già pronte da mostrare (testi), oppure null se la seduta va bene così. */
export function swapSuggestion(
  w: PlannedWorkout,
  data: { plan: PlannedWorkout[]; activities: CompletedActivity[]; events: RaceEvent[]; checkins: CheckIn[] },
): { reasons: string[]; swaps: { index: number; from: string; to: string | null; why: string }[] } | null {
  if (w.sport !== "gym" || w.status !== "programmato") return null;
  const ctx = swapContext(w, data.plan, data.activities, data.events, data.checkins);
  const swaps = proposeSwaps(w, ctx);
  if (!swaps.length) return null;
  return {
    reasons: ctx.reasons,
    swaps: swaps.map((s) => ({ index: s.index, from: `${s.from.name} ${exerciseLine(s.from)}`, to: s.to ? `${s.to.name} ${exerciseLine(s.to)}` : null, why: s.why })),
  };
}
