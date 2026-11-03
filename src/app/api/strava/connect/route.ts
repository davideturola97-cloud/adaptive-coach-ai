import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { stravaConfig } from "@/lib/strava/config";
import { authorizeUrl, siteOrigin, STATE_COOKIE } from "@/lib/strava/oauth";
import { getUser } from "@/lib/supabase/server";

/** Porta l'atleta su Strava per autorizzare la lettura delle attività. Un codice casuale (state) protegge il ritorno. */
export async function GET(request: NextRequest) {
  const cfg = stravaConfig();
  if (!cfg) return NextResponse.redirect(new URL("/profilo?strava=non-configurato", request.url));
  const { user } = await getUser();
  if (!user) return NextResponse.redirect(new URL("/accedi", request.url));

  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(authorizeUrl(cfg.clientId, siteOrigin(request.url), state));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/strava",
    maxAge: 600,
  });
  return res;
}
