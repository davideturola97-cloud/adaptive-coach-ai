"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppData } from "@/lib/data/repository";
import { activityFromForm, feedbackFromForm, splitsFromForm } from "@/lib/domain/activity-schema";
import { sportLabel } from "@/lib/domain/sports";
import { getUser } from "@/lib/supabase/server";
import { dedupeKey, findSimilar, matchPlanned } from "@/lib/training/feedback";
import { formatDuration } from "@/lib/training/formulas";
import { parseGymLog } from "@/lib/training/gym-parse";
import { applySwaps, proposeSwaps, swapContext } from "@/lib/training/gym-swaps";

export type LogState = { errors?: string[]; duplicate?: string };

/** Registra un'attività (da una seduta del programma o inserita a mano) con il suo feedback. */
export async function logActivity(_: LogState, fd: FormData): Promise<LogState> {
  const parsed = activityFromForm(fd);
  if (!parsed.ok) return { errors: parsed.errors };
  const { activity: a, feedback: f } = parsed;

  const data = await getAppData();
  if (data.mode === "demo") return { errors: ["In modalità dimostrativa non si salvano attività."] };

  // Seduta da collegare: quella da cui si parte, oppure una del programma stesso giorno e sport.
  let plannedId = String(fd.get("plannedId") ?? "") || undefined;
  if (plannedId && !data.plan.some((p) => p.id === plannedId && p.status !== "completato")) plannedId = undefined;
  if (!plannedId) plannedId = matchPlanned(data.plan, a.sport, a.date)?.id;

  // Controllo duplicati, a meno che l'atleta abbia già confermato.
  if (fd.get("confirmDuplicate") !== "1") {
    const similar = findSimilar(data.activities, a.sport, a.date, a.durationMin);
    if (similar.length) {
      const s = similar[0];
      return { duplicate: `Hai già registrato ${sportLabel(s.sport).toLowerCase()} quel giorno: "${s.title || "attività"}", ${formatDuration(s.durationMin)}. È la stessa attività?` };
    }
  }

  const { supabase, user } = await getUser();
  if (!user) return { errors: ["Sessione scaduta: accedi di nuovo."] };
  const { data: id, error } = await supabase.rpc("record_activity", {
    p_activity: {
      activity_date: a.date,
      started_at: a.startTime ? `${a.date}T${a.startTime}:00` : null,
      sport: a.sport,
      title: a.title || data.plan.find((p) => p.id === plannedId)?.title || sportLabel(a.sport),
      duration_min: a.durationMin,
      distance_km: a.distanceKm ?? null,
      avg_hr: a.avgHr ?? null,
      avg_power_w: a.avgPowerW ?? null,
      elevation_m: a.elevationM ?? null,
      source: fd.get("source") === "screenshot" ? "screenshot" : "manuale",
      dedupe_key: fd.get("confirmDuplicate") === "1" ? null : dedupeKey(a.sport, a.date, a.durationMin),
      planned_workout_id: plannedId ?? null,
      splits: splitsFromForm(fd.get("splits")) ?? null,
      ...(a.sport === "gym" && parseGymLog(fd.get("gymLog")) && { gym_log: parseGymLog(fd.get("gymLog")) }),
    },
    p_feedback: {
      rpe: f.rpe,
      muscle_fatigue: f.muscleFatigue ?? null,
      cardio_fatigue: f.cardioFatigue ?? null,
      sleep_quality: f.sleepQuality ?? null,
      feeling: f.feeling ?? null,
      pain: f.pain ?? null,
      notes: f.notes ?? null,
    },
  });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return { duplicate: "Esiste già un'attività quasi identica (stesso sport, giorno e durata). È la stessa?" };
    return { errors: [fd.get("gymLog") ? "Salvataggio non riuscito. Hai eseguito lo script 0011_gym_log.sql su Supabase?" : "Salvataggio non riuscito. Hai eseguito lo script 0004_activities.sql su Supabase?"] };
  }
  revalidatePath("/", "layout");
  redirect(plannedId ? `/allenamenti/${plannedId}?salvato=1` : `/attivita/${id}?salvato=1`);
}

