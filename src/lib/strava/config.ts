import "server-only";

/**
 * Credenziali dell'app Strava (strava.com/settings/api), lette solo sul server.
 * Il Client Secret non ha il prefisso NEXT_PUBLIC_: non arriva mai al browser.
 */
export function stravaConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.STRAVA_CLIENT_ID?.trim();
  const clientSecret = process.env.STRAVA_CLIENT_SECRET?.trim();
  if (!clientId || !/^\d+$/.test(clientId) || !clientSecret) return null;
  return { clientId, clientSecret };
}

export const isStravaConfigured = () => stravaConfig() !== null;
