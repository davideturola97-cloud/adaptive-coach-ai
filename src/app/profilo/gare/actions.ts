"use server";

import { revalidatePath } from "next/cache";
import { reconcileTests } from "@/lib/data/mutations";
import { eventFromForm, eventRow } from "@/lib/domain/event-schema";
import { getUser } from "@/lib/supabase/server";
import { parseTime } from "@/lib/training/formulas";

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

/** Obiettivo di tempo scelto dall'atleta per una gara ("1:39:00" o "45:30"); vuoto = toglie l'obiettivo. */
export async function setRaceGoal(eventId: string, text: string): Promise<{ ok?: string; error?: string }> {
  const t = text.trim();
  const { supabase, user } = await getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };
  if (!/^[0-9a-f-]{36}$/.test(eventId)) return { error: "Gara non valida." };
  let sec: number | null = null;
  if (t) {
    sec = parseTime(t);
    if (!sec) return { error: "Scrivi il tempo come ore:minuti:secondi (es. 1:39:00) o minuti:secondi (es. 45:30)." };
    const { data: ev } = await supabase.from("events").select("distance_km").eq("id", eventId).maybeSingle();
    const km = Number(ev?.distance_km);
    if (km > 0) {
      const pace = sec / km;
      if (pace < 150 || pace > 600) return { error: `Con questo tempo il passo sarebbe ${Math.floor(pace / 60)}:${String(Math.round(pace % 60)).padStart(2, "0")} /km: controlla le ore e i minuti.` };
    }
  }
  const { error } = await supabase.from("events").update({ goal_time_sec: sec }).eq("id", eventId);
  if (error) return { error: "Salvataggio non riuscito. Riprova tra un minuto (il database si sta aggiornando)." };
  revalidatePath("/", "layout");
  return { ok: sec ? "Obiettivo salvato." : "Obiettivo tolto." };
}
