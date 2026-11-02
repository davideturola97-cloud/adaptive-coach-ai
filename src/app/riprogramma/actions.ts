"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAppData } from "@/lib/data/repository";
import { type Disruption, proposeReschedule, type RescheduleResult, violations } from "@/lib/planning/reschedule";
import { getUser } from "@/lib/supabase/server";

const disruptionSchema = z.object({
  kind: z.enum(["nessun_allenamento", "poco_tempo", "stanco", "dolore", "malato", "viaggio", "saltata"]),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  availableMin: z.number().int().min(0).max(600).optional(),
  painSport: z.enum(["swim", "bike", "run", "gym"]).optional(),
  painSevere: z.boolean().optional(),
  workoutId: z.string().max(64).optional(),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/** Le proposte si calcolano sempre sul server, dai dati salvati: il browser manda solo la descrizione dell'imprevisto. */
async function compute(d: Disruption) {
  const data = await getAppData();
  const input = { today: data.today, athlete: data.athlete, plan: data.plan, events: data.events, disruption: d };
  return { data, input, result: proposeReschedule(input) };
}

export async function getProposals(raw: Disruption): Promise<RescheduleResult | { error: string }> {
  const d = disruptionSchema.safeParse(raw);
  if (!d.success) return { error: "Dati dell'imprevisto non validi." };
  if (d.data.to && d.data.to < d.data.from) return { error: "La data di fine è prima di quella di inizio." };
  const { result } = await compute(d.data);
  return result;
}

export async function applyProposal(raw: Disruption, proposalId: string): Promise<{ ok: string; versionId?: string } | { error: string }> {
  const d = disruptionSchema.safeParse(raw);
  if (!d.success) return { error: "Dati dell'imprevisto non validi." };
  const { data, input, result } = await compute(d.data);
  if (data.mode === "demo") return { error: "In modalità dimostrativa il programma non si modifica." };
  const p = result.proposals.find((x) => x.id === proposalId);
  if (!p) return { error: "La proposta non è più valida: il programma è cambiato. Ricomincia." };
  if (!p.changes.length) return { ok: "Va bene, nessuna modifica." };
  // Controllo finale delle regole di sicurezza prima di scrivere.
  if (violations(data.plan, p.changes, input).length) return { error: "La proposta non rispetta più le regole di sicurezza. Ricomincia." };

  const { supabase, user } = await getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };
  const changes = p.changes.map((c) => (c.op === "elimina" ? { op: "elimina", id: c.id } : { op: c.op, id: c.id, patch: c.patch }));
  const { data: versionId, error } = await supabase.rpc("apply_plan_changes", { p_changes: changes, p_reason: `${p.title} (${raw.kind.replace("_", " ")})` });
  if (error) return { error: /registrate/.test(error.message) ? "Alcune sedute sono già state registrate: ricomincia." : "Modifica non riuscita. Hai eseguito lo script 0005_reschedule.sql su Supabase?" };
  revalidatePath("/", "layout");
  return { ok: "Fatto: programma aggiornato.", versionId: String(versionId) };
}

export async function undoVersion(versionId: string): Promise<{ ok: string } | { error: string }> {
  const { supabase, user } = await getUser();
  if (!user) return { error: "Sessione scaduta: accedi di nuovo." };
  const { error } = await supabase.rpc("undo_plan_version", { p_version: versionId });
  if (error) {
    if (/registrate/.test(error.message)) return { error: "Non si può annullare: alcune di quelle sedute sono già state registrate come fatte." };
    if (/ultima/.test(error.message)) return { error: "Si può annullare solo l'ultima modifica." };
    if (/già annullata/.test(error.message)) return { error: "Questa modifica è già stata annullata." };
    return { error: "Annullamento non riuscito." };
  }
  revalidatePath("/", "layout");
  return { ok: "Modifica annullata: il programma è tornato com'era." };
}
