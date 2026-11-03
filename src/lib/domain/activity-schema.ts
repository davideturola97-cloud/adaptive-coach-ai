import { z } from "zod";
import { parseTime } from "@/lib/training/formulas";

/** Validazione del modulo attività + feedback. I limiti coincidono con i vincoli del database. */

const num = (label: string, min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : Number(String(v).replace(",", "."))),
    z.number({ invalid_type_error: `${label}: inserisci un numero` }).min(min, `${label}: minimo ${min}`).max(max, `${label}: massimo ${max}`).optional(),
  );

const scale = (label: string, max: number) =>
  z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number({ required_error: `Scegli ${label}`, invalid_type_error: `Scegli ${label}` }).int().min(1).max(max));

export const FEELINGS = ["ottimo", "buono", "normale", "stanco", "pessimo"] as const;

export const feedbackSchema = z.object({
  rpe: scale("lo sforzo percepito (RPE)", 10),
  muscleFatigue: scale("la fatica muscolare", 5),
  cardioFatigue: scale("la fatica cardiovascolare", 5),
  sleepQuality: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().int().min(1).max(5).optional()),
  feeling: z.enum(FEELINGS, { errorMap: () => ({ message: "Scegli come ti sei sentito" }) }),
  pain: z.string().trim().max(500, "Descrizione del dolore troppo lunga").optional().transform((v) => v || undefined),
  notes: z.string().trim().max(2000, "Note troppo lunghe").optional().transform((v) => v || undefined),
});

export const activitySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Inserisci la data"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")).transform((v) => v || undefined),
  sport: z.enum(["swim", "bike", "run", "gym"], { errorMap: () => ({ message: "Scegli lo sport" }) }),
  title: z.string().trim().max(120).default(""),
  /** Durata come "45", "1:05:30" o "45:30". */
  duration: z.string().trim().min(1, "Inserisci la durata"),
  distanceKm: num("Distanza", 0, 500),
  avgHr: num("Frequenza cardiaca media", 30, 230),
  avgPowerW: num("Potenza media", 0, 2000),
  elevationM: num("Dislivello", 0, 10000),
});

/** "45" = 45 minuti; "1:05:30" o "45:30" = tempo. Restituisce minuti, o null se non valido. */
export function parseDurationMin(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (/^\d+(\.\d+)?$/.test(t)) {
    const m = Number(t);
    return m > 0 && m <= 1440 ? Math.round(m * 10) / 10 : null;
  }
  const s = parseTime(t);
  if (!s) return null;
  const m = s / 60;
  return m > 0 && m <= 1440 ? Math.round(m * 10) / 10 : null;
}

const splitsSchema = z
  .array(
    z.object({
      n: z.number().int().min(0).max(1000),
      km: z.number().positive().max(50),
      paceSec: z.number().positive().max(10000).optional(),
      hr: z.number().min(30).max(230).optional(),
      elevM: z.number().min(-2000).max(2000).optional(),
    }),
  )
  .max(200);

/** Parziali arrivati dal modulo (JSON nascosto). Se non validi si ignorano: non bloccano il salvataggio. */
export function splitsFromForm(raw: FormDataEntryValue | null) {
  if (typeof raw !== "string" || !raw) return undefined;
  try {
    const r = splitsSchema.safeParse(JSON.parse(raw));
    return r.success && r.data.length ? r.data : undefined;
  } catch {
    return undefined;
  }
}

export type ActivityInput = z.infer<typeof activitySchema> & { durationMin: number };
export type FeedbackInput = z.infer<typeof feedbackSchema>;

export function activityFromForm(fd: FormData): { ok: true; activity: ActivityInput; feedback: FeedbackInput } | { ok: false; errors: string[] } {
  const g = (k: string) => fd.get(k) ?? "";
  const a = activitySchema.safeParse({
    date: g("date"), startTime: g("startTime"), sport: g("sport"), title: g("title"), duration: g("duration"),
    distanceKm: g("distanceKm"), avgHr: g("avgHr"), avgPowerW: g("avgPowerW"), elevationM: g("elevationM"),
  });
  const f = feedbackSchema.safeParse({
    rpe: g("rpe"), muscleFatigue: g("muscleFatigue"), cardioFatigue: g("cardioFatigue"), sleepQuality: g("sleepQuality"),
    feeling: g("feeling"), pain: g("pain"), notes: g("notes"),
  });
  const errors = [...(a.success ? [] : a.error.issues.map((i) => i.message)), ...(f.success ? [] : f.error.issues.map((i) => i.message))];
  const durationMin = a.success ? parseDurationMin(a.data.duration) : null;
  if (a.success && durationMin === null) errors.push("Durata non valida: scrivi i minuti (es. 45) o il tempo (es. 1:05:30)");
  if (a.success && a.data.date > new Date().toISOString().slice(0, 10)) errors.push("La data non può essere nel futuro");
  if (errors.length || !a.success || !f.success || durationMin === null) return { ok: false, errors: [...new Set(errors)] };
  return { ok: true, activity: { ...a.data, durationMin }, feedback: f.data };
}

/** Solo il feedback (per un'attività già salvata, es. importata da Strava). */
export function feedbackFromForm(fd: FormData): { ok: true; feedback: FeedbackInput } | { ok: false; errors: string[] } {
  const g = (k: string) => fd.get(k) ?? "";
  const f = feedbackSchema.safeParse({
    rpe: g("rpe"), muscleFatigue: g("muscleFatigue"), cardioFatigue: g("cardioFatigue"), sleepQuality: g("sleepQuality"),
    feeling: g("feeling"), pain: g("pain"), notes: g("notes"),
  });
  return f.success ? { ok: true, feedback: f.data } : { ok: false, errors: [...new Set(f.error.issues.map((i) => i.message))] };
}
