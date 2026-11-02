"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppData } from "@/lib/data/repository";
import { activityFromForm, splitsFromForm } from "@/lib/domain/activity-schema";
import { sportLabel } from "@/lib/domain/sports";
import { getUser } from "@/lib/supabase/server";
import { dedupeKey, findSimilar, matchPlanned } from "@/lib/training/feedback";
import { formatDuration } from "@/lib/training/formulas";

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
    },
    p_feedback: {
      rpe: f.rpe,
      muscle_fatigue: f.muscleFatigue,
      cardio_fatigue: f.cardioFatigue,
      sleep_quality: f.sleepQuality ?? null,
      feeling: f.feeling,
      pain: f.pain ?? null,
      notes: f.notes ?? null,
    },
  });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return { duplicate: "Esiste già un'attività quasi identica (stesso sport, giorno e durata). È la stessa?" };
    return { errors: ["Salvataggio non riuscito. Hai eseguito lo script 0004_activities.sql su Supabase?"] };
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
