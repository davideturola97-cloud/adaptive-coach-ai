import "server-only";
import { todayISO } from "@/lib/dates";
import { buildDemoData, type DemoData } from "@/lib/demo/data";
import type { AthleteProfile, CompletedActivity, Level, PlannedWorkout, RaceEvent, Sport, TestResult, ValueOrigin, WorkoutStatus, WorkoutType } from "@/lib/domain/types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getUser } from "@/lib/supabase/server";

export type AppData = DemoData & { mode: "demo" | "utente"; email?: string; onboardingCompleted: boolean };

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
    equipment: p?.equipment ?? [],
    limitations: p?.limitations ?? [],
    goals: { primary: p?.goal_primary ?? "", secondary: p?.goals_secondary ?? [] },
    ftpW: p?.ftp_w ? { value: p.ftp_w, origin: p.ftp_origin as ValueOrigin, date: p.ftp_date } : undefined,
    thresholdPaceSecPerKm: p?.threshold_pace_sec ? { value: p.threshold_pace_sec, origin: p.threshold_origin as ValueOrigin, date: p.threshold_date } : undefined,
  };
}

/**
 * Dati dell'app per la richiesta corrente.
 * Con Supabase configurato legge i dati dell'utente collegato (le regole RLS limitano ogni lettura alle sue righe).
 * Senza configurazione restituisce i dati dimostrativi.
 */
export async function getAppData(): Promise<AppData> {
  if (!isSupabaseConfigured()) return { ...buildDemoData(), mode: "demo", onboardingCompleted: true };

  const { supabase, user } = await getUser();
  if (!user) throw new Error("Utente non collegato");

  const [profile, sports, events, plan, acts, tests] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("athlete_sports").select("*"),
    supabase.from("events").select("*").order("event_date"),
    supabase.from("planned_workouts").select("*").order("workout_date"),
    supabase.from("activities").select("*, feedback(*)").order("activity_date"),
    supabase.from("test_results").select("*").order("test_date"),
  ]);
  const failed = [profile, sports, events, plan, acts, tests].find((r) => r.error);
  if (failed?.error) throw new Error(`Lettura dati non riuscita: ${failed.error.message}`);

  const activities: CompletedActivity[] = (acts.data ?? []).map((a: any) => {
    const f = Array.isArray(a.feedback) ? a.feedback[0] : a.feedback;
    return {
      id: a.id, date: a.activity_date, sport: a.sport, title: a.title, durationMin: Number(a.duration_min),
      distanceKm: num(a.distance_km), avgHr: num(a.avg_hr), avgPowerW: num(a.avg_power_w), elevationM: num(a.elevation_m), source: a.source,
      feedback: f ? { rpe: f.rpe, muscleFatigue: f.muscle_fatigue, cardioFatigue: f.cardio_fatigue, sleepQuality: f.sleep_quality ?? undefined, feeling: f.feeling, pain: f.pain ?? undefined, notes: f.notes ?? undefined } : undefined,
    };
  });
  const byPlan = new Map((acts.data ?? []).filter((a: any) => a.planned_workout_id).map((a: any) => [a.planned_workout_id, a.id]));

  return {
    mode: "utente",
    email: user.email,
    onboardingCompleted: Boolean(profile.data?.onboarding_completed),
    today: todayISO(),
    athlete: mapProfile(profile.data, sports.data ?? []),
    events: (events.data ?? []).map((e: any): RaceEvent => ({ id: e.id, name: e.name, date: e.event_date, sport: e.sport, distanceKm: num(e.distance_km), priority: e.priority })),
    plan: (plan.data ?? []).map((p: any): PlannedWorkout => ({
      id: p.id, date: p.workout_date, sport: p.sport, type: p.workout_type as WorkoutType, title: p.title, objective: p.objective,
      durationMin: p.duration_min, distanceKm: num(p.distance_km), intensity: p.intensity, structure: p.structure,
      technicalTips: p.technical_tips, safetyNotes: p.safety_notes, status: p.status as WorkoutStatus, completedActivityId: byPlan.get(p.id),
    })),
    activities,
    tests: (tests.data ?? []).map((t: any): TestResult => ({ id: t.id, date: t.test_date, sport: t.sport, kind: t.kind, rawValue: t.raw_value?.text ?? "", derived: t.derived ?? [] })),
  };
}
