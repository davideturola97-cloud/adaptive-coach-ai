"use server";

import { revalidatePath } from "next/cache";
import { reconcileTests } from "@/lib/data/mutations";
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
  const moved = await reconcileTests(supabase);
  revalidatePath("/", "layout");
  return { ok: [`Gara "${parsed.data.name}" aggiunta.`, ...moved].join(" ") };
}

export async function deleteEvent(fd: FormData) {
  const id = String(fd.get("id") ?? "");
  const { supabase, user } = await getUser();
  if (!user || !id) return;
  await supabase.from("events").delete().eq("id", id);
  revalidatePath("/", "layout");
}
