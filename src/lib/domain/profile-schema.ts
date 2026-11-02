import { z } from "zod";
import { SPORT_KEYS } from "./sports";

/** Validazione del modulo profilo. Gli stessi limiti sono ripetuti nel database (vincoli CHECK). */

export const WEEK_DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"] as const;
export const LEVELS = ["principiante", "intermedio", "avanzato"] as const;
export const STROKES = ["Stile libero", "Dorso", "Rana", "Delfino"] as const;

const optionalNumber = (min: number, max: number, label: string) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(String(v).replace(",", "."))),
    z.number({ invalid_type_error: `${label}: inserisci un numero` }).min(min, `${label}: minimo ${min}`).max(max, `${label}: massimo ${max}`).optional(),
  );

/** Testo con più voci separate da virgola o a capo -> elenco pulito. */
const list = (maxItems: number) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.split(/[\n,]/).map((s) => s.trim()).filter(Boolean) : v),
    z.array(z.string().max(120, "Voce troppo lunga (max 120 caratteri)")).max(maxItems, `Massimo ${maxItems} voci`),
  );

const sportEntry = z.object({
  enabled: z.boolean(),
  level: z.enum(LEVELS),
  yearsExperience: optionalNumber(0, 80, "Anni di esperienza"),
  weeklyVolume: z.string().trim().max(200).default(""),
});

export const profileSchema = z
  .object({
    displayName: z.string().trim().min(1, "Inserisci un nome").max(80, "Nome troppo lungo"),
    birthDate: z
      .string()
      .optional()
      .transform((v) => (v ? v : undefined))
      .refine((v) => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && v >= "1900-01-01" && v <= new Date().toISOString().slice(0, 10)), "Data di nascita non valida"),
    sex: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["M", "F", "altro"]).optional()),
    heightCm: optionalNumber(100, 250, "Altezza"),
    weightKg: optionalNumber(25, 300, "Peso"),
    weeklyHoursAvailable: optionalNumber(0, 40, "Ore a settimana"),
    maxSessionMin: optionalNumber(10, 600, "Durata massima seduta"),
    availableDays: z.array(z.enum(WEEK_DAYS)).default([]),
    longDays: z.array(z.enum(WEEK_DAYS)).default([]),
    longSessionMaxMin: optionalNumber(20, 600, "Durata massima nel giorno del lungo"),
    sportDays: z.record(z.enum(["swim", "bike", "run", "gym"]), z.array(z.enum(WEEK_DAYS))).default({}),
    equipment: list(20),
    limitations: list(20),
    goalPrimary: z.string().trim().max(200, "Obiettivo troppo lungo"),
    goalsSecondary: list(10),
    swim: sportEntry,
    bike: sportEntry,
    run: sportEntry,
    gym: sportEntry,
    swimDetails: z.object({
      poolLengthM: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.union([z.literal(25), z.literal(50)]).optional()),
      openWater: z.boolean(),
      wetsuit: z.boolean(),
      strokes: z.array(z.enum(STROKES)).default([]),
      canSwim400: z.boolean(),
    }),
  })
  .refine((p) => SPORT_KEYS.some((k) => p[k].enabled), { message: "Scegli almeno uno sport", path: ["run"] })
  .refine((p) => p.longDays.every((d) => !p.availableDays.length || p.availableDays.includes(d)), { message: "I giorni dei lunghi devono essere tra i giorni disponibili", path: ["longDays"] });

export type ProfileInput = z.infer<typeof profileSchema>;

/** Legge i campi dal FormData del modulo. */
export function profileFromForm(fd: FormData) {
  return profileSchema.safeParse(profileValues(fd));
}

/** Valori grezzi del modulo profilo (riusati dall'onboarding). */
export function profileValues(fd: FormData) {
  const sport = (k: (typeof SPORT_KEYS)[number]) => ({
    enabled: fd.get(`${k}.enabled`) === "on",
    level: fd.get(`${k}.level`) ?? "principiante",
    yearsExperience: fd.get(`${k}.yearsExperience`) ?? "",
    weeklyVolume: fd.get(`${k}.weeklyVolume`) ?? "",
  });
  return {
    displayName: fd.get("displayName") ?? "",
    birthDate: fd.get("birthDate") ?? "",
    sex: fd.get("sex") ?? "",
    heightCm: fd.get("heightCm") ?? "",
    weightKg: fd.get("weightKg") ?? "",
    weeklyHoursAvailable: fd.get("weeklyHoursAvailable") ?? "",
    maxSessionMin: fd.get("maxSessionMin") ?? "",
    availableDays: fd.getAll("availableDays"),
    longDays: fd.getAll("longDays"),
    longSessionMaxMin: fd.get("longSessionMaxMin") ?? "",
    sportDays: Object.fromEntries(SPORT_KEYS.map((k) => [k, fd.getAll(`${k}.days`)]).filter(([, v]) => (v as unknown[]).length)),
    equipment: fd.get("equipment") ?? "",
    limitations: fd.get("limitations") ?? "",
    goalPrimary: fd.get("goalPrimary") ?? "",
    goalsSecondary: fd.get("goalsSecondary") ?? "",
    swim: sport("swim"),
    bike: sport("bike"),
    run: sport("run"),
    gym: sport("gym"),
    swimDetails: {
      poolLengthM: fd.get("swim.poolLengthM") ?? "",
      openWater: fd.get("swim.openWater") === "on",
      wetsuit: fd.get("swim.wetsuit") === "on",
      strokes: fd.getAll("swim.strokes"),
      canSwim400: fd.get("swim.canSwim400") === "on",
    },
  };
}
