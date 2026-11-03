import { z } from "zod";
import type { GymExercise } from "@/lib/domain/types";

const num = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : Number(String(v).replace(",", "."))), z.number().min(min).max(max).optional());

const exerciseSchema = z.object({
  name: z.string().trim().min(1).max(60),
  sets: z.preprocess((v) => Number(v), z.number().int().min(1, "almeno 1 serie").max(10, "al massimo 10 serie")),
  reps: z
    .string()
    .trim()
    .min(1, "ripetizioni mancanti")
    .max(12)
    .regex(/^(\d{1,3}([-–]\d{1,3})?\s?(″|"|s|sec|min|')?|max)$/i, "ripetizioni non valide (es. 8, 8-10, 30″, max)"),
  loadKg: num(0, 500),
  restSec: num(0, 600),
  note: z.string().trim().max(100).optional(),
});

/** Esercizi di un giorno dal JSON del modulo: le righe senza nome si ignorano, quelle sbagliate fermano il salvataggio. */
export function parseExercises(raw: FormDataEntryValue | null, day: string): GymExercise[] | string {
  if (typeof raw !== "string" || !raw) return [];
  let rows: unknown;
  try {
    rows = JSON.parse(raw);
  } catch {
    return `${day}: esercizi non leggibili`;
  }
  if (!Array.isArray(rows)) return [];
  const out: GymExercise[] = [];
  for (const r of rows.slice(0, 15)) {
    if (!r || typeof r !== "object" || !String((r as { name?: unknown }).name ?? "").trim()) continue;
    const p = exerciseSchema.safeParse(r);
    if (!p.success) return `${day}, ${String((r as { name: unknown }).name).slice(0, 40)}: ${p.error.issues[0].message}`;
    const e = p.data;
    out.push({ name: e.name, sets: e.sets, reps: e.reps.replace("–", "-"), ...(e.loadKg !== undefined && { loadKg: e.loadKg }), ...(e.restSec !== undefined && { restSec: Math.round(e.restSec) }), ...(e.note && { note: e.note }) });
  }
  return out;
}

