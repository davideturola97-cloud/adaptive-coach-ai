"use server";

import { revalidatePath } from "next/cache";
import { eventFromForm, eventRow } from "@/lib/domain/event-schema";
import { getUser } from "@/lib/supabase/server";

export type EventState = { errors?: string[]; ok?: string };

export async function addEvent(_: EventState, fd: FormData): Promise<EventState> {
  const parsed = eventFromForm(fd);
  if (!parsed.success) return { errors: [...new Set(parsed.error.issues.map((i) => i.message))] };
  const { supabase, user } = await getUser();
  if (!user) return { errors: ["Sessione scaduta: accedi di nuovo."] };
  const { error } = await supabase.from("events").insert(eventRow(parsed.data));
  if (error) return { errors: ["Salvataggio non riuscito. Riprova."] };
  revalidatePath("/", "layout");
  return { ok: `Gara "${parsed.data.name}" aggiunta.` };
}

export async function deleteEvent(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const { supabase, user } = await getUser();
  if (!user || !id) return;
  await supabase.from("events").delete().eq("id", id);
  revalidatePath("/", "layout");
}
