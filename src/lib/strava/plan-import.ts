/**
 * Scelta di cosa importare (funzione pura): niente doppioni, niente sport non seguiti,
 * niente attività già registrate a mano o da screenshot, collegamento alle sedute del programma.
 */
import type { CompletedActivity, PlannedWorkout } from "@/lib/domain/types";
import { findSimilar } from "@/lib/training/feedback";
import { toImported, type ImportedActivity, type StravaActivity } from "./mapping";

export interface ImportPlan {
  toImport: (ImportedActivity & { plannedId?: string; stravaId: number })[];
  alreadyImported: number;
  alreadyLogged: { title: string; date: string }[];
  unsupported: string[];
}

export function planImport(summaries: StravaActivity[], existing: (CompletedActivity & { externalId?: string })[], plan: PlannedWorkout[]): ImportPlan {
  const known = new Set(existing.map((a) => a.externalId).filter(Boolean));
  const used = new Set<string>();
  const out: ImportPlan = { toImport: [], alreadyImported: 0, alreadyLogged: [], unsupported: [] };
  const sorted = [...summaries].sort((a, b) => (a.start_date < b.start_date ? -1 : 1));
  for (const s of sorted) {
    const a = toImported(s);
    if (!a) {
      out.unsupported.push(s.sport_type ?? s.type ?? "?");
      continue;
    }
    if (known.has(a.externalId)) {
      out.alreadyImported++;
      continue;
    }
    // Registrata a mano o da screenshot: non la duplico.
    const manual = existing.filter((e) => !e.externalId);
    if (findSimilar(manual, a.sport, a.date, a.durationMin).length) {
      out.alreadyLogged.push({ title: a.title, date: a.date });
      continue;
    }
    const planned = plan.find((p) => p.sport === a.sport && p.date === a.date && p.status === "programmato" && !used.has(p.id));
    if (planned) used.add(planned.id);
    out.toImport.push({ ...a, plannedId: planned?.id, stravaId: s.id });
  }
  return out;
}
