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

/**
 * Ricontrolla i test massimali già programmati: se una gara A o B li rende troppo vicini,
 * li sposta nel primo giorno adatto (o li rimette "da programmare" se non ce n'è uno).
 * Restituisce una frase per ogni test spostato.
 */
export async function reconcileTests(supabase: SupabaseClient): Promise<string[]> {
  const { getAppData } = await import("./repository");
  const { athlete, events, plannedTests, today } = await getAppData();
  const { TEST_CATALOG, pickTestDay, raceConflict } = await import("@/lib/training/tests");
  const { formatDayMonth } = await import("@/lib/dates");
  const moved: string[] = [];
  const busy = plannedTests.filter((t) => t.status === "programmato" && t.dueDate).map((t) => t.dueDate!);

  for (const t of plannedTests) {
    if (t.status !== "programmato" || !t.dueDate || !TEST_CATALOG[t.kind].maximal) continue;
    const race = raceConflict(t.dueDate, events);
    if (!race) continue;
    const day = pickTestDay(today, athlete.availableDays, events, busy.filter((d) => d !== t.dueDate));
    const patch = day ? { due_date: day } : { status: "proposto", due_date: null };
    const { error } = await supabase.from("planned_tests").update(patch).eq("id", t.id);
    if (error) continue;
    if (day) busy.push(day);
    moved.push(
      day
        ? `${TEST_CATALOG[t.kind].label} spostato al ${formatDayMonth(day, false)}: era troppo vicino a ${race.name}.`
        : `${TEST_CATALOG[t.kind].label} tolto dal calendario: era troppo vicino a ${race.name} e non c'è un giorno adatto nelle prossime settimane.`,
    );
  }
  return moved;
}
