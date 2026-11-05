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
  for (const f of ["0001_schema.sql", "0002_multisport.sql", "0003_plan.sql", "0004_activities.sql", "0005_reschedule.sql", "0006_coach_ai.sql", "0007_splits.sql", "0008_auth_throttle.sql", "0009_strava.sql", "0010_gym_schedule.sql", "0011_gym_log.sql", "0012_daily.sql", "0013_feedback_skipped.sql", "0014_quick_feedback.sql", "0015_race_goal.sql", "0016_daily_activity.sql"]) {
    await db.exec(readFileSync(path.join(__dirname, "migrations", f), "utf8"));
  }
  // Le migrazioni devono poter essere rieseguite senza errori.
  await db.exec(readFileSync(path.join(__dirname, "migrations/0002_multisport.sql"), "utf8"));
  await db.exec(readFileSync(path.join(__dirname, "migrations/0003_plan.sql"), "utf8"));
  await db.exec(readFileSync(path.join(__dirname, "migrations/0004_activities.sql"), "utf8"));
  await db.exec(readFileSync(path.join(__dirname, "migrations/0005_reschedule.sql"), "utf8"));
  await db.exec(readFileSync(path.join(__dirname, "migrations/0006_coach_ai.sql"), "utf8"));
  await db.exec(readFileSync(path.join(__dirname, "migrations/0007_splits.sql"), "utf8"));
  await db.exec(readFileSync(path.join(__dirname, "migrations/0008_auth_throttle.sql"), "utf8"));
  await db.exec(readFileSync(path.join(__dirname, "migrations/0009_strava.sql"), "utf8"));
  await db.exec(readFileSync(path.join(__dirname, "migrations/0010_gym_schedule.sql"), "utf8"));
  await db.exec(readFileSync(path.join(__dirname, "migrations/0011_gym_log.sql"), "utf8"));
  await db.exec(readFileSync(path.join(__dirname, "migrations/0012_daily.sql"), "utf8"));
  await db.exec(readFileSync(path.join(__dirname, "migrations/0013_feedback_skipped.sql"), "utf8"));
  await db.exec(readFileSync(path.join(__dirname, "migrations/0014_quick_feedback.sql"), "utf8"));
  await db.exec(readFileSync(path.join(__dirname, "migrations/0015_race_goal.sql"), "utf8"));
  await db.exec(readFileSync(path.join(__dirname, "migrations/0016_daily_activity.sql"), "utf8"));
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

describe("multisport (Milestone 3)", () => {
  it("nuoto e palestra sono sport validi", async () => {
    await as(ALICE, "insert into public.athlete_sports (user_id, sport, level) values ($1, 'swim', 'principiante'), ($1, 'gym', 'intermedio')", [ALICE]);
    expect((await as(ALICE, "select sport from public.athlete_sports order by sport")).rows).toEqual([{ sport: "gym" }, { sport: "swim" }]);
  });

  it("una gara di triathlon richiede le tre frazioni e nessuno sport singolo", async () => {
    await as(ALICE, "insert into public.events (name, event_date, kind, tri_format, swim_km, bike_km, run_km, date_tentative) values ('Ledroman', '2027-07-01', 'triathlon', 'personalizzato', 1.9, 90, 21.1, true)");
    await expect(as(ALICE, "insert into public.events (name, event_date, kind, swim_km) values ('x', '2027-07-01', 'triathlon', 1.5)")).rejects.toThrow();
    await expect(as(ALICE, "insert into public.events (name, event_date, kind) values ('x', '2027-07-01', 'singolo')")).rejects.toThrow();
  });

  it("un solo test aperto per sport", async () => {
    await as(ALICE, "insert into public.planned_tests (sport, kind) values ('swim', 'css')");
    await expect(as(ALICE, "insert into public.planned_tests (sport, kind) values ('swim', 'recente_nuoto')")).rejects.toThrow();
    await as(ALICE, "update public.planned_tests set status = 'completato' where sport = 'swim'");
    await as(ALICE, "insert into public.planned_tests (sport, kind) values ('swim', 'css')");
  });

  it("test proposti e controlli di sicurezza sono privati", async () => {
    await as(ALICE, "insert into public.readiness_checks (answers, flagged) values ('{}'::jsonb, false)");
    expect((await as(BOB, "select * from public.readiness_checks")).rows).toHaveLength(0);
    expect((await as(BOB, "select * from public.planned_tests")).rows).toHaveLength(0);
    await expect(as(null, "select * from public.planned_tests")).rejects.toThrow(/permission denied/);
  });

  it("i nuovi tipi di test sono accettati", async () => {
    await as(ALICE, "insert into public.test_results (test_date, sport, kind, raw_value) values ('2026-11-01', 'swim', 'css', '{}'::jsonb)");
  });
});

