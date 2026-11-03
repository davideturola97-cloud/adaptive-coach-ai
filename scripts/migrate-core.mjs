/**
 * Applica le migrazioni del database che mancano, una sola volta ciascuna, nell'ordine dei nomi (0001, 0002, ...).
 * Ognuna gira in una transazione: se fallisce non lascia modifiche a metà e la procedura si ferma.
 * Le migrazioni di questo progetto si possono rieseguire senza danni: sul database già esistente il primo giro
 * le riapplica tutte e da lì in poi tiene il conto nella tabella public.schema_migrations.
 *
 * `db` è un oggetto con query(sql): così la stessa logica si prova anche con un Postgres in memoria.
 */
export async function migrate(db, files, log = console.log) {
  await db.query(`create table if not exists public.schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )`);
  await db.query("alter table public.schema_migrations enable row level security");
  await db.query("revoke all on public.schema_migrations from anon, authenticated");
  const res = await db.query("select name from public.schema_migrations");
  const done = new Set((res.rows ?? []).map((r) => r.name));
  const applied = [];
  for (const f of [...files].sort((a, b) => a.name.localeCompare(b.name))) {
    if (done.has(f.name)) continue;
    try {
      await db.query("begin");
      await db.query(f.sql);
      await db.query("insert into public.schema_migrations (name) values ($1)", [f.name]);
      await db.query("commit");
      applied.push(f.name);
      log(`  applicata ${f.name}`);
    } catch (e) {
      await db.query("rollback").catch(() => {});
      throw new Error(`Migrazione ${f.name} non riuscita: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return applied;
}
