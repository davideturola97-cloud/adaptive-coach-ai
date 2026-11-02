"use server";

import { revalidatePath } from "next/cache";
import { runCoach } from "@/lib/ai/coach";
import { aiConfig } from "@/lib/ai/config";
import { limitMessage, type Usage } from "@/lib/ai/limits";
import { AiError, openAiClient } from "@/lib/ai/openai";
import { ALLOWED_IMAGE, type Extraction, MAX_IMAGE_BYTES, readScreenshot } from "@/lib/ai/screenshot";
import { getAppData } from "@/lib/data/repository";
import type { Disruption, RescheduleResult } from "@/lib/planning/reschedule";
import { getUser } from "@/lib/supabase/server";

export interface CoachMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  proposals?: { disruption: Disruption; result: RescheduleResult } | null;
  createdAt: string;
}

async function usageToday(): Promise<Usage> {
  const { supabase } = await getUser();
  const { data } = await supabase.from("ai_usage").select("requests, input_tokens, output_tokens, images").eq("day", new Date().toISOString().slice(0, 10)).maybeSingle();
  return { requests: data?.requests ?? 0, inputTokens: data?.input_tokens ?? 0, outputTokens: data?.output_tokens ?? 0, images: data?.images ?? 0 };
}

const aiErrorText = (e: unknown) => (e instanceof AiError ? e.message : "Qualcosa è andato storto con il coach. Riprova tra poco.");

export async function sendCoachMessage(conversationId: string | null, text: string): Promise<{ conversationId: string; messages: CoachMessage[] } | { error: string }> {
  const message = text.trim().slice(0, 2000);
  if (!message) return { error: "Scrivi un messaggio." };
  const cfg = aiConfig();
  if (!cfg) return { error: "Il coach AI non è ancora attivo: manca la chiave OpenAI sul computer che fa girare l'app." };

  const data = await getAppData();
  if (data.mode === "demo") return { error: "Il coach AI funziona con il tuo account, non in modalità dimostrativa." };
  const { supabase, user } = await getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };

  const limit = limitMessage(await usageToday(), cfg.limits);
  if (limit) return { error: limit };

  // Conversazione: esistente (solo se dell'utente, lo garantisce RLS) o nuova.
  let convId = conversationId;
  if (convId) {
    const { data: c } = await supabase.from("coach_conversations").select("id").eq("id", convId).maybeSingle();
    if (!c) convId = null;
  }
  if (!convId) {
    const { data: c, error } = await supabase.from("coach_conversations").insert({ title: message.slice(0, 80) }).select("id").single();
    if (error || !c) return { error: "Non riesco a salvare la conversazione. Hai eseguito lo script 0006_coach_ai.sql su Supabase?" };
    convId = c.id as string;
  }
  const { data: past } = await supabase.from("coach_messages").select("role, content").eq("conversation_id", convId).order("created_at", { ascending: false }).limit(12);
  const history = (past ?? []).reverse().map((m) => ({ role: m.role as "user" | "assistant", content: String(m.content) }));

  let turn;
  try {
    turn = await runCoach({ client: openAiClient(cfg.apiKey), model: cfg.model, data, history, message });
  } catch (e) {
    return { error: aiErrorText(e) };
  }
  await supabase.rpc("ai_usage_add", { p_input: turn.usage.input, p_output: turn.usage.output, p_images: 0 });

  const { data: saved } = await supabase
    .from("coach_messages")
    .insert([
      { conversation_id: convId, role: "user", content: message },
      { conversation_id: convId, role: "assistant", content: turn.reply.slice(0, 8000), proposals: turn.proposals ?? null },
    ])
    .select("id, role, content, proposals, created_at");
  await supabase.from("coach_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
  revalidatePath("/coach");
  return {
    conversationId: convId,
    messages: (saved ?? []).map((m) => ({ id: m.id, role: m.role, content: m.content, proposals: m.proposals, createdAt: m.created_at })),
  };
}

export async function deleteConversation(id: string): Promise<void> {
  const { supabase, user } = await getUser();
  if (!user) return;
  await supabase.from("coach_conversations").delete().eq("id", id);
  revalidatePath("/coach");
}

/** Legge uno screenshot di un'attività. L'immagine non viene salvata: si analizza e si scarta. */
export async function analyzeScreenshot(dataUrl: string): Promise<{ extraction: Extraction } | { error: string }> {
  const cfg = aiConfig();
  if (!cfg) return { error: "La lettura degli screenshot richiede la chiave OpenAI. Puoi inserire l'attività a mano." };
  if (typeof dataUrl !== "string" || !ALLOWED_IMAGE.test(dataUrl)) return { error: "Formato non supportato: carica una foto JPG, PNG o WEBP." };
  if (dataUrl.length * 0.75 > MAX_IMAGE_BYTES) return { error: "Immagine troppo grande (massimo 2,5 MB)." };

  const data = await getAppData();
  if (data.mode === "demo") return { error: "La lettura degli screenshot funziona con il tuo account, non in modalità dimostrativa." };
  const { supabase, user } = await getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };
  const limit = limitMessage(await usageToday(), cfg.limits, true);
  if (limit) return { error: limit };

  try {
    const { extraction, usage } = await readScreenshot({ client: openAiClient(cfg.apiKey), model: cfg.visionModel, dataUrl, today: data.today });
    await supabase.rpc("ai_usage_add", { p_input: usage.input, p_output: usage.output, p_images: 1 });
    if (!extraction) return { error: "Non sono riuscito a leggere l'immagine. Prova con uno screenshot più nitido o inserisci a mano." };
    if (!extraction.e_attivita) return { error: "Non vedo un'attività sportiva in questa immagine." };
    return { extraction };
  } catch (e) {
    return { error: aiErrorText(e) };
  }
}