describe("programma (Milestone 4)", () => {
  const w = (date: string, title = "Corsa facile") => ({ date, sport: "run", type: "corsa_facile", title, objective: "", durationMin: 45, intensity: "Bassa", structure: { warmup: [], main: [], cooldown: [] }, technicalTips: ["a"], safetyNotes: ["b"] });

  it("sostituisce le sedute future e conserva quelle fatte", async () => {
    await as(ALICE, "insert into public.planned_workouts (workout_date, sport, workout_type, title, duration_min, status) values ('2026-11-03', 'run', 'corsa_facile', 'Fatta', 40, 'completato'), ('2026-11-05', 'run', 'corsa_facile', 'Vecchia', 40, 'programmato')");
    const r = await as(ALICE, "select public.replace_future_plan('2026-11-04', $1::jsonb, 'Generato') as id", [JSON.stringify([w("2026-11-05", "Nuova"), w("2026-11-07")])]);
    expect(r.rows[0].id).toBeTruthy();
    const rows = await as(ALICE, "select title, status from public.planned_workouts where title in ('Fatta','Vecchia','Nuova','Corsa facile') order by workout_date");
    expect(rows.rows.map((x) => x.title)).toEqual(["Fatta", "Nuova", "Corsa facile"]);
  });

  it("conserva una versione con le sedute sostituite, per poter annullare", async () => {
    const v = await as(ALICE, "select reason, jsonb_array_length(previous) as prev, is_current from public.plan_versions order by created_at desc limit 1");
    expect(v.rows[0]).toMatchObject({ reason: "Generato", prev: 1, is_current: true });
  });

  it("rifiuta sedute prima della data di partenza", async () => {
    await expect(as(ALICE, "select public.replace_future_plan('2026-11-10', $1::jsonb, 'x')", [JSON.stringify([w("2026-11-05")])])).rejects.toThrow();
  });

  it("non tocca il programma degli altri", async () => {
    await as(BOB, "insert into public.planned_workouts (workout_date, sport, workout_type, title, duration_min) values ('2026-11-20', 'bike', 'endurance', 'Di Bob', 60)");
    await as(ALICE, "select public.replace_future_plan('2026-11-01', $1::jsonb, 'Rigenerato')", [JSON.stringify([w("2026-11-21")])]);
    expect((await as(BOB, "select title from public.planned_workouts")).rows).toEqual([{ title: "Di Bob" }]);
    expect((await as(BOB, "select * from public.plan_versions")).rows).toHaveLength(0);
  });

  it("gli anonimi non possono usarla", async () => {
    await expect(as(null, "select public.replace_future_plan('2026-11-01', '[]'::jsonb, 'x')")).rejects.toThrow();
  });
});

