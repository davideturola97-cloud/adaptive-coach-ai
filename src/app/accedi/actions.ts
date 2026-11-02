"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkThrottle, THROTTLE_MESSAGE } from "@/lib/auth/throttle";

export type AuthState = { error?: string; message?: string };

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Email non valida").max(254),
  password: z.string().min(8, "La password deve avere almeno 8 caratteri").max(72, "Password troppo lunga"),
});

/** Messaggi di Supabase tradotti, senza rivelare se un'email è registrata. */
function friendly(message: string): string {
  if (/invalid login credentials/i.test(message)) return "Email o password non corretti.";
  if (/email not confirmed/i.test(message)) return "Conferma prima l'email: apri il link che ti abbiamo inviato.";
  if (/rate limit|too many/i.test(message)) return "Troppi tentativi. Riprova tra qualche minuto.";
  if (/password/i.test(message)) return "La password non è abbastanza sicura: usa almeno 8 caratteri con lettere e numeri.";
  return "Operazione non riuscita. Riprova tra poco.";
}

export async function signIn(_: AuthState, fd: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const throttle = await checkThrottle(supabase, "signIn", parsed.data.email);
  if (throttle.blocked) return { error: THROTTLE_MESSAGE };
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    await throttle.record();
    return { error: friendly(error.message) };
  }
  redirect("/");
}

export async function signUp(_: AuthState, fd: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (fd.get("consent") !== "on") return { error: "Per registrarti devi accettare il trattamento dei dati." };
  // In produzione l'indirizzo è fisso (NEXT_PUBLIC_SITE_URL); in locale si ricava dalla richiesta.
  // Supabase accetta comunque solo gli indirizzi elencati in Authentication → URL Configuration.
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || h.get("origin") || `http://${h.get("host")}`;
  const supabase = await createClient();
  // Ogni registrazione conta: limita l'invio di email di conferma a raffica.
  const throttle = await checkThrottle(supabase, "signUp", parsed.data.email);
  if (throttle.blocked) return { error: "Troppe registrazioni da questo dispositivo. Riprova tra un'ora." };
  await throttle.record();
  const { data, error } = await supabase.auth.signUp({ ...parsed.data, options: { emailRedirectTo: `${origin}/auth/callback` } });
  if (error) return { error: friendly(error.message) };
  if (data.session) redirect("/");
  return { message: "Ti abbiamo inviato un'email: apri il link per confermare l'account, poi accedi." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/accedi");
}
