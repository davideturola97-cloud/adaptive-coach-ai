import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompletedActivity, PlannedWorkout } from "@/lib/domain/types";
import { deauthorize, freshTokens, getActivity, listActivities, StravaError, type Tokens } from "./client";
import { stravaConfig } from "./config";
import { open, seal } from "./crypto";
import { toImported } from "./mapping";
import { planImport } from "./plan-import";

export interface StravaStatus {
  configured: boolean;
  connected: boolean;
  athleteName?: string;
  lastImportAt?: string;
  /** Il token non si decifra più (Client Secret cambiato): va ricollegato. */
  broken?: boolean;
}

/** Al primo import: le attività degli ultimi 30 giorni. Dopo: dall'ultimo import, con 3 giorni di margine per i caricamenti in ritardo. */
const FIRST_IMPORT_DAYS = 30;
const OVERLAP_DAYS = 3;
/** Dettagli (intertempi) chiesti per import: Strava permette 100 letture ogni 15 minuti. */
const MAX_PER_RUN = 40;

type Row = { athlete_id: number; athlete_name: string; token_ciphertext: string; last_import_at: string | null };

async function loadRow(supabase: SupabaseClient): Promise<Row | null> {
  const { data, error } = await supabase.from("strava_connections").select("athlete_id, athlete_name, token_ciphertext, last_import_at").maybeSingle();
  if (error) return null; // tabella assente (migrazione 0009 non eseguita) = non collegato
  return data as Row | null;
}

export async function stravaStatus(supabase: SupabaseClient): Promise<StravaStatus> {
  const cfg = stravaConfig();
  if (!cfg) return { configured: false, connected: false };
  const row = await loadRow(supabase);
  if (!row) return { configured: true, connected: false };
  return {
    configured: true,
    connected: true,
    athleteName: row.athlete_name || undefined,
    lastImportAt: row.last_import_at ?? undefined,
    broken: open<Tokens>(row.token_ciphertext, cfg.clientSecret) === null,
  };
}

export async function saveConnection(supabase: SupabaseClient, userId: string, tokens: Tokens, athlete: { id: number; name: string }, scope: string) {
  const cfg = stravaConfig()!;
  return supabase.from("strava_connections").upsert({
    user_id: userId,
    athlete_id: athlete.id,
    athlete_name: athlete.name.slice(0, 120),
    scope: scope.slice(0, 200),
    token_ciphertext: seal(tokens, cfg.clientSecret),
  });
}

export interface ImportResult {
  imported: { id: string; title: string; date: string; sport: string; linked: boolean }[];
  alreadyLogged: { title: string; date: string }[];
  unsupported: number;
  remaining: number;
  error?: string;
}

export async function importFromStrava(
  supabase: SupabaseClient,
  data: { activities: CompletedActivity[]; plan: PlannedWorkout[] },
  f: typeof fetch = fetch,
  now = Date.now(),
): Promise<ImportResult> {
  const empty: ImportResult = { imported: [], alreadyLogged: [], unsupported: 0, remaining: 0 };
  const cfg = stravaConfig();
  if (!cfg) return { ...empty, error: "Strava non è configurato sul server (STRAVA_CLIENT_ID e STRAVA_CLIENT_SECRET)." };
  const row = await loadRow(supabase);
  if (!row) return { ...empty, error: "Collega prima Strava dal Profilo." };
  const stored = open<Tokens>(row.token_ciphertext, cfg.clientSecret);
  if (!stored) return { ...empty, error: "Il collegamento a Strava non è più valido: scollegalo e ricollegalo dal Profilo." };

  try {
    const { tokens, refreshed } = await freshTokens(f, cfg, stored, now);
    if (refreshed) await supabase.from("strava_connections").update({ token_ciphertext: seal(tokens, cfg.clientSecret) }).eq("athlete_id", row.athlete_id);

    const sinceMs = row.last_import_at ? Date.parse(row.last_import_at) - OVERLAP_DAYS * 864e5 : now - FIRST_IMPORT_DAYS * 864e5;
    const after = Math.floor(sinceMs / 1000);
    const summaries = [];
    for (let page = 1; page <= 3; page++) {
      const batch = await listActivities(f, tokens.accessToken, after, page);
      summaries.push(...batch);
      if (batch.length < 100) break;
    }

    const plan = planImport(summaries, data.activities, data.plan);
    const batch = plan.toImport.slice(0, MAX_PER_RUN);
    const result: ImportResult = { ...empty, alreadyLogged: plan.alreadyLogged, unsupported: plan.unsupported.length, remaining: plan.toImport.length - batch.length };
    let cursor: string | null = null;

    for (const item of batch) {
      // Il dettaglio porta intertempi e vasche; se non arriva, si importa il riepilogo.
      let a = item;
      try {
        const detail = toImported(await getActivity(f, tokens.accessToken, item.stravaId));
        if (detail) a = { ...item, ...detail };
      } catch (e) {
        if (e instanceof StravaError && e.kind === "limite") {
          result.remaining += batch.length - result.imported.length;
          break;
        }
      }
      const { data: id, error } = await supabase.rpc("record_activity", {
        p_activity: {
          activity_date: a.date,
          started_at: a.startedAt,
          sport: a.sport,
          title: a.title || "Attività Strava",
          duration_min: a.durationMin,
          distance_km: a.distanceKm ?? null,
          avg_hr: a.avgHr ?? null,
          avg_power_w: a.avgPowerW ?? null,
          elevation_m: a.elevationM ?? null,
          source: "strava",
          dedupe_key: null,
          planned_workout_id: a.plannedId ?? null,
          splits: a.splits ?? null,
          external_id: a.externalId,
        },
        p_feedback: null,
      });
      if (error) {
        if (/duplicate|unique/i.test(error.message)) continue; // importata nel frattempo
        return { ...result, error: "Salvataggio non riuscito. Hai eseguito lo script 0009_strava.sql su Supabase?" };
      }
      result.imported.push({ id: String(id), title: a.title, date: a.date, sport: a.sport, linked: Boolean(a.plannedId) });
      cursor = a.startedAt;
    }

    // Se restano attività, il prossimo import riparte dall'ultima importata; altrimenti da adesso.
    const last = result.remaining > 0 && cursor ? cursor : new Date(now).toISOString();
    await supabase.from("strava_connections").update({ last_import_at: last }).eq("athlete_id", row.athlete_id);
    return result;
  } catch (e) {
    return { ...empty, error: e instanceof StravaError ? e.message : "Importazione non riuscita. Riprova tra poco." };
  }
}

/** Scollega: revoca l'accesso su Strava (se possibile) e cancella i token. */
export async function disconnect(supabase: SupabaseClient, f: typeof fetch = fetch) {
  const cfg = stravaConfig();
  const row = await loadRow(supabase);
  if (cfg && row) {
    const t = open<Tokens>(row.token_ciphertext, cfg.clientSecret);
    if (t) {
      try {
        const { tokens } = await freshTokens(f, cfg, t);
        await deauthorize(f, tokens.accessToken);
      } catch {
        // Anche se Strava non risponde, i token si cancellano comunque qui sotto.
      }
    }
  }
  await supabase.from("strava_connections").delete().not("athlete_id", "is", null);
}
