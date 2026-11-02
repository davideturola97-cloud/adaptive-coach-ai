"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { profileFromForm } from "@/lib/domain/profile-schema";
import { getUser } from "@/lib/supabase/server";

export type ProfileState = { errors?: string[] };

export async function updateProfile(_: ProfileState, fd: FormData): Promise<ProfileState> {
  const parsed = profileFromForm(fd);
  if (!parsed.success) return { errors: [...new Set(parsed.error.issues.map((i) => i.message))] };
  const p = parsed.data;

  const { supabase, user } = await getUser();
  if (!user) return { errors: ["Sessione scaduta: accedi di nuovo."] };

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
    })
    .eq("user_id", user.id);
  if (error) return { errors: ["Salvataggio non riuscito. Controlla i valori e riprova."] };

  const rows = (["run", "bike"] as const)
    .filter((k) => p[k].enabled)
    .map((k) => ({ user_id: user.id, sport: k, level: p[k].level, years_experience: p[k].yearsExperience ?? 0, weekly_volume: p[k].weeklyVolume }));
  const removed = (["run", "bike"] as const).filter((k) => !p[k].enabled);

  if (rows.length) {
    const up = await supabase.from("athlete_sports").upsert(rows);
    if (up.error) return { errors: ["Salvataggio degli sport non riuscito."] };
  }
  if (removed.length) {
    const del = await supabase.from("athlete_sports").delete().in("sport", removed);
    if (del.error) return { errors: ["Salvataggio degli sport non riuscito."] };
  }

  revalidatePath("/", "layout");
  redirect("/profilo");
}

export async function deleteAccount(fd: FormData) {
  if (fd.get("confirm") !== "CANCELLA") redirect("/profilo?errore=conferma");
  const { supabase, user } = await getUser();
  if (!user) redirect("/accedi");
  const { error } = await supabase.rpc("delete_my_account");
  if (error) redirect("/profilo?errore=cancellazione");
  await supabase.auth.signOut();
  redirect("/accedi");
}
