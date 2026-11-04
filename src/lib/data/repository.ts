import "server-only";
import { paceReference, withRunPaces } from "@/lib/training/run-paces";
import type { CheckIn } from "@/lib/training/readiness";
import { addDays, todayISO } from "@/lib/dates";
import { buildDemoData, type DemoData } from "@/lib/demo/data";
import type { AthleteProfile, CompletedActivity, Level, PlannedTest, PlannedWorkout, RaceEvent, Sport, TestResult, ValueOrigin, WorkoutStatus, WorkoutType } from "@/lib/domain/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

export type Readiness = { flagged: boolean; doctorCleared: boolean; date: string } | null;
export type AppData = DemoData & {
  mode: "demo" | "utente";
  email?: string;
  onboardingCompleted: boolean;
  readiness: Readiness;
  /** Controlli del mattino degli ultimi 14 giorni, dal più recente. */
  checkins: CheckIn[];
  /** Lunedì dell'ultima settimana rivista dal coach. */
  reviewedWeek?: string;
};

/* eslint-disable @typescript-eslint/no-explicit-any -- le righe arrivano da Supabase senza tipi generati */
const num = (v: any) => (v === null || v === undefined ? undefined : Number(v));

function mapProfile(p: any, sports: any[]): AthleteProfile {
  return {
    name: p?.display_name || "Atleta",
    birthDate: p?.birth_date ?? undefined,
    sex: p?.sex ?? undefined,
    heightCm: num(p?.height_cm),
    weightKg: num(p?.weight_kg),
    sports: sports.map((s) => ({ sport: s.sport as Sport, level: s.level as Level, yearsExperience: Number(s.years_experience), weeklyVolume: s.weekly_volume || undefined })),
    weeklyHoursAvailable: num(p?.weekly_hours_available),
    availableDays: p?.available_days ?? [],
    maxSessionMin: num(p?.max_session_min),
    longDays: p?.long_days ?? [],
    longSessionMaxMin: num(p?.long_session_max_min),
    sportDays: p?.sport_days ?? {},
    gymSchedule: Array.isArray(p?.gym_schedule) && p.gym_schedule.length ? p.gym_schedule : undefined,
    equipment: p?.equipment ?? [],
    limitations: p?.limitations ?? [],
    goals: { primary: p?.goal_primary ?? "", secondary: p?.goals_secondary ?? [] },
    swim: sports.some((s) => s.sport === "swim")
      ? { poolLengthM: p?.swim_pool_m ?? undefined, openWater: Boolean(p?.swim_open_water), wetsuit: Boolean(p?.swim_wetsuit), strokes: p?.swim_strokes ?? [] }
      : undefined,
    cssPaceSecPer100m: p?.css_pace_sec ? { value: p.css_pace_sec, origin: p.css_origin as ValueOrigin, date: p.css_date } : undefined,
    ftpW: p?.ftp_w ? { value: p.ftp_w, origin: p.ftp_origin as ValueOrigin, date: p.ftp_date } : undefined,
    thresholdPaceSecPerKm: p?.threshold_pace_sec ? { value: p.threshold_pace_sec, origin: p.threshold_origin as ValueOrigin, date: p.threshold_date } : undefined,
  };
}

/**
 * Dati dell'app per la richiesta corrente.
 * Con Supabase configurato legge i dati dell'utente collegato (le regole RLS limitano ogni lettura alle sue righe).
 * Senza configurazione restituisce i dati dimostrativi.
 */
/**
 * Dati dell'app. Le sedute di corsa ancora da fare ricevono i passi al km per ogni fase,
 * calcolati al momento dalla forma attuale (test o previsioni dagli allenamenti).
 */
export async function getAppData(): Promise<AppData> {
  const d = await loadAppData();
  const ref = paceReference(d.athlete, d.activities, d.plan, d.today);
  if (!ref) return d;
  return { ...d, plan: d.plan.map((w) => (w.status === "programmato" ? withRunPaces(w, ref) : w)) };
}

