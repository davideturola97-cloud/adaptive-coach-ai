import "server-only";

/** Permessi chiesti a Strava: lettura del profilo e delle attività (anche private). Nessuna scrittura. */
export const STRAVA_SCOPE = "read,activity:read_all";
export const STATE_COOKIE = "strava_oauth_state";

/** Indirizzo pubblico dell'app: fisso in produzione (NEXT_PUBLIC_SITE_URL), altrimenti quello della richiesta. */
export function siteOrigin(requestUrl: string): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || new URL(requestUrl).origin;
}

// Pagina web di Strava (non quella "mobile", che aprirebbe l'app Strava e poi tornerebbe in Safari invece che nell'app installata).
export function authorizeUrl(clientId: string, origin: string, state: string): string {
  const u = new URL("https://www.strava.com/oauth/authorize");
  u.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/strava/callback`,
    response_type: "code",
    approval_prompt: "auto",
    scope: STRAVA_SCOPE,
    state,
  }).toString();
  return u.toString();
}

/** Strava restituisce i permessi concessi: senza la lettura delle attività l'import non funziona. */
export function hasActivityScope(scope: string | null): boolean {
  return (scope ?? "").split(",").some((s) => s === "activity:read" || s === "activity:read_all");
}