describe("attività e feedback (Milestone 5)", () => {
  const fb = { rpe: 6, muscle_fatigue: 3, cardio_fatigue: 2, feeling: "buono", notes: "ok" };
  let planned = "";

  it("registra attività, collega la seduta e salva il feedback insieme", async () => {
    const p = await as(ALICE, "insert into public.planned_workouts (workout_date, sport, workout_type, title, duration_min) values ('2026-12-01', 'run', 'corsa_facile', 'Da fare', 45) returning id");
    planned = String(p.rows[0].id);
    const act = { activity_date: "2026-12-01", sport: "run", title: "Corsa", duration_min: 47, distance_km: 8.2, source: "manuale", dedupe_key: "run|2026-12-01|45", planned_workout_id: planned };
    await as(ALICE, "select public.record_activity($1::jsonb, $2::jsonb)", [JSON.stringify(act), JSON.stringify(fb)]);
    expect((await as(ALICE, "select status from public.planned_workouts where id = $1", [planned])).rows[0]).toEqual({ status: "completato" });
    const f = await as(ALICE, "select f.rpe from public.feedback f join public.activities a on a.id = f.activity_id where a.planned_workout_id = $1", [planned]);
    expect(f.rows).toEqual([{ rpe: 6 }]);
  });

  it("una seduta non può avere due attività", async () => {
    const act = { activity_date: "2026-12-01", sport: "run", title: "Doppia", duration_min: 30, source: "manuale", planned_workout_id: planned };
    await expect(as(ALICE, "select public.record_activity($1::jsonb, null)", [JSON.stringify(act)])).rejects.toThrow();
  });

  it("feedback non valido: niente salvato (tutto o niente)", async () => {
    const before = (await as(ALICE, "select count(*)::int as n from public.activities")).rows[0].n;
    const act = { activity_date: "2026-12-02", sport: "bike", title: "x", duration_min: 60, source: "manuale" };
    await expect(as(ALICE, "select public.record_activity($1::jsonb, $2::jsonb)", [JSON.stringify(act), JSON.stringify({ ...fb, rpe: 15 })])).rejects.toThrow();
    expect((await as(ALICE, "select count(*)::int as n from public.activities")).rows[0].n).toBe(before);
  });

  it("non si può collegare la seduta di un altro", async () => {
    const act = { activity_date: "2026-12-01", sport: "run", title: "Furbo", duration_min: 30, source: "manuale", planned_workout_id: planned };
    await expect(as(BOB, "select public.record_activity($1::jsonb, null)", [JSON.stringify(act)])).rejects.toThrow();
  });

  it("cancellando l'attività la seduta torna da fare", async () => {
    await as(ALICE, "delete from public.activities where planned_workout_id = $1", [planned]);
    expect((await as(ALICE, "select status from public.planned_workouts where id = $1", [planned])).rows[0]).toEqual({ status: "programmato" });
  });

  it("seduta saltata con motivo", async () => {
    await as(ALICE, "update public.planned_workouts set status = 'saltato', skip_reason = 'Lavoro', skipped_at = now() where id = $1", [planned]);
    expect((await as(ALICE, "select skip_reason from public.planned_workouts where id = $1", [planned])).rows[0]).toEqual({ skip_reason: "Lavoro" });
  });
});

