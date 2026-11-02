import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseEnv } from "./env";

/** Client Supabase lato server, legato ai cookie di sessione dell'utente. Agisce con i permessi dell'utente (RLS). */
export async function createClient() {
  const env = supabaseEnv();
  if (!env) throw new Error("Supabase non configurato");
  const cookieStore = await cookies();
  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Chiamato da un Server Component: i cookie li aggiorna il middleware.
        }
      },
    },
  });
}

/** Utente collegato, verificato col server di Supabase (non solo letto dal cookie). */
export async function getUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
}
