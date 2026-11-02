import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Arrivo dal link di conferma email: scambia il codice con una sessione. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const target = new URL("/", request.url);
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(target);
  }
  const fail = new URL("/accedi", request.url);
  fail.searchParams.set("errore", "link");
  return NextResponse.redirect(fail);
}
