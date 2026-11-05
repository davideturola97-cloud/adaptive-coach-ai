"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { applyProposal } from "@/app/riprogramma/actions";
import { getAppData } from "@/lib/data/repository";
import { proposeReschedule, type Disruption } from "@/lib/planning/reschedule";
import { weeklyReview } from "@/lib/planning/weekly-review";
import { importFromStrava, stravaStatus } from "@/lib/strava/service";
import { getUser } from "@/lib/supabase/server";
import { readinessAdvice, type CheckIn, type ReadinessAdvice } from "@/lib/training/readiness";
import { paceReference } from "@/lib/training/run-paces";

export interface TodayProposal {
  id: string;
  title: string;
  summary: string;
}
export type CheckinState = { error?: string; advice?: ReadinessAdvice; proposal?: TodayProposal } | null;

const checkinSchema = z.object({
  sleep: z.coerce.number().int().min(1).max(5),
  fatigue: z.coerce.number().int().min(1).max(5),
  pain: z.enum(["nessuno", "leggero", "forte"]),
  painWhere: z.string().trim().max(100).optional(),
});

/** Consiglio del giorno e, se serve, la prima proposta concreta del motore di riprogrammazione. */
export async function adviceFor(c: CheckIn): Promise<{ advice: ReadinessAdvice; proposal?: TodayProposal }> {
  const data = await getAppData();
  const todays = data.plan.filter((p) => p.date === data.today);
  const advice = readinessAdvice(c, todays, data.checkins);
  if (!advice.disruption) return { advice };
  const r = proposeReschedule({ today: data.today, athlete: data.athlete, plan: data.plan, events: data.events, disruption: advice.disruption });
  const p = r.proposals.find((x) => x.changes.length);
  return { advice, ...(p && { proposal: { id: p.id, title: p.title, summary: p.summary } }) };
}

export async function saveCheckin(_: CheckinState, fd: FormData): Promise<CheckinState> {
  const parsed = checkinSchema.safeParse({ sleep: fd.get("sleep"), fatigue: fd.get("fatigue"), pain: fd.get("pain") || "nessuno", painWhere: fd.get("painWhere") || undefined });
  if (!parsed.success) return { error: "Rispondi a sonno e fatica." };
  const data = await getAppData();
  const c: CheckIn = { date: data.today, ...parsed.data, painWhere: parsed.data.pain === "nessuno" ? undefined : parsed.data.painWhere };
  if (data.mode === "utente") {
    const { supabase, user } = await getUser();
    if (!user) return { error: "Sessione scaduta: accedi di nuovo." };
    const { error } = await supabase.from("daily_checkins").upsert({ user_id: user.id, checkin_date: c.date, sleep: c.sleep, fatigue: c.fatigue, pain: c.pain, pain_where: c.painWhere ?? null });
    if (error) return { error: "Salvataggio non riuscito. Hai eseguito lo script 0012_daily.sql su Supabase?" };
    revalidatePath("/", "layout");
  }
  return adviceFor(c);
}

/** Applica la proposta del controllo del mattino (stesse regole e stessa conferma della riprogrammazione). */
export async function applyTodayProposal(d: Disruption, proposalId: string) {
  return applyProposal(d, proposalId);
}

/** Import automatico da Strava all'apertura dell'app, al massimo ogni 15 minuti. */
export async function autoImportStrava(): Promise<{ imported: number; waiting: number } | null> {
  const data = await getAppData();
  if (data.mode === "demo") return null;
  const { supabase, user } = await getUser();
  if (!user) return null;
  const st = await stravaStatus(supabase);
  if (!st.connected || st.broken) return null;
  if (st.lastImportAt && Date.now() - Date.parse(st.lastImportAt) < 15 * 60_000) return null;
  const r = await importFromStrava(supabase, data);
  if (r.error) return null;
  if (r.imported.length) revalidatePath("/", "layout");
  return { imported: r.imported.length, waiting: r.imported.length };
}

/** Revisione settimanale: applica la settimana proposta (ricalcolata sul server) oppure tiene quella che c'è. */
export async function applyWeeklyReview(target: string): Promise<{ ok: string; versionId?: string } | { error: string }> {
  const data = await getAppData();
  if (data.mode === "demo") return { error: "In modalità dimostrativa il programma non si modifica." };
  const ref = paceReference(data.athlete, data.activities, data.plan, data.today);
  const review = weeklyReview({ ...data, thresholdSec: ref?.thresholdSec }, true);
  if (!review || review.targetMonday !== target) return { error: "La revisione non è più valida: ricarica la pagina." };
  const { supabase, user } = await getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };
  const { data: versionId, error } = await supabase.rpc("replace_future_plan", {
    p_from: review.targetMonday,
    p_workouts: review.draft.workouts,
    p_reason: `Revisione settimanale (dal ${review.targetMonday})`,
  });
  if (error) return { error: "Aggiornamento non riuscito. Riprova." };
  await supabase.from("profiles").update({ plan_reviewed_week: review.targetMonday }).eq("user_id", user.id);
  revalidatePath("/", "layout");
  return { ok: "Settimana aggiornata.", versionId: String(versionId) };
}

export async function skipWeeklyReview(target: string): Promise<{ ok: string } | { error: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) return { error: "Data non valida." };
  const { supabase, user } = await getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };
  await supabase.from("profiles").update({ plan_reviewed_week: target }).eq("user_id", user.id);
  revalidatePath("/", "layout");
  return { ok: "Va bene: la settimana resta com'è." };
}

/** Tipo di lavoro (attività quotidiana fuori dall'allenamento), per il fabbisogno calorico. */
export async function setDailyActivity(v: string): Promise<{ ok: boolean; error?: string }> {
  if (!["sedentario", "in piedi", "fisico"].includes(v)) return { ok: false, error: "Valore non valido." };
  const { supabase, user } = await getUser();
  if (!user) return { ok: false, error: "Sessione scaduta: accedi di nuovo." };
  const { error } = await supabase.from("profiles").update({ daily_activity: v }).eq("user_id", user.id);
  if (error) return { ok: false, error: "Salvataggio non riuscito. Riprova tra un minuto." };
  revalidatePath("/", "layout");
  return { ok: true };
}
