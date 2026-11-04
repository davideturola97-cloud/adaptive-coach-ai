/**
 * Legge la stringa di connessione di Supabase anche quando la password contiene caratteri speciali
 * (# / ? @ : %) o è rimasta tra parentesi quadre: separa credenziali e server all'ULTIMA "@".
 * Restituisce la configurazione per pg, oppure un errore che non contiene mai la password.
 */
export function parseDbUrl(raw) {
  const s = String(raw ?? "").trim().replace(/^["']|["']$/g, "");
  const m = s.match(/^postgres(?:ql)?:\/\/(.+)$/i);
  if (!m) return { error: "la stringa deve iniziare con postgresql://" };
  const rest = m[1];
  const at = rest.lastIndexOf("@");
  if (at < 0) return { error: "manca la @ tra password e indirizzo del server" };
  const cred = rest.slice(0, at);
  const hostPart = rest.slice(at + 1);
  const colon = cred.indexOf(":");
  if (colon < 0) return { error: "manca la password (formato utente:password@server)" };
  const user = cred.slice(0, colon);
  let password = cred.slice(colon + 1);
  if (password.startsWith("[") && password.endsWith("]")) password = password.slice(1, -1);
  if (!password || /^YOUR-PASSWORD$/i.test(password)) return { error: "al posto di [YOUR-PASSWORD] va la password del database" };
  // Se la password è già codificata (%40 ecc.) la decodifico; altrimenti la uso così com'è.
  try {
    if (/%[0-9a-f]{2}/i.test(password)) password = decodeURIComponent(password);
  } catch {
    /* password con % letterali: resta com'è */
  }
  const hm = hostPart.match(/^([^:/?]+)(?::(\d+))?(?:\/([^?]*))?/);
  if (!hm) return { error: "indirizzo del server non valido" };
  const [, host, port, database] = hm;
  // Gli indirizzi veri hanno almeno due punti (es. aws-0-eu-west-1.pooler.supabase.com); "postgres.xxxx" è il nome utente.
  if (!/^(localhost|\d{1,3}(\.\d{1,3}){3}|[^.]+\.[^.]+\.[^.]+.*)$/.test(host)) return { error: `indirizzo del server non valido ("${host}"): copia la stringa intera da Supabase → Connect → Session pooler` };
  return { config: { user, password, host, port: port ? Number(port) : 5432, database: database || "postgres" } };
}
