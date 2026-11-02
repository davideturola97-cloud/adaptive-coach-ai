"use server";

import { revalidatePath } from "next/cache";
import { getAppData } from "@/lib/data/repository";
import { generatePlan, type PlanDraft } from "@/lib/planning/engine";
import { getUser } from "@/lib/supabase/server";

export type PreviewState = { draft?: PlanDraft; weeks?: number; error?: string; saved?: string };

/** Il programma si calcola sempre sul server dai dati salvati: il browser non può mandarne uno suo. */
async function draftFor(weeks: number, allowDemo = false) {
  const data = await getAppData();
  if (data.mode === "demo" && !allowDemo) return { error: "In modalità dimostrativa il programma non si salva." as const };
  if (!data.athlete.sports.length) return { error: "Completa prima il profilo con i tuoi sport." as const };
  const draft = generatePlan({ today: data.today, startDate: data.today, athlete: data.athlete, events: data.events, tests: data.plannedTests, weeks });
  return { draft };
}

const weeksFrom = (fd: FormData) => Math.min(20, Math.max(4, Number(fd.get("weeks")) || 12));

export async function previewPlan(_: PreviewState, fd: FormData): Promise<PreviewState> {
  const weeks = weeksFrom(fd);
  const r = await draftFor(weeks, true);
  return "error" in r ? { error: r.error } : { draft: r.draft, weeks };
}

export async function savePlan(_: PreviewState, fd: FormData): Promise<PreviewState> {
  const weeks = weeksFrom(fd);
  const r = await draftFor(weeks);
  if ("error" in r) return { error: r.error };
  const { supabase, user } = await getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };
  const { error } = await supabase.rpc("replace_future_plan", {
    p_from: r.draft.startDate,
    p_workouts: r.draft.workouts,
    p_reason: `Programma generato per ${weeks} settimane`,
  });
  if (error) return { error: "Salvataggio non riuscito. Hai eseguito lo script 0003_plan.sql su Supabase?" };
  revalidatePath("/", "layout");
  return { saved: `Programma salvato: ${r.draft.workouts.length} sedute in ${weeks} settimane. Lo trovi nel Calendario.` };
}
