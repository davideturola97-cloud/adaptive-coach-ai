import { beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlannedWorkout } from "@/lib/domain/types";
import { open, seal } from "./crypto";
import { hasActivityScope, authorizeUrl } from "./oauth";
import { importFromStrava, stravaStatus } from "./service";
import type { Tokens } from "./client";

const SECRET = "segreto-di-prova";
const NOW = Date.parse("2026-11-03T12:00:00Z");

/** Supabase finto: una riga di collegamento, record_activity che registra le chiamate. */
function fakeSupabase(row: Record<string, unknown> | null) {
  const calls = { rpc: [] as unknown[], updates: [] as Record<string, unknown>[] };
  const supabase = {
    from: () => ({
      select: () => ({ maybeSingle: async () => ({ data: row, error: null }) }),
      update: (v: Record<string, unknown>) => ({ eq: async () => { calls.updates.push(v); if (row) Object.assign(row, v); return { error: null }; } }),
    }),
    rpc: async (_: string, args: unknown) => { calls.rpc.push(args); return { data: `id-${calls.rpc.length}`, error: null }; },
  } as unknown as SupabaseClient;
  return { supabase, calls };
}

const run = (id: number, day: string) => ({
  id, name: `Corsa ${id}`, sport_type: "Run", start_date: `${day}T06:00:00Z`, start_date_local: `${day}T07:00:00Z`,
  moving_time: 2400, elapsed_time: 2500, distance: 8000, has_heartrate: true, average_heartrate: 150,
});

/** Strava finto: elenco attività, dettagli con intertempi, rinnovo del token. */
function fakeStrava(opts: { list: object[]; limitAfter?: number }) {
  const seen: string[] = [];
  let details = 0;
  const f = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    seen.push(`${init?.method ?? "GET"} ${u.replace("https://www.strava.com", "")}`);
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
    if (u.endsWith("/oauth/token")) return json({ access_token: "nuovo", refresh_token: "r2", expires_at: NOW / 1000 + 21600 });
    if (u.includes("/athlete/activities")) return json(opts.list);
    if (u.includes("/activities/")) {
      details++;
      if (opts.limitAfter !== undefined && details > opts.limitAfter) return json({}, 429);
      const id = Number(u.split("/activities/")[1].split("?")[0]);
      const base = opts.list.find((a) => (a as { id: number }).id === id);
      return json({ ...base, splits_metric: [1, 2, 3].map((n) => ({ split: n, distance: 1000, moving_time: 300, average_heartrate: 150 })) });
    }
    return json({}, 404);
  }) as typeof fetch;
  return { f, seen };
}

beforeEach(() => {
  process.env.STRAVA_CLIENT_ID = "12345";
  process.env.STRAVA_CLIENT_SECRET = SECRET;
});

describe("token cifrati", () => {
  it("si leggono solo con il segreto giusto", () => {
    const t = { accessToken: "a", refreshToken: "b", expiresAt: 1 };
    const sealed = seal(t, SECRET);
    expect(sealed).not.toContain('"a"');
    expect(open(sealed, SECRET)).toEqual(t);
    expect(open(sealed, "altro")).toBeNull();
    expect(open(sealed.slice(0, -2) + "xx", SECRET)).toBeNull(); // manomesso
  });
});

describe("autorizzazione Strava", () => {
  it("chiede solo la lettura e controlla i permessi concessi", () => {
    const u = new URL(authorizeUrl("12345", "https://app.example", "st"));
    expect(u.searchParams.get("scope")).toBe("read,activity:read_all");
    expect(u.searchParams.get("redirect_uri")).toBe("https://app.example/api/strava/callback");
    expect(hasActivityScope("read,activity:read_all")).toBe(true);
    expect(hasActivityScope("read")).toBe(false);
  });
});

describe("importazione", () => {
  it("rinnova il token scaduto, importa con intertempi e collega il programma", async () => {
    const row = { athlete_id: 7, athlete_name: "Davide", token_ciphertext: seal({ accessToken: "vecchio", refreshToken: "r1", expiresAt: NOW / 1000 - 10 } satisfies Tokens, SECRET), last_import_at: null };
    const { supabase, calls } = fakeSupabase(row);
    const { f, seen } = fakeStrava({ list: [run(1, "2026-11-01"), run(2, "2026-11-02")] });
    const plan = [{ id: "p1", sport: "run", date: "2026-11-02", status: "programmato" } as PlannedWorkout];
    const r = await importFromStrava(supabase, { activities: [], plan }, f, NOW);

    expect(r.error).toBeUndefined();
    expect(r.imported.map((a) => [a.title, a.linked])).toEqual([["Corsa 1", false], ["Corsa 2", true]]);
    expect(seen[0]).toBe("POST /oauth/token"); // rinnovo prima di tutto
    expect(seen[1]).toContain(`after=${Math.floor((NOW - 30 * 864e5) / 1000)}`); // primo import: 30 giorni
    const first = calls.rpc[0] as { p_activity: Record<string, unknown>; p_feedback: unknown };
    expect(first.p_activity).toMatchObject({ source: "strava", external_id: "strava:1", duration_min: 40, distance_km: 8, avg_hr: 150 });
    expect((first.p_activity.splits as unknown[]).length).toBe(3);
    expect(first.p_feedback).toBeNull();
    // Token nuovo salvato cifrato, ultimo import aggiornato.
    expect(open<Tokens>(String(calls.updates[0].token_ciphertext), SECRET)?.accessToken).toBe("nuovo");
    expect(row.last_import_at).toBe(new Date(NOW).toISOString());
  });

  it("al limite di Strava si ferma e riparte dall'ultima importata", async () => {
    const row = { athlete_id: 7, athlete_name: "", token_ciphertext: seal({ accessToken: "a", refreshToken: "r", expiresAt: NOW / 1000 + 9999 }, SECRET), last_import_at: "2026-10-20T00:00:00Z" };
    const { supabase } = fakeSupabase(row);
    const { f, seen } = fakeStrava({ list: [run(1, "2026-10-25"), run(2, "2026-10-26"), run(3, "2026-10-27")], limitAfter: 1 });
    const r = await importFromStrava(supabase, { activities: [], plan: [] }, f, NOW);
    expect(r.imported).toHaveLength(1);
    expect(r.remaining).toBe(2);
    expect(seen[0]).toContain(`after=${Math.floor((Date.parse("2026-10-20T00:00:00Z") - 3 * 864e5) / 1000)}`); // 3 giorni di margine
    expect(row.last_import_at).toBe("2026-10-25T06:00:00Z");
  });

  it("collegamento non leggibile o assente: messaggio chiaro, nessuna chiamata", async () => {
    const { supabase } = fakeSupabase({ athlete_id: 7, athlete_name: "", token_ciphertext: seal({}, "vecchio-segreto"), last_import_at: null });
    const { f, seen } = fakeStrava({ list: [] });
    expect((await importFromStrava(supabase, { activities: [], plan: [] }, f, NOW)).error).toMatch(/ricollegalo/);
    expect(seen).toEqual([]);
    expect(await stravaStatus(supabase)).toMatchObject({ connected: true, broken: true });
    expect(await stravaStatus(fakeSupabase(null).supabase)).toEqual({ configured: true, connected: false });
    delete process.env.STRAVA_CLIENT_SECRET;
    expect(await stravaStatus(supabase)).toEqual({ configured: false, connected: false });
  });
});
