/**
 * Aggiorna il database Supabase prima di ogni compilazione (npm run build, quindi anche a ogni deploy su Vercel)
 * e all'avvio sul PC. Serve SUPABASE_DB_URL: la stringa di connessione "Session pooler" del progetto
 * (Supabase → Connect → Session pooler). Senza, non fa nulla e lo dice.
 * La stringa contiene la password del database: va solo in .env.local e nelle Environment Variables di Vercel.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import pg from "pg";
import { migrate } from "./migrate-core.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
nextEnv.loadEnvConfig(root);
const url = process.env.SUPABASE_DB_URL?.trim();

if (!url) {
  console.log("Database: aggiornamento automatico non attivo (manca SUPABASE_DB_URL). Vedi docs/SUPABASE.md.");
  process.exit(0);
}

const dir = path.join(root, "supabase", "migrations");
const files = readdirSync(dir)
  .filter((f) => /^\d{4}_.+\.sql$/.test(f))
  .map((name) => ({ name, sql: readFileSync(path.join(dir, name), "utf8") }));

// Connessione cifrata. Il certificato di Supabase non è tra quelli di sistema di Node, quindi non si verifica la catena:
// il traffico resta cifrato, e la stringa di connessione la conosci solo tu.
const client = new pg.Client({ connectionString: url.replace(/[?&]sslmode=[^&]+/, ""), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
try {
  await client.connect();
  const applied = await migrate(client, files);
  console.log(applied.length ? `Database aggiornato: ${applied.length} migrazioni applicate.` : "Database: già aggiornato.");
} catch (e) {
  // Il messaggio di pg non contiene la password; per sicurezza si toglie comunque qualsiasi stringa di connessione.
  const msg = (e instanceof Error ? e.message : String(e)).replace(/postgres(ql)?:\/\/\S+/g, "postgresql://***");
  console.error(`Database: aggiornamento NON riuscito. ${msg}`);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
