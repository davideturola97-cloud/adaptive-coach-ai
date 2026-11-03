"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/supabase/server";
import { DAYS, MUSCLE_GROUPS } from "@/lib/training/gym-schedule";
import type { GymDay } from "@/lib/domain/types";
import { parseExercises } from "@/lib/training/gym-parse";

export type GymState = { error?: string; saved?: boolean };

const KEYS = new Set(MUSCLE_GROUPS.map((m) => m.key));
/** Salva la scheda: per ogni giorno gruppi (solo quelli dell'elenco), durata ed esercizi. */
export async function saveGymSchedule(_: GymState, fd: FormData): Promise<GymState> {
  const schedule: GymDay[] = [];
  for (const day of DAYS) {
    const groups = fd.getAll(`g_${day}`).map(String).filter((g) => KEYS.has(g));
    const exercises = parseExercises(fd.get(`ex_${day}`), day);
    if (typeof exercises === "string") return { error: exercises };
    if (!groups.length && !exercises.length) continue;
    const dur = Math.round(Number(fd.get(`d_${day}`)) || 60);
    schedule.push({ day, groups: [...new Set(groups)].slice(0, 6), durationMin: Math.min(120, Math.max(20, dur)), ...(exercises.length && { exercises }) });
  }
  const { supabase, user } = await getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };
  const { error } = await supabase.from("profiles").update({ gym_schedule: schedule }).eq("user_id", user.id);
  if (error) return { error: "Salvataggio non riuscito. Hai eseguito lo script 0010_gym_schedule.sql su Supabase?" };
  revalidatePath("/", "layout");
  return { saved: true };
}
