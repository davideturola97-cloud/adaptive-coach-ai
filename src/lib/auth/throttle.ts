import "server-only";
import { createHash } from "crypto";
import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Limite ai tentativi di accesso e di registrazione, contati per indirizzo IP e per (IP + email).
 * Nel database finiscono solo impronte SHA-256 (migrazione 0008). Se la migrazione non è ancora stata eseguita,
 * vale un limite in memoria sul singolo server: meno preciso, ma non lascia la porta aperta.
 */
export const LIMITS = {
  signIn: { perAccount: 5, perIp: 30, windowSec: 15 * 60 },
  signUp: { perAccount: 3, perIp: 10, windowSec: 60 * 60 },
} as const;
export type ThrottleKind = keyof typeof LIMITS;

const sha = (s: string) => createHash("sha256").update(`adaptive-coach:${s}`).digest("hex");

/** Primo indirizzo di x-forwarded-for (impostato da Vercel), altrimenti x-real-ip. */
export function clientIp(h: Pick<Headers, "get">): string {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "sconosciuto";
}

export function throttleKeys(kind: ThrottleKind, ip: string, email: string): [string, string] {
  return [sha(`${kind}:acc:${ip}:${email.trim().toLowerCase()}`), sha(`${kind}:ip:${ip}`)];
}

/** true se uno dei due contatori ha raggiunto il limite. */
export function isBlocked(kind: ThrottleKind, counts: [number, number]): boolean {
  const l = LIMITS[kind];
  return counts[0] >= l.perAccount || counts[1] >= l.perIp;
}

// Ripiego in memoria (per processo).
const memory = new Map<string, number[]>();
function memCount(key: string, windowSec: number): number {
  const since = Date.now() - windowSec * 1000;
  const list = (memory.get(key) ?? []).filter((t) => t > since);
  memory.set(key, list);
  return list.length;
}
function memRecord(key: string) {
  memory.set(key, [...(memory.get(key) ?? []), Date.now()]);
  if (memory.size > 10_000) memory.clear();
}

export async function checkThrottle(supabase: SupabaseClient, kind: ThrottleKind, email: string) {
  const ip = clientIp(await headers());
  const keys = throttleKeys(kind, ip, email);
  const { windowSec } = LIMITS[kind];
  let counts: [number, number];
  const { data, error } = await supabase.rpc("auth_attempts_count", { p_keys: keys, p_window_sec: windowSec });
  if (!error && Array.isArray(data) && data.length === 2) counts = [Number(data[0]), Number(data[1])];
  else counts = [memCount(keys[0], windowSec), memCount(keys[1], windowSec)];
  return {
    blocked: isBlocked(kind, counts),
    async record() {
      const { error: e } = await supabase.rpc("auth_attempts_record", { p_keys: keys });
      if (e) keys.forEach(memRecord);
    },
  };
}

export const THROTTLE_MESSAGE = "Troppi tentativi da questo dispositivo. Aspetta 15 minuti e riprova.";
