import { z } from "zod";
import { TRI_FORMATS } from "./sports";

/** Validazione di una gara (singolo sport o triathlon). */
const km = (label: string, max: number) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : Number(String(v).replace(",", "."))),
    z.number({ invalid_type_error: `${label}: inserisci un numero` }).positive(`${label}: deve essere maggiore di zero`).max(max, `${label}: massimo ${max} km`).optional(),
  );

export const eventSchema = z
  .object({
    name: z.string().trim().min(1, "Dai un nome alla gara").max(120, "Nome troppo lungo"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Inserisci la data (anche indicativa)"),
    dateTentative: z.boolean(),
    kind: z.enum(["singolo", "triathlon"]),
    sport: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["swim", "bike", "run"]).optional()),
    distanceKm: km("Distanza", 1000),
    triFormat: z.preprocess((v) => (v === "" ? undefined : v), z.enum(["sprint", "olimpico", "medio", "lungo", "personalizzato"]).optional()),
    swimKm: km("Nuoto", 20),
    bikeKm: km("Bici", 1000),
    runKm: km("Corsa", 200),
    priority: z.enum(["A", "B", "C"]),
  })
  .transform((e) => {
    if (e.kind === "triathlon" && e.triFormat && e.triFormat !== "personalizzato") {
      const f = TRI_FORMATS[e.triFormat];
      return { ...e, sport: undefined, swimKm: f.swimKm, bikeKm: f.bikeKm, runKm: f.runKm };
    }
    return e.kind === "triathlon" ? { ...e, sport: undefined } : e;
  })
  .superRefine((e, ctx) => {
    if (e.kind === "singolo" && !e.sport) ctx.addIssue({ code: "custom", message: "Scegli lo sport della gara", path: ["sport"] });
    if (e.kind === "triathlon" && (!e.swimKm || !e.bikeKm || !e.runKm)) {
      ctx.addIssue({ code: "custom", message: "Scegli un formato o inserisci le tre distanze", path: ["triFormat"] });
    }
  });

export type EventInput = z.infer<typeof eventSchema>;

export function eventFromForm(fd: FormData, prefix = "") {
  const g = (k: string) => fd.get(`${prefix}${k}`) ?? "";
  return eventSchema.safeParse({
    name: g("name"),
    date: g("date"),
    dateTentative: g("dateTentative") === "on",
    kind: g("kind") || "singolo",
    sport: g("sport"),
    distanceKm: g("distanceKm"),
    triFormat: g("triFormat"),
    swimKm: g("swimKm"),
    bikeKm: g("bikeKm"),
    runKm: g("runKm"),
    priority: g("priority") || "A",
  });
}

/** Riga per la tabella `events`. */
export function eventRow(e: EventInput) {
  return {
    name: e.name,
    event_date: e.date,
    date_tentative: e.dateTentative,
    kind: e.kind,
    sport: e.kind === "singolo" ? e.sport : null,
    distance_km: e.kind === "singolo" ? (e.distanceKm ?? null) : null,
    tri_format: e.kind === "triathlon" ? (e.triFormat ?? "personalizzato") : null,
    swim_km: e.kind === "triathlon" ? e.swimKm : null,
    bike_km: e.kind === "triathlon" ? e.bikeKm : null,
    run_km: e.kind === "triathlon" ? e.runKm : null,
    priority: e.priority,
  };
}
