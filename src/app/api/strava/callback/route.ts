import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode, StravaError } from "@/lib/strava/client";
import { stravaConfig } from "@/lib/strava/config";
import { hasActivityScope, siteOrigin, STATE_COOKIE } from "@/lib/strava/oauth";
import { saveConnection } from "@/lib/strava/service";
import { getUser } from "@/lib/supabase/server";

/** Ritorno da Strava: controlla lo state, scambia il codice con i token e li salva cifrati. */
export async function GET(request: NextRequest) {
  const origin = siteOrigin(request.url);
  const back = (esito: string) => {
    const res = NextResponse.redirect(new URL(`/profilo?strava=${esito}#strava`, origin));
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/strava" });
    return res;
  };

  const cfg = stravaConfig();
  if (!cfg) return back("non-configurato");
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.redirect(new URL("/accedi", origin));

  const q = request.nextUrl.searchParams;
  const expected = request.cookies.get(STATE_COOKIE)?.value ?? "";
  const got = q.get("state") ?? "";
  const sameState = expected.length > 0 && expected.length === got.length && timingSafeEqual(Buffer.from(expected), Buffer.from(got));
  if (!sameState) return back("scaduto");
  if (q.get("error")) return back("negato");
  const code = q.get("code");
  if (!code || code.length > 200) return back("errore");
  if (!hasActivityScope(q.get("scope"))) return back("permessi");

  try {
    const { tokens, athlete } = await exchangeCode(fetch, cfg, code);
    if (!athlete?.id) return back("errore");
    const name = [athlete.firstname, athlete.lastname].filter(Boolean).join(" ");
    const { error } = await saveConnection(supabase, user.id, tokens, { id: athlete.id, name }, q.get("scope") ?? "");
    if (error) return back("database");
    return back("collegato");
  } catch (e) {
    return back(e instanceof StravaError && e.kind === "limite" ? "limite" : "errore");
  }
}
