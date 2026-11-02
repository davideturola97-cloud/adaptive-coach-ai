/**
 * Verifica le regole di sicurezza (Row Level Security) dello schema su un Postgres in memoria (PGlite).
 * Simula le parti di Supabase che servono: schema auth, auth.uid() e i ruoli anon/authenticated.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "fs";
import path from "path";
import { beforeAll, describe, expect, it } from "vitest";

const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB = "22222222-2222-2222-2222-222222222222";

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`;

let db: PGlite;

async function as(user: string | null, sql: string, params: unknown[] = []) {
  await db.exec("reset role");
  await db.exec(user ? `set role authenticated; set request.jwt.claim.sub = '${user}';` : "set role anon; set request.jwt.claim.sub = '';");
  try {
    return await db.query<Record<string, unknown>>(sql, params);
  } finally {
    await db.exec("reset role; reset request.jwt.claim.sub;");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  await db.exec(readFileSync(path.join(__dirname, "migrations/0001_schema.sql"), "utf8"));
  await db.exec(`insert into auth.users (id, email) values ('${ALICE}', 'a@example.com'), ('${BOB}', 'b@example.com');`);
});

describe("registrazione", () => {
  it("crea un profilo vuoto per ogni nuovo utente", async () => {
    const r = await db.query("select user_id from public.profiles order by user_id");
    expect(r.rows).toHaveLength(2);
  });
});

describe("profili", () => {
  it("ogni utente vede solo il proprio profilo", async () => {
    const r = await as(ALICE, "select user_id from public.profiles");
    expect(r.rows).toEqual([{ user_id: ALICE }]);
  });

  it("un utente non può modificare il profilo di un altro", async () => {
    await as(BOB, "update public.profiles set display_name = 'hack' where user_id = $1", [ALICE]);
    const r = await db.query<{ display_name: string }>("select display_name from public.profiles where user_id = $1", [ALICE]);
    expect(r.rows[0].display_name).toBe("");
  });

  it("modifica del proprio profilo con valori validi", async () => {
    await as(ALICE, "update public.profiles set display_name = 'Alice', weight_kg = 60 where user_id = $1", [ALICE]);
    const r = await as(ALICE, "select display_name, weight_kg from public.profiles");
    expect(r.rows[0]).toMatchObject({ display_name: "Alice" });
  });

  it("rifiuta valori fuori intervallo", async () => {
    await expect(as(ALICE, "update public.profiles set weight_kg = 5 where user_id = $1", [ALICE])).rejects.toThrow();
  });

  it("gli anonimi non leggono nulla", async () => {
    await expect(as(null, "select * from public.profiles")).rejects.toThrow(/permission denied/);
  });
});

describe("dati di allenamento", () => {
  it("le righe nuove appartengono a chi le crea e restano private", async () => {
    await as(ALICE, "insert into public.events (name, event_date, sport) values ('Mezza', '2027-03-01', 'run')");
    expect((await as(ALICE, "select name from public.events")).rows).toHaveLength(1);
    expect((await as(BOB, "select name from public.events")).rows).toHaveLength(0);
  });

  it("non si possono creare righe a nome di un altro utente", async () => {
    await expect(
      as(BOB, "insert into public.events (user_id, name, event_date, sport) values ($1, 'x', '2027-03-01', 'run')", [ALICE]),
    ).rejects.toThrow(/row-level security/);
  });

  it("non si possono cancellare le righe di un altro", async () => {
    await as(BOB, "delete from public.events");
    expect((await as(ALICE, "select name from public.events")).rows).toHaveLength(1);
  });

  it("sport non supportati vengono rifiutati", async () => {
    await expect(as(ALICE, "insert into public.events (name, event_date, sport) values ('x', '2027-03-01', 'curling')")).rejects.toThrow();
  });

  it("un feedback non può agganciarsi all'attività di un altro", async () => {
    const act = await as(ALICE, "insert into public.activities (activity_date, sport, duration_min, source) values ('2026-11-01', 'run', 40, 'manuale') returning id");
    const id = act.rows[0].id;
    await expect(
      as(BOB, "insert into public.feedback (activity_id, rpe, muscle_fatigue, cardio_fatigue, feeling) values ($1, 5, 2, 2, 'buono')", [id]),
    ).rejects.toThrow();
    await as(ALICE, "insert into public.feedback (activity_id, rpe, muscle_fatigue, cardio_fatigue, feeling) values ($1, 5, 2, 2, 'buono')", [id]);
    expect((await as(ALICE, "select rpe from public.feedback")).rows).toEqual([{ rpe: 5 }]);
  });

  it("i duplicati della stessa attività vengono rifiutati", async () => {
    const q = "insert into public.activities (activity_date, sport, duration_min, source, dedupe_key) values ('2026-11-01', 'run', 40, 'manuale', 'run|2026-11-01T07:00|40')";
    await as(ALICE, q);
    await expect(as(ALICE, q)).rejects.toThrow();
  });
});

describe("cancellazione account", () => {
  it("elimina l'utente e tutti i suoi dati, senza toccare gli altri", async () => {
    await as(BOB, "insert into public.events (name, event_date, sport) values ('Granfondo', '2027-05-01', 'bike')");
    await as(ALICE, "select public.delete_my_account()");
    const users = await db.query("select id from auth.users");
    expect(users.rows).toEqual([{ id: BOB }]);
    const left = await db.query<{ n: number }>("select count(*)::int as n from public.events where user_id = $1", [ALICE]);
    expect(left.rows[0].n).toBe(0);
    expect((await as(BOB, "select name from public.events")).rows).toHaveLength(1);
  });

  it("gli anonimi non possono chiamarla", async () => {
    await expect(as(null, "select public.delete_my_account()")).rejects.toThrow();
  });
});
