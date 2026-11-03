/**
 * Previsioni dei tempi di gara (5 km, 10 km, mezza, maratona) dagli allenamenti di corsa svolti.
 * Sono STIME: vanno mostrate come "stimato", con intervallo e affidabilità. Formule e limiti in docs/FORMULE.md.
 *
 * Metodo:
 * 1. Prestazioni di riferimento degli ultimi 12 settimane: corse intere e, dagli intertempi, i tratti
 *    consecutivi più veloci da 3, 5, 10 e 21,1 km. Più il ritmo di soglia del test, se c'è.
 * 2. Ogni riferimento si proietta sulla distanza di gara con Riegel. Salendo di distanza l'esponente cresce
 *    se il volume settimanale è basso e, per mezza e maratona, se il lungo più lungo è corto.
 * 3. Si tiene la proiezione più veloce tra i riferimenti abbastanza vicini come distanza (almeno 1/8 della gara).
 * 4. Affidabilità: alta solo con uno sforzo massimale o quasi (test, gara, RPE ≥ 8) recente e vicino alla distanza.
 */
import type { AthleteProfile, CompletedActivity, PlannedWorkout, WorkoutType } from "@/lib/domain/types";
import { addDays } from "@/lib/dates";
import { riegel } from "./formulas";

export const TARGETS = [
  { key: "5k", label: "5 km", km: 5 },
  { key: "10k", label: "10 km", km: 10 },
  { key: "half", label: "Mezza maratona", km: 21.0975 },
  { key: "marathon", label: "Maratona", km: 42.195 },
] as const;
export type TargetKey = (typeof TARGETS)[number]["key"];

export interface Reference {
  km: number;
  timeSec: number;
  date: string;
  /** Testo per l'atleta: "corsa del 28/10 (10 km in 48:30)". */
  label: string;
  /** Sforzo massimale o quasi: test, gara, RPE ≥ 8. */
  hard: boolean;
  activityId?: string;
}

export interface Prediction {
  key: TargetKey;
  label: string;
  km: number;
  timeSec: number;
  paceSec: number;
  lowSec: number;
  highSec: number;
  confidence: "alta" | "media" | "bassa";
  basedOn: Reference;
  notes: string[];
}

export interface PredictionReport {
  predictions: Prediction[];
  weeklyKm: number;
  longestKm: number;
  notes: string[];
  /** Variazione rispetto a 4 settimane fa, in secondi (negativo = più veloce). */
  trend?: Partial<Record<TargetKey, number>>;
}

const WINDOW_DAYS = 84;
const HARD_TYPES: WorkoutType[] = ["test_corsa"];

const fmtDay = (d: string) => d.split("-").reverse().slice(0, 2).join("/");
export function formatRaceTime(sec: number): string {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}
const kmText = (km: number) => `${(Math.round(km * 10) / 10).toLocaleString("it-IT")} km`;

/** Tratti consecutivi più veloci dagli intertempi (solo parziali da ~1 km con passo). */
export function bestSegments(splits: CompletedActivity["splits"], lengths = [3, 5, 10, 21.0975]): { km: number; timeSec: number }[] {
  const s = (splits ?? []).filter((x) => x.paceSec && x.km >= 0.95 && x.km <= 1.05);
  if (s.length < 3 || s.length !== (splits ?? []).filter((x) => x.km >= 0.95).length) return [];
  const out: { km: number; timeSec: number }[] = [];
  for (const L of lengths) {
    const n = Math.floor(L);
    if (n > s.length || n < 3) continue;
    let best = Infinity;
    let bestKm = 0;
    for (let i = 0; i + n <= s.length; i++) {
      const part = s.slice(i, i + n);
      const t = part.reduce((a, x) => a + x.paceSec! * x.km, 0);
      if (t < best) {
        best = t;
        bestKm = part.reduce((a, x) => a + x.km, 0);
      }
    }
    if (Number.isFinite(best)) out.push({ km: bestKm, timeSec: best });
  }
  return out;
}

/** Riferimenti dalle corse delle ultime 12 settimane (fino alla data indicata). */
export function references(
  activities: CompletedActivity[],
  plan: Pick<PlannedWorkout, "type" | "completedActivityId">[],
  athlete: Pick<AthleteProfile, "thresholdPaceSecPerKm">,
  asOf: string,
): Reference[] {
  const from = addDays(asOf, -WINDOW_DAYS);
  const refs: Reference[] = [];
  for (const a of activities) {
    if (a.sport !== "run" || a.date > asOf || a.date < from || !a.distanceKm || a.distanceKm < 3) continue;
    const timeSec = a.durationMin * 60;
    const pace = timeSec / a.distanceKm;
    if (pace < 150 || pace > 600) continue; // camminate o dati sbagliati
    const type = plan.find((p) => p.completedActivityId === a.id)?.type;
    const hard = (a.feedback?.rpe ?? 0) >= 8 || (type !== undefined && HARD_TYPES.includes(type));
    refs.push({ km: a.distanceKm, timeSec, date: a.date, hard, activityId: a.id, label: `corsa del ${fmtDay(a.date)} (${kmText(a.distanceKm)} in ${formatRaceTime(timeSec)}${a.feedback ? `, RPE ${a.feedback.rpe}` : ""})` });
    for (const seg of bestSegments(a.splits)) {
      if (seg.km >= a.distanceKm - 0.5) continue; // coincide con la corsa intera
      refs.push({ km: seg.km, timeSec: seg.timeSec, date: a.date, hard, activityId: a.id, label: `${kmText(seg.km)} più veloci della corsa del ${fmtDay(a.date)} (${formatRaceTime(seg.timeSec)})` });
    }
  }
  // Test: ritmo di soglia ≈ ritmo dei 10 km × 1,04 (vedi thresholdPaceFromRun).
  const thr = athlete.thresholdPaceSecPerKm;
  if (thr && thr.date <= asOf && thr.date >= from) {
    const tenK = (thr.value / 1.04) * 10;
    refs.push({ km: 10, timeSec: tenK, date: thr.date, hard: true, label: `test del ${fmtDay(thr.date)} (soglia ${formatRaceTime(thr.value)}/km)` });
  }
  return refs;
}

