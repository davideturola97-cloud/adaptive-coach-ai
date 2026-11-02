import { formatDayMonth } from "@/lib/dates";
import { SPORTS, TRI_FORMATS } from "@/lib/domain/sports";
import type { RaceEvent } from "@/lib/domain/types";

const km = (n: number) => n.toLocaleString("it-IT");

/** Descrizione breve di una gara: tipo, distanze e data (segnalando se è provvisoria). */
export function eventDescription(e: RaceEvent): string {
  const what =
    e.kind === "triathlon" && e.legs
      ? `Triathlon ${e.triFormat && e.triFormat !== "personalizzato" ? TRI_FORMATS[e.triFormat].label : ""} · ${km(e.legs.swimKm)} + ${km(e.legs.bikeKm)} + ${km(e.legs.runKm)} km`
      : `${e.sport ? SPORTS[e.sport].label : ""}${e.distanceKm ? ` · ${km(e.distanceKm)} km` : ""}`;
  return `${what.replace(/\s+·/g, " ·").trim()} · ${formatDayMonth(e.date, false)}${e.dateTentative ? " (data da confermare)" : ""}`;
}
