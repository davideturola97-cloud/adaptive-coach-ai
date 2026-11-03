import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/**
 * Cifratura dei token Strava (AES-256-GCM) prima di salvarli in Supabase.
 * La chiave deriva dal Client Secret, che sta solo sul server: senza di esso i token nel database sono inutilizzabili.
 * Se il Client Secret cambia, i vecchi token non si leggono più e basta ricollegare Strava.
 */
function key(secret: string) {
  return createHash("sha256").update(`adaptive-coach:strava-tokens:${secret}`).digest();
}

export function seal(data: object, secret: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(secret), iv);
  const body = Buffer.concat([c.update(JSON.stringify(data), "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

export function open<T>(sealed: string, secret: string): T | null {
  try {
    const [v, iv, tag, body] = sealed.split(".");
    if (v !== "v1") return null;
    const d = createDecipheriv("aes-256-gcm", key(secret), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return JSON.parse(Buffer.concat([d.update(Buffer.from(body, "base64url")), d.final()]).toString("utf8")) as T;
  } catch {
    return null;
  }
}