describe("riprogrammazione e annullamento (Milestone 6)", () => {
  const patch = (date: string, title: string) => ({ date, sport: "run", type: "corsa_facile", title, objective: "", durationMin: 40, intensity: "Bassa", structure: { warmup: [], main: [], cooldown: [] }, technicalTips: [], safetyNotes: [] });
  let a = "";
  let b = "";
  let version = "";

  it("applica sposta ed elimina in un colpo solo e ne tiene traccia", async () => {
    const r = await as(ALICE, "insert into public.planned_workouts (workout_date, sport, workout_type, title, duration_min) values ('2027-01-05', 'run', 'ripetute', 'Ripetute', 55), ('2027-01-06', 'bike', 'endurance', 'Bici', 60) returning id");
    [a, b] = r.rows.map((x) => String(x.id));
    const changes = [{ op: "sposta", id: a, patch: patch("2027-01-07", "Ripetute spostate") }, { op: "elimina", id: b }];
    version = String((await as(ALICE, "select public.apply_plan_changes($1::jsonb, 'Cena di lavoro') as v", [JSON.stringify(changes)])).rows[0].v);
    const rows = await as(ALICE, "select title, workout_date::text as d from public.planned_workouts where id in ($1, $2)", [a, b]);
    expect(rows.rows).toEqual([{ title: "Ripetute spostate", d: "2027-01-07" }]);
  });

  it("annulla l'ultima modifica e ripristina le sedute com'erano", async () => {
    await as(ALICE, "select public.undo_plan_version($1)", [version]);
    const rows = await as(ALICE, "select title, workout_date::text as d from public.planned_workouts where id in ($1, $2) order by d", [a, b]);
    expect(rows.rows).toEqual([{ title: "Ripetute", d: "2027-01-05" }, { title: "Bici", d: "2027-01-06" }]);
    await expect(as(ALICE, "select public.undo_plan_version($1)", [version])).rejects.toThrow();
  });

  it("non tocca sedute già fatte o di altri", async () => {
    await as(ALICE, "update public.planned_workouts set status = 'completato' where id = $1", [a]);
    await expect(as(ALICE, "select public.apply_plan_changes($1::jsonb, 'x')", [JSON.stringify([{ op: "elimina", id: a }])])).rejects.toThrow();
    await expect(as(BOB, "select public.apply_plan_changes($1::jsonb, 'x')", [JSON.stringify([{ op: "elimina", id: b }])])).rejects.toThrow();
    expect((await as(ALICE, "select count(*)::int as n from public.planned_workouts where id = $1", [b])).rows[0].n).toBe(1);
  });

  it("rifiuta l'annullamento se una seduta è stata registrata nel frattempo", async () => {
    const v = String((await as(ALICE, "select public.apply_plan_changes($1::jsonb, 'Sposto') as v", [JSON.stringify([{ op: "sposta", id: b, patch: patch("2027-01-08", "Bici spostata") }])])).rows[0].v);
    await as(ALICE, "update public.planned_workouts set status = 'completato' where id = $1", [b]);
    await expect(as(ALICE, "select public.undo_plan_version($1)", [v])).rejects.toThrow(/registrate/);
  });

  it("anche la generazione del programma si può annullare", async () => {
    const w = [{ date: "2027-03-02", sport: "run", type: "corsa_facile", title: "Nuova", durationMin: 40, structure: {}, technicalTips: [], safetyNotes: [] }];
    const v = String((await as(ALICE, "select public.replace_future_plan('2027-03-01', $1::jsonb, 'Gen') as v", [JSON.stringify(w)])).rows[0].v);
    expect((await as(ALICE, "select count(*)::int as n from public.planned_workouts where title = 'Nuova'")).rows[0].n).toBe(1);
    await as(ALICE, "select public.undo_plan_version($1)", [v]);
    expect((await as(ALICE, "select count(*)::int as n from public.planned_workouts where title = 'Nuova'")).rows[0].n).toBe(0);
  });
});

describe("coach AI (Milestone 7)", () => {
  let conv = "";
  it("conversazioni e messaggi privati", async () => {
    conv = String((await as(ALICE, "insert into public.coach_conversations (title) values ('Cena') returning id")).rows[0].id);
    await as(ALICE, "insert into public.coach_messages (conversation_id, role, content) values ($1, 'user', 'Martedì ho una cena')", [conv]);
    expect((await as(BOB, "select * from public.coach_messages")).rows).toHaveLength(0);
    expect((await as(BOB, "select * from public.coach_conversations")).rows).toHaveLength(0);
  });
  it("non si scrive nella conversazione di un altro", async () => {
    await expect(as(BOB, "insert into public.coach_messages (conversation_id, role, content) values ($1, 'user', 'x')", [conv])).rejects.toThrow();
  });
  it("il contatore d'uso sale solo e non si può azzerare", async () => {
    await as(ALICE, "select public.ai_usage_add(1000, 200, 0)");
    await as(ALICE, "select public.ai_usage_add(-5000, -5000, -1)");
    const r = await as(ALICE, "select requests, input_tokens, output_tokens from public.ai_usage");
    expect(r.rows).toEqual([{ requests: 2, input_tokens: 1000, output_tokens: 200 }]);
    await expect(as(ALICE, "update public.ai_usage set requests = 0")).rejects.toThrow(/permission denied/);
    await expect(as(ALICE, "delete from public.ai_usage")).rejects.toThrow(/permission denied/);
    expect((await as(BOB, "select * from public.ai_usage")).rows).toHaveLength(0);
  });
});

