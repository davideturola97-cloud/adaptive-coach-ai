import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SPORT_KEYS } from "@/lib/domain/sports";
import type { ProfileInput } from "@/lib/domain/profile-schema";

/** Salva profilo e sport praticati. Restituisce un messaggio d'errore leggibile, oppure null. */
export async function persistProfile(supabase: SupabaseClient, userId: string, p: ProfileInput, extra: Record<string, unknown> = {}): Promise<string | null> {
  const swimOn = p.swim.enabled;
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: p.displayName,
      birth_date: p.birthDate ?? null,
      sex: p.sex ?? null,
      height_cm: p.heightCm ?? null,
      weight_kg: p.weightKg ?? null,
      weekly_hours_available: p.weeklyHoursAvailable ?? null,
      max_session_min: p.maxSessionMin ?? null,
      available_days: p.availableDays,
      equipment: p.equipment,
      limitations: p.limitations,
      goal_primary: p.goalPrimary,
      goals_secondary: p.goalsSecondary,
      swim_pool_m: swimOn ? (p.swimDetails.poolLengthM ?? null) : null,
      swim_open_water: swimOn && p.swimDetails.openWater,
      swim_wetsuit: swimOn && p.swimDetails.wetsuit,
      swim_strokes: swimOn ? p.swimDetails.strokes : [],
      ...extra,
    })
    .eq("user_id", userId);
  if (error) return "Salvataggio del profilo non riuscito. Controlla i valori e riprova.";

  const rows = SPORT_KEYS.filter((k) => p[k].enabled).map((k) => ({
    user_id: userId,
    sport: k,
    level: p[k].level,
    years_experience: p[k].yearsExperience ?? 0,
    weekly_volume: p[k].weeklyVolume,
  }));
  const removed = SPORT_KEYS.filter((k) => !p[k].enabled);
  if (rows.length) {
    const up = await supabase.from("athlete_sports").upsert(rows);
    if (up.error) return "Salvataggio degli sport non riuscito.";
  }
  if (removed.length) {
    const del = await supabase.from("athlete_sports").delete().in("sport", removed);
    if (del.error) return "Salvataggio degli sport non riuscito.";
  }
  return null;
}
