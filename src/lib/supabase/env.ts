/**
 * Configurazione di Supabase. Indirizzo e chiave "anon" sono pubblici per progetto:
 * la sicurezza dei dati è garantita dalle regole RLS del database, non dal segreto della chiave.
 * Se mancano, l'app parte in modalità dimostrativa senza accesso.
 */
export function supabaseEnv(): { url: string; anonKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export const isSupabaseConfigured = () => supabaseEnv() !== null;