export type SkipState = { error?: string };

export async function skipWorkout(_: SkipState, fd: FormData): Promise<SkipState> {
  const id = String(fd.get("id") ?? "");
  const reason = [String(fd.get("reason") ?? ""), String(fd.get("note") ?? "").trim()].filter(Boolean).join(" · ").slice(0, 300);
  const { supabase, user } = await getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };
  const { error } = await supabase
    .from("planned_workouts")
    .update({ status: "saltato", skip_reason: reason || null, skipped_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "programmato");
  if (error) return { error: "Salvataggio non riuscito. Hai eseguito lo script 0004_activities.sql su Supabase?" };
  revalidatePath("/", "layout");
  return {};
}

export async function unskipWorkout(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const { supabase, user } = await getUser();
  if (!user) return;
  await supabase.from("planned_workouts").update({ status: "programmato", skip_reason: null, skipped_at: null }).eq("id", id).eq("status", "saltato");
  revalidatePath("/", "layout");
}

export async function deleteActivity(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const back = String(fd.get("back") ?? "/allenamenti");
  const { supabase, user } = await getUser();
  if (!user) return;
  await supabase.from("activities").delete().eq("id", id);
  revalidatePath("/", "layout");
  redirect(back.startsWith("/") ? back : "/allenamenti");
}

export type FeedbackState = { errors?: string[]; saved?: boolean };

/** Feedback aggiunto dopo, per le attività importate (es. da Strava) che non ce l'hanno. */
export async function addFeedback(_: FeedbackState, fd: FormData): Promise<FeedbackState> {
  const id = String(fd.get("activityId") ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return { errors: ["Attività non valida."] };
  const parsed = feedbackFromForm(fd);
  if (!parsed.ok) return { errors: parsed.errors };
  const f = parsed.feedback;
  const { supabase, user } = await getUser();
  if (!user) return { errors: ["Sessione scaduta: accedi di nuovo."] };
  const { error } = await supabase.rpc("add_feedback", {
    p_activity_id: id,
    p_feedback: {
      rpe: f.rpe, muscle_fatigue: f.muscleFatigue ?? null, cardio_fatigue: f.cardioFatigue ?? null, sleep_quality: f.sleepQuality ?? null,
      feeling: f.feeling ?? null, pain: f.pain ?? null, notes: f.notes ?? null,
    },
  });
  if (error) return { errors: ["Salvataggio non riuscito. Hai eseguito lo script 0009_strava.sql su Supabase?"] };
  revalidatePath("/", "layout");
  return { saved: true };
}

/** "Non lo ricordo": l'attività resta, ma l'app non chiede più lo sforzo percepito. */
export async function skipFeedback(activityId: string): Promise<{ ok: boolean; error?: string }> {
  if (!/^[0-9a-f-]{36}$/.test(activityId)) return { ok: false, error: "Attività non valida." };
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "Sessione scaduta: accedi di nuovo." };
  const { error } = await supabase.from("activities").update({ feedback_skipped: true }).eq("id", activityId);
  if (error) return { ok: false, error: "Non riuscito. Hai eseguito lo script 0013_feedback_skipped.sql su Supabase?" };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Sostituzioni degli esercizi scelte dall'atleta: ricalcolate sul server e applicate solo a questa seduta (annullabile). */
export async function applyGymSwaps(workoutId: string, indices: number[]): Promise<{ ok: string; versionId?: string } | { error: string }> {
  const data = await getAppData();
  if (data.mode === "demo") return { error: "In modalità dimostrativa il programma non si modifica." };
  const w = data.plan.find((p) => p.id === workoutId && p.sport === "gym" && p.status === "programmato");
  if (!w) return { error: "Seduta non trovata o già registrata." };
  const ctx = swapContext(w, data.plan, data.activities, data.events, data.checkins);
  const chosen = proposeSwaps(w, ctx).filter((s) => indices.includes(s.index));
  if (!chosen.length) return { error: "Scegli almeno una sostituzione." };
  const changed = applySwaps(w, chosen);
  const { supabase, user } = await getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };
  const patch = {
    date: w.date, sport: w.sport, type: w.type, title: w.title, objective: changed.objective, durationMin: changed.durationMin,
    intensity: w.intensity, structure: changed.structure, technicalTips: w.technicalTips, safetyNotes: w.safetyNotes, status: "programmato",
  };
  const { data: versionId, error } = await supabase.rpc("apply_plan_changes", { p_changes: [{ op: "modifica", id: w.id, patch }], p_reason: `Palestra adattata: ${chosen.map((s) => s.from.name).join(", ")}` });
  if (error) return { error: "Modifica non riuscita. Riprova." };
  revalidatePath("/", "layout");
  return { ok: "Seduta aggiornata.", versionId: String(versionId) };
}

