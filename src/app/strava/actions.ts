"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppData } from "@/lib/data/repository";
import { disconnect, importFromStrava, type ImportResult } from "@/lib/strava/service";
import { getUser } from "@/lib/supabase/server";

export type ImportState = ImportResult | { error: string } | null;

/** Importa le nuove attività da Strava (sola lettura su Strava). */
export async function importStrava(): Promise<ImportState> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };
  const data = await getAppData();
  if (data.mode === "demo") return { error: "In modalità dimostrativa non si importa." };
  const result = await importFromStrava(supabase, data);
  if (result.imported.length) revalidatePath("/", "layout");
  return result;
}

export async function disconnectStrava() {
  const { supabase, user } = await getUser();
  if (!user) redirect("/accedi");
  await disconnect(supabase);
  revalidatePath("/", "layout");
  redirect("/profilo?strava=scollegato#strava");
}