describe("intertempi", () => {
  it("salva i parziali con l'attività", async () => {
    const splits = [{ n: 1, km: 1, paceSec: 310 }, { n: 2, km: 1, paceSec: 305 }];
    const act = { activity_date: "2026-12-03", sport: "run", title: "Con parziali", duration_min: 10.3, source: "screenshot", splits };
    await as(ALICE, "select public.record_activity($1::jsonb, null)", [JSON.stringify(act)]);
    const r = await as(ALICE, "select jsonb_array_length(splits) as n from public.activities where title = 'Con parziali'");
    expect(r.rows).toEqual([{ n: 2 }]);
  });
  it("rifiuta parziali non validi", async () => {
    await expect(as(ALICE, "insert into public.activities (activity_date, sport, duration_min, source, splits) values ('2026-12-04', 'run', 30, 'manuale', '{}'::jsonb)")).rejects.toThrow();
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

describe("limite ai tentativi di accesso", () => {
  const K1 = "a".repeat(64);
  const K2 = "b".repeat(64);
  it("conta e registra i tentativi solo tramite le funzioni", async () => {
    await as(null, "select public.auth_attempts_record($1)", [[K1, K2]]);
    await as(null, "select public.auth_attempts_record($1)", [[K1]]);
    const r = await as(null, "select public.auth_attempts_count($1, 900) as c", [[K1, K2]]);
    expect(r.rows[0].c).toEqual([2, 1]);
  });
  it("la tabella non è accessibile direttamente", async () => {
    await expect(as(null, "select * from public.auth_attempts")).rejects.toThrow();
    await expect(as(ALICE, "delete from public.auth_attempts")).rejects.toThrow();
  });
  it("rifiuta chiavi non valide o troppe chiavi", async () => {
    await expect(as(null, "select public.auth_attempts_record($1)", [["mario@example.com"]])).rejects.toThrow();
    await expect(as(null, "select public.auth_attempts_count($1, 900)", [[K1, K1, K1]])).rejects.toThrow();
  });
});

describe("Strava", () => {
  // Utenti propri: un test precedente cancella l'account di Alice.
  const CARLA = "33333333-3333-3333-3333-333333333333";
  const DARIO = "44444444-4444-4444-4444-444444444444";
  beforeAll(async () => {
    await db.exec(`insert into auth.users (id, email) values ('${CARLA}', 'c@example.com'), ('${DARIO}', 'd@example.com') on conflict do nothing;`);
  });
  const act = (ext: string) => ({ activity_date: "2026-11-01", sport: "run", title: "Corsa", duration_min: 40, source: "strava", external_id: ext });
  it("ognuno vede solo il proprio collegamento", async () => {
    await as(CARLA, "insert into public.strava_connections (athlete_id, token_ciphertext) values (1, 'x')");
    await as(DARIO, "insert into public.strava_connections (athlete_id, token_ciphertext) values (2, 'y')");
    const r = await as(DARIO, "select athlete_id from public.strava_connections");
    expect(r.rows).toEqual([{ athlete_id: 2 }]);
    await as(DARIO, "delete from public.strava_connections where user_id = $1", [CARLA]);
    expect((await db.query("select count(*)::int as c from public.strava_connections")).rows[0]).toEqual({ c: 2 });
  });
  it("la stessa attività Strava non si importa due volte", async () => {
    await as(CARLA, "select public.record_activity($1, null)", [act("strava:123")]);
    await expect(as(CARLA, "select public.record_activity($1, null)", [act("strava:123")])).rejects.toThrow();
    await as(DARIO, "select public.record_activity($1, null)", [act("strava:123")]); // un altro utente sì
  });
  it("feedback aggiunto dopo, solo sulle proprie attività", async () => {
    const fb = { rpe: 6, muscle_fatigue: 3, cardio_fatigue: 3, feeling: "buono" };
    const id = (await as(CARLA, "select id from public.activities where external_id = 'strava:123'")).rows[0].id;
    await expect(as(DARIO, "select public.add_feedback($1, $2)", [id, fb])).rejects.toThrow();
    await as(CARLA, "select public.add_feedback($1, $2)", [id, fb]);
    await as(CARLA, "select public.add_feedback($1, $2)", [id, { ...fb, rpe: 7 }]);
    const r = await as(CARLA, "select rpe from public.feedback where activity_id = $1", [id]);
    expect(r.rows).toEqual([{ rpe: 7 }]);
  });
});

describe("registro della palestra", () => {
  const EVA = "55555555-5555-5555-5555-555555555555";
  beforeAll(async () => {
    await db.exec(`insert into auth.users (id, email) values ('${EVA}', 'e@example.com') on conflict do nothing;`);
  });
  it("record_activity salva carichi e ripetizioni", async () => {
    const log = [{ name: "Squat", sets: 4, reps: "8", loadKg: 70, done: true }];
    await as(EVA, "select public.record_activity($1, null)", [{ activity_date: "2026-11-05", sport: "gym", title: "Gambe", duration_min: 60, source: "manuale", gym_log: log }]);
    const r = await as(EVA, "select gym_log from public.activities");
    expect(r.rows[0].gym_log).toEqual(log);
  });
});

describe("controllo del mattino", () => {
  const FEDE = "66666666-6666-6666-6666-666666666666";
  const GINO = "77777777-7777-7777-7777-777777777777";
  beforeAll(async () => {
    await db.exec(`insert into auth.users (id, email) values ('${FEDE}', 'f@example.com'), ('${GINO}', 'g@example.com') on conflict do nothing;`);
  });
  it("uno al giorno, visibile solo al proprietario, valori controllati", async () => {
    await as(FEDE, "insert into public.daily_checkins (checkin_date, sleep, fatigue, pain) values ('2026-11-03', 2, 4, 'leggero')");
    await expect(as(FEDE, "insert into public.daily_checkins (checkin_date, sleep, fatigue) values ('2026-11-03', 3, 3)")).rejects.toThrow();
    await expect(as(FEDE, "insert into public.daily_checkins (checkin_date, sleep, fatigue) values ('2026-11-04', 9, 3)")).rejects.toThrow();
    expect((await as(GINO, "select * from public.daily_checkins")).rows).toEqual([]);
    expect((await as(FEDE, "select sleep from public.daily_checkins")).rows).toEqual([{ sleep: 2 }]);
  });
});

describe("feedback in un tocco", () => {
  const HUGO = "88888888-8888-8888-8888-888888888888";
  beforeAll(async () => {
    await db.exec(`insert into auth.users (id, email) values ('${HUGO}', 'h@example.com') on conflict do nothing;`);
  });
  it("basta l'RPE", async () => {
    const id = (await as(HUGO, "select public.record_activity($1, $2) as id", [{ activity_date: "2026-11-05", sport: "run", title: "Corsa", duration_min: 40, source: "manuale" }, { rpe: 6 }])).rows[0].id;
    expect((await as(HUGO, "select rpe, muscle_fatigue, feeling from public.feedback where activity_id = $1", [id])).rows).toEqual([{ rpe: 6, muscle_fatigue: null, feeling: null }]);
  });
});
