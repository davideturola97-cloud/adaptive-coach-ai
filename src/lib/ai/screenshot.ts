/**
 * Lettura degli screenshot di attività (Strava, Garmin Connect, Apple Salute...).
 * L'AI estrae solo ciò che legge; i valori illeggibili restano vuoti e vengono segnalati.
 * Il risultato viene controllato (valori plausibili) e mostrato all'atleta, che conferma prima di salvare.
 */
import { z } from "zod";
import type { ChatClient } from "./openai";

export const ALLOWED_IMAGE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
export const MAX_IMAGE_BYTES = 2_500_000;

const FIELDS = ["sport", "data", "durata_minuti", "distanza_km", "passo", "velocita_kmh", "fc_media", "potenza_media_w", "dislivello_m", "intervalli"] as const;

export const SCREENSHOT_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "attivita",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        e_attivita: { type: "boolean", description: "true se l'immagine mostra un'attività sportiva" },
        app: { type: ["string", "null"] },
        sport: { type: ["string", "null"], enum: ["run", "bike", "swim", "gym", null] },
        data: { type: ["string", "null"], description: "YYYY-MM-DD, solo se scritta nell'immagine" },
        titolo: { type: ["string", "null"] },
        durata_minuti: { type: ["number", "null"], description: "Tempo di movimento in minuti" },
        distanza_km: { type: ["number", "null"] },
        passo: { type: ["string", "null"], description: "Come scritto, es. 5:12 /km" },
        velocita_kmh: { type: ["number", "null"] },
        fc_media: { type: ["number", "null"] },
        potenza_media_w: { type: ["number", "null"] },
        dislivello_m: { type: ["number", "null"] },
        intervalli: { type: ["string", "null"], description: "Breve descrizione delle ripetute se visibili" },
        illeggibili: { type: "array", items: { type: "string", enum: [...FIELDS] }, description: "Campi presenti ma non leggibili con certezza" },
      },
      required: ["e_attivita", "app", "sport", "data", "titolo", "durata_minuti", "distanza_km", "passo", "velocita_kmh", "fc_media", "potenza_media_w", "dislivello_m", "intervalli", "illeggibili"],
    },
  },
} as const;

const PROMPT = `Leggi questo screenshot di un'app sportiva ed estrai i dati dell'attività.
Regole: riporta SOLO valori che leggi chiaramente nell'immagine. Se un valore manca, metti null.
Se un valore c'è ma non è leggibile con certezza, metti null e aggiungi il nome del campo in "illeggibili".
Non calcolare e non stimare valori che non sono scritti. Converti miglia in km e piedi in metri solo se l'unità è scritta.
La durata è il tempo in movimento in minuti (es. 1:05:30 = 65.5). Sport: run (corsa, camminata veloce, trail), bike (bici, rulli), swim (nuoto), gym (palestra, forza).
Se l'immagine non mostra un'attività sportiva, e_attivita = false.`;

const nullableNum = (min: number, max: number) => z.number().min(min).max(max).nullable().catch(null);

const extractionSchema = z.object({
  e_attivita: z.boolean(),
  app: z.string().max(60).nullable().catch(null),
  sport: z.enum(["run", "bike", "swim", "gym"]).nullable().catch(null),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().catch(null),
  titolo: z.string().max(120).nullable().catch(null),
  durata_minuti: nullableNum(1, 1440),
  distanza_km: nullableNum(0.01, 500),
  passo: z.string().max(30).nullable().catch(null),
  velocita_kmh: nullableNum(1, 100),
  fc_media: nullableNum(30, 230),
  potenza_media_w: nullableNum(1, 2000),
  dislivello_m: nullableNum(0, 10000),
  intervalli: z.string().max(300).nullable().catch(null),
  illeggibili: z.array(z.enum(FIELDS)).catch([]),
});

export type Extraction = z.infer<typeof extractionSchema> & { scartati: string[] };

const LABEL: Record<(typeof FIELDS)[number], string> = {
  sport: "sport", data: "data", durata_minuti: "durata", distanza_km: "distanza", passo: "passo", velocita_kmh: "velocità",
  fc_media: "frequenza cardiaca", potenza_media_w: "potenza", dislivello_m: "dislivello", intervalli: "intervalli",
};
export const fieldLabel = (f: (typeof FIELDS)[number]) => LABEL[f];

/** Controlla il JSON dell'AI: i valori impossibili diventano vuoti e finiscono tra gli scartati, mai inventati o corretti. */
export function normalizeExtraction(raw: unknown, today: string): Extraction | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const parsed = extractionSchema.safeParse(raw);
  if (!parsed.success) return null;
  const e = parsed.data;
  const scartati: string[] = [];
  for (const k of ["durata_minuti", "distanza_km", "velocita_kmh", "fc_media", "potenza_media_w", "dislivello_m"] as const) {
    if (typeof r[k] === "number" && e[k] === null) scartati.push(LABEL[k]);
  }
  let data = e.data;
  if (data && data > today) {
    scartati.push("data (nel futuro)");
    data = null;
  }
  // Coerenza minima: una corsa a più di 30 km/h non è plausibile.
  if (e.sport === "run" && e.durata_minuti && e.distanza_km && e.distanza_km / (e.durata_minuti / 60) > 30) {
    scartati.push("distanza (non coerente con la durata)");
    return { ...e, data, distanza_km: null, scartati };
  }
  return { ...e, data, scartati };
}

export async function readScreenshot(opts: { client: ChatClient; model: string; dataUrl: string; today: string }): Promise<{ extraction: Extraction | null; usage: { input: number; output: number } }> {
  const res = await opts.client({
    model: opts.model,
    messages: [
      { role: "system", content: "Sei un assistente che legge dati da screenshot di app sportive. Non inventi mai valori." },
      { role: "user", content: [{ type: "text", text: PROMPT }, { type: "image_url", image_url: { url: opts.dataUrl, detail: "high" } }] },
    ],
    response_format: SCREENSHOT_SCHEMA as unknown as Record<string, unknown>,
    max_tokens: 500,
    temperature: 0,
  });
  let json: unknown = null;
  try {
    json = JSON.parse(res.message.content ?? "null");
  } catch {
    json = null;
  }
  return { extraction: normalizeExtraction(json, opts.today), usage: res.usage };
}