/** Esponente di Riegel: 1,06 di base, più alto se il volume è basso o il lungo è corto rispetto alla gara. */
export function exponentFor(targetKm: number, fromKm: number, weeklyKm: number, longestKm: number): number {
  if (targetKm <= fromKm) return 1.06;
  let e = 1.06;
  if (weeklyKm < 20) e += 0.03;
  else if (weeklyKm < 35) e += 0.015;
  if (targetKm > 30) e += longestKm < 21 ? 0.03 : longestKm < 28 ? 0.015 : 0;
  else if (targetKm > 15) e += longestKm < 12 ? 0.015 : 0;
  return e;
}

function predictAt(activities: CompletedActivity[], plan: Pick<PlannedWorkout, "type" | "completedActivityId">[], athlete: Pick<AthleteProfile, "thresholdPaceSecPerKm">, asOf: string) {
  const refs = references(activities, plan, athlete, asOf);
  const runs28 = activities.filter((a) => a.sport === "run" && a.date <= asOf && a.date > addDays(asOf, -28));
  const weeklyKm = Math.round((runs28.reduce((t, a) => t + (a.distanceKm ?? 0), 0) / 4) * 10) / 10;
  const longestKm = Math.max(0, ...activities.filter((a) => a.sport === "run" && a.date <= asOf && a.date > addDays(asOf, -56)).map((a) => a.distanceKm ?? 0));
  const predictions: Prediction[] = [];
  for (const t of TARGETS) {
    let best: { time: number; ref: Reference } | null = null;
    for (const r of refs) {
      if (r.km < t.km / 8) continue; // troppo corto per proiettare così lontano
      const time = riegel(r.timeSec, r.km, t.km, exponentFor(t.km, r.km, weeklyKm, longestKm));
      if (!best || time < best.time) best = { time, ref: r };
    }
    if (!best) continue;
    const r = best.ref;
    const ageDays = (Date.parse(asOf) - Date.parse(r.date)) / 864e5;
    const near = r.km >= t.km / 4;
    let confidence: Prediction["confidence"] = r.hard && ageDays <= 60 && near ? "alta" : r.hard || near ? "media" : "bassa";
    const notes: string[] = [];
    if (!r.hard) notes.push("Nessuno sforzo massimale recente: probabilmente sei più veloce di così.");
    if (t.km > 30 && longestKm < 28) {
      confidence = "bassa";
      notes.push(`Il lungo più lungo delle ultime 8 settimane è ${kmText(longestKm)}: per la maratona servono lunghi da 28–32 km.`);
    } else if (t.km > 15 && longestKm < 15) {
      if (confidence === "alta") confidence = "media";
      notes.push(`Il lungo più lungo è ${kmText(longestKm)}: per la mezza aiutano lunghi da 15–18 km.`);
    }
    const spread = confidence === "alta" ? 0.02 : confidence === "media" ? 0.04 : 0.07;
    predictions.push({
      key: t.key, label: t.label, km: t.km, timeSec: best.time, paceSec: best.time / t.km,
      lowSec: best.time * (1 - spread / 2), highSec: best.time * (1 + spread), confidence, basedOn: r, notes,
    });
  }
  return { predictions, weeklyKm, longestKm };
}

export function predictRaces(
  activities: CompletedActivity[],
  plan: Pick<PlannedWorkout, "type" | "completedActivityId">[],
  athlete: Pick<AthleteProfile, "thresholdPaceSecPerKm">,
  today: string,
): PredictionReport {
  const now = predictAt(activities, plan, athlete, today);
  const before = predictAt(activities, plan, athlete, addDays(today, -28));
  const notes: string[] = [];
  if (!now.predictions.length) notes.push("Servono corse di almeno 3 km con distanza e durata negli ultimi 3 mesi.");
  if (now.weeklyKm < 20 && now.predictions.length) notes.push(`Volume attuale ${kmText(now.weeklyKm)} a settimana: per le distanze lunghe le previsioni sono più prudenti.`);
  const trend: Partial<Record<TargetKey, number>> = {};
  for (const p of now.predictions) {
    const b = before.predictions.find((x) => x.key === p.key);
    if (b) trend[p.key] = Math.round(p.timeSec - b.timeSec);
  }
  return { predictions: now.predictions, weeklyKm: now.weeklyKm, longestKm: now.longestKm, notes, trend };
}
