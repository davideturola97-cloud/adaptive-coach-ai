import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
// @ts-expect-error modulo JavaScript senza tipi
import { migrate } from "../scripts/migrate-core.mjs";

const STUB = `create role anon nologin; create role authenticated nologin; create schema auth; create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$; grant usage on schema auth to anon, authenticated; grant usage on schema public to anon, authenticated;`;
const dir = path.join(__dirname, "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).map((name) => ({ name, sql: readFileSync(path.join(dir, name), "utf8") }));
// Come pg: query() con parametri o una sola lettura restituisce le righe; gli script con più istruzioni passano da exec().
const adapter = (db: PGlite) => ({ query: (sql: string, params?: unknown[]) => (params || /^\s*select/i.test(sql) ? db.query(sql, params) : db.exec(sql).then(() => ({ rows: [] }))) });

describe("aggiornamento automatico del database", () => {
  it("database nuovo: applica tutto, poi niente", async () => {
    const db = new PGlite();
    await db.exec(STUB);
    const a = adapter(db);
    expect(await migrate(a, files, () => {})).toHaveLength(files.length);
    expect(await migrate(a, files, () => {})).toEqual([]);
  }, 60000);

  it("database già aggiornato a mano: la prima volta riapplica senza errori e registra", async () => {
    const db = new PGlite();
    await db.exec(STUB);
    for (const f of files.slice(0, 10)) await db.exec(f.sql);
    expect(await migrate(adapter(db), files, () => {})).toHaveLength(files.length);
    const r = await db.query<{ n: number }>("select count(*)::int as n from public.schema_migrations");
    expect(r.rows[0].n).toBe(files.length);
  }, 60000);

  it("una migrazione sbagliata si ferma senza lasciare modifiche a metà", async () => {
    const db = new PGlite();
    await db.exec(STUB);
    const bad = [...files, { name: "9999_rotta.sql", sql: "create table public.prova_rotta (x int); select * from tabella_che_non_esiste;" }];
    await expect(migrate(adapter(db), bad, () => {})).rejects.toThrow(/9999_rotta.sql/);
    const t = await db.query("select to_regclass('public.prova_rotta') as t");
    expect(t.rows[0]).toEqual({ t: null });
  }, 60000);
});