/** RPE con un tocco su un'attività già salvata (es. importata da Strava). */
export async function quickRpe(activityId: string, rpe: number): Promise<{ ok: boolean; error?: string }> {
  if (!/^[0-9a-f-]{36}$/.test(activityId) || !Number.isInteger(rpe) || rpe < 1 || rpe > 10) return { ok: false, error: "Valore non valido." };
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "Sessione scaduta: accedi di nuovo." };
  const { error } = await supabase.rpc("add_feedback", { p_activity_id: activityId, p_feedback: { rpe } });
  if (error) return { ok: false, error: "Salvataggio non riuscito. Riprova." };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** "Fatto" con un tocco: la seduta in programma diventa un'attività con la durata prevista e l'RPE indicato. */
export async function quickDone(plannedId: string, rpe: number): Promise<{ ok: boolean; error?: string; activityId?: string }> {
  if (!Number.isInteger(rpe) || rpe < 1 || rpe > 10) return { ok: false, error: "Valore non valido." };
  const data = await getAppData();
  if (data.mode === "demo") return { ok: false, error: "In modalità dimostrativa non si salva." };
  const w = data.plan.find((p) => p.id === plannedId && p.status === "programmato" && p.date <= data.today);
  if (!w) return { ok: false, error: "Seduta non trovata, futura o già registrata." };
  // Già registrata (es. arrivata da Strava senza collegamento): non la duplico.
  const similar = findSimilar(data.activities, w.sport, w.date, w.durationMin);
  if (similar.length) return { ok: false, error: `C'è già un'attività di ${sportLabel(w.sport).toLowerCase()} quel giorno ("${similar[0].title || "attività"}"): aprila e aggiungi lì lo sforzo.` };
  const gymLog = w.structure.main.filter((s) => s.exercise).map((s) => ({ name: s.exercise!.name, sets: s.exercise!.sets, reps: s.exercise!.reps, ...(s.exercise!.loadKg !== undefined && { loadKg: s.exercise!.loadKg }), done: true }));
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "Sessione scaduta: accedi di nuovo." };
  const { data: id, error } = await supabase.rpc("record_activity", {
    p_activity: {
      activity_date: w.date, sport: w.sport, title: w.title, duration_min: w.durationMin, distance_km: w.distanceKm ?? null,
      source: "manuale", dedupe_key: dedupeKey(w.sport, w.date, w.durationMin), planned_workout_id: w.id,
      ...(gymLog.length && { gym_log: gymLog }),
    },
    p_feedback: { rpe },
  });
  if (error) return { ok: false, error: /duplicate|unique/i.test(error.message) ? "Questa seduta risulta già registrata." : "Salvataggio non riuscito. Riprova." };
  revalidatePath("/", "layout");
  return { ok: true, activityId: String(id) };
}