async function loadAppData(): Promise<AppData> {
  if (!isSupabaseConfigured()) return { ...buildDemoData(), mode: "demo", onboardingCompleted: true, readiness: { flagged: false, doctorCleared: false, date: todayISO() }, checkins: [] };

  const { supabase, user } = await getUser();
  if (!user) throw new Error("Utente non collegato");

  const [profile, sports, events, plan, acts, tests, plannedTests, readiness] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("athlete_sports").select("*"),
    supabase.from("events").select("*").order("event_date"),
    supabase.from("planned_workouts").select("*").order("workout_date"),
    supabase.from("activities").select("*, feedback(*)").order("activity_date"),
    supabase.from("test_results").select("*").order("test_date"),
    supabase.from("planned_tests").select("*").order("created_at"),
    supabase.from("readiness_checks").select("flagged, doctor_cleared, created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  // Tabelle recenti: se la migrazione non è ancora stata eseguita, l'app funziona lo stesso senza.
  const checkinRows = await supabase.from("daily_checkins").select("*").gte("checkin_date", addDays(todayISO(), -14)).order("checkin_date", { ascending: false });
  const failed = [profile, sports, events, plan, acts, tests, plannedTests].find((r) => r.error);
  if (failed?.error) throw new Error(`Lettura dati non riuscita: ${failed.error.message}`);

  const activities: CompletedActivity[] = (acts.data ?? []).map((a: any) => {
    const f = Array.isArray(a.feedback) ? a.feedback[0] : a.feedback;
    return {
      id: a.id, date: a.activity_date, sport: a.sport, title: a.title, durationMin: Number(a.duration_min),
      distanceKm: num(a.distance_km), avgHr: num(a.avg_hr), avgPowerW: num(a.avg_power_w), elevationM: num(a.elevation_m), source: a.source,
      splits: Array.isArray(a.splits) ? a.splits : undefined,
      externalId: a.external_id ?? undefined,
      gymLog: Array.isArray(a.gym_log) ? a.gym_log : undefined,
      feedbackSkipped: Boolean(a.feedback_skipped),
      feedback: f ? { rpe: f.rpe, muscleFatigue: f.muscle_fatigue ?? undefined, cardioFatigue: f.cardio_fatigue ?? undefined, sleepQuality: f.sleep_quality ?? undefined, feeling: f.feeling ?? undefined, pain: f.pain ?? undefined, notes: f.notes ?? undefined } : undefined,
    };
  });
  const byPlan = new Map((acts.data ?? []).filter((a: any) => a.planned_workout_id).map((a: any) => [a.planned_workout_id, a.id]));

  return {
    mode: "utente",
    email: user.email,
    onboardingCompleted: Boolean(profile.data?.onboarding_completed),
    readiness: readiness.data ? { flagged: readiness.data.flagged, doctorCleared: readiness.data.doctor_cleared, date: String(readiness.data.created_at).slice(0, 10) } : null,
    today: todayISO(),
    checkins: (checkinRows.error ? [] : checkinRows.data ?? []).map((c: any): CheckIn => ({ date: c.checkin_date, sleep: c.sleep, fatigue: c.fatigue, pain: c.pain, painWhere: c.pain_where ?? undefined })),
    reviewedWeek: profile.data?.plan_reviewed_week ?? undefined,
    athlete: mapProfile(profile.data, sports.data ?? []),
    events: (events.data ?? []).map((e: any): RaceEvent => ({
      id: e.id, name: e.name, date: e.event_date, dateTentative: Boolean(e.date_tentative), kind: e.kind ?? "singolo",
      sport: e.sport ?? undefined, distanceKm: num(e.distance_km), triFormat: e.tri_format ?? undefined,
      legs: e.kind === "triathlon" ? { swimKm: Number(e.swim_km), bikeKm: Number(e.bike_km), runKm: Number(e.run_km) } : undefined,
      priority: e.priority,
      goalTimeSec: num(e.goal_time_sec),
    })),
    plan: (plan.data ?? []).map((p: any): PlannedWorkout => ({
      id: p.id, date: p.workout_date, sport: p.sport, type: p.workout_type as WorkoutType, title: p.title, objective: p.objective,
      durationMin: p.duration_min, distanceKm: num(p.distance_km), intensity: p.intensity, structure: p.structure,
      technicalTips: p.technical_tips, safetyNotes: p.safety_notes, status: p.status as WorkoutStatus, completedActivityId: byPlan.get(p.id),
      skipReason: p.skip_reason ?? undefined,
    })),
    activities,
    tests: (tests.data ?? []).map((t: any): TestResult => ({ id: t.id, date: t.test_date, sport: t.sport, kind: t.kind, rawValue: t.raw_value?.text ?? "", derived: t.derived ?? [] })),
    plannedTests: (plannedTests.data ?? []).map((t: any): PlannedTest => ({ id: t.id, sport: t.sport, kind: t.kind, status: t.status, dueDate: t.due_date ?? undefined, reason: t.reason })),
  };
}

export interface PlanVersion {
  id: string;
  createdAt: string;
  reason: string;
  kind: "generazione" | "modifica" | "annullamento";
  undone: boolean;
  changes: number;
}

/** Ultime versioni del programma (generazioni, modifiche, annullamenti). */
export async function getPlanVersions(limit = 20): Promise<PlanVersion[]> {
  if (!isSupabaseConfigured()) return [];
  const { supabase, user } = await getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("plan_versions")
    .select("id, created_at, reason, kind, undone_at, workouts")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map((v: any) => ({
    id: v.id,
    createdAt: v.created_at,
    reason: v.reason,
    kind: v.kind ?? "generazione",
    undone: Boolean(v.undone_at),
    changes: Array.isArray(v.workouts) ? v.workouts.length : 0,
  }));
}

export interface CoachConversation {
  id: string;
  title: string;
  updatedAt: string;
}

export async function getCoachConversations(): Promise<CoachConversation[]> {
  if (!isSupabaseConfigured()) return [];
  const { supabase, user } = await getUser();
  if (!user) return [];
  const { data } = await supabase.from("coach_conversations").select("id, title, updated_at").order("updated_at", { ascending: false }).limit(20);
  return (data ?? []).map((c: any) => ({ id: c.id, title: c.title, updatedAt: c.updated_at }));
}

export async function getCoachMessages(conversationId: string) {
  if (!isSupabaseConfigured()) return [];
  const { supabase, user } = await getUser();
  if (!user) return [];
  const { data } = await supabase.from("coach_messages").select("id, role, content, proposals, created_at").eq("conversation_id", conversationId).order("created_at").limit(200);
  return (data ?? []).map((m: any) => ({ id: m.id as string, role: m.role as "user" | "assistant", content: m.content as string, proposals: m.proposals ?? null, createdAt: m.created_at as string }));
}

export async function getAiUsageToday() {
  if (!isSupabaseConfigured()) return null;
  const { supabase, user } = await getUser();
  if (!user) return null;
  const { data } = await supabase.from("ai_usage").select("requests, input_tokens, output_tokens, images").eq("day", new Date().toISOString().slice(0, 10)).maybeSingle();
  return { requests: data?.requests ?? 0, tokens: (data?.input_tokens ?? 0) + (data?.output_tokens ?? 0), images: data?.images ?? 0 };
}
