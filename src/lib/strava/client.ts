import "server-only";
import type { StravaActivity } from "./mapping";

/** Chiamate all'API di Strava (sola lettura). fetch è iniettabile per i test. */
const API = "https://www.strava.com/api/v3";
const OAUTH = "https://www.strava.com/oauth";

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // secondi epoch
}

export class StravaError extends Error {
  constructor(message: string, readonly kind: "autorizzazione" | "limite" | "rete") {
    super(message);
  }
}

type Fetch = typeof fetch;

async function call<T>(f: Fetch, url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await f(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new StravaError("Strava non risponde. Riprova tra qualche minuto.", "rete");
  }
  if (res.status === 401 || res.status === 403) throw new StravaError("Strava ha revocato l'accesso: ricollega l'account dal Profilo.", "autorizzazione");
  if (res.status === 429) throw new StravaError("Strava limita le richieste: hai importato molto in poco tempo. Riprova tra 15 minuti.", "limite");
  if (!res.ok) throw new StravaError(`Strava ha risposto con un errore (${res.status}). Riprova tra poco.`, "rete");
  return (await res.json()) as T;
}

type TokenResponse = { access_token: string; refresh_token: string; expires_at: number; scope?: string; athlete?: { id: number; firstname?: string; lastname?: string } };
const toTokens = (t: TokenResponse): Tokens => ({ accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: t.expires_at });

export async function exchangeCode(f: Fetch, cfg: { clientId: string; clientSecret: string }, code: string) {
  const t = await call<TokenResponse>(f, `${OAUTH}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, code, grant_type: "authorization_code" }),
  });
  return { tokens: toTokens(t), athlete: t.athlete };
}

/** Rinnova il token se scade entro 2 minuti (i token Strava durano 6 ore). */
export async function freshTokens(f: Fetch, cfg: { clientId: string; clientSecret: string }, tokens: Tokens, now = Date.now()): Promise<{ tokens: Tokens; refreshed: boolean }> {
  if (tokens.expiresAt * 1000 > now + 120_000) return { tokens, refreshed: false };
  const t = await call<TokenResponse>(f, `${OAUTH}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, refresh_token: tokens.refreshToken, grant_type: "refresh_token" }),
  });
  return { tokens: toTokens(t), refreshed: true };
}

export async function listActivities(f: Fetch, accessToken: string, afterEpoch: number, page = 1): Promise<StravaActivity[]> {
  return call<StravaActivity[]>(f, `${API}/athlete/activities?after=${afterEpoch}&per_page=100&page=${page}`, { headers: { Authorization: `Bearer ${accessToken}` } });
}

export async function getActivity(f: Fetch, accessToken: string, id: number): Promise<StravaActivity> {
  return call<StravaActivity>(f, `${API}/activities/${id}?include_all_efforts=false`, { headers: { Authorization: `Bearer ${accessToken}` } });
}

/** Revoca l'accesso dell'app su Strava (quando l'atleta scollega o cancella l'account). */
export async function deauthorize(f: Fetch, accessToken: string) {
  await call<unknown>(f, `${OAUTH}/deauthorize`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } });
}
