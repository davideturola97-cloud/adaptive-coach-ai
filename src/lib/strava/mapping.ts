/**
 * Conversione delle attività Strava nel formato dell'app. Funzioni pure, senza rete: testabili.
 * Solo dati misurati: la potenza stimata da Strava (senza misuratore) non si importa.
 */
import type { Split, Sport } from "@/lib/domain/types";
import { plausiblePace } from "@/lib/training/splits";

/** Campi dell'attività Strava che usiamo (API v3, SummaryActivity / DetailedActivity). */
export interface StravaActivity {
  id: number;
  name: string;
  sport_type?: string;
  type?: string;
  start_date: string; // UTC ISO
  start_date_local: string; // ISO senza fuso, ora locale
  moving_time: number; // s
  elapsed_time: number; // s
  distance: number; // m
  total_elevation_gain?: number;
  has_heartrate?: boolean;
  average_heartrate?: number;
  average_watts?: number;
  device_watts?: boolean;
  manual?: boolean;
  splits_metric?: StravaSplit[];
  laps?: StravaLap[];
}
export interface StravaSplit {
  split: number;
  distance: number;
  moving_time: number;
  elapsed_time?: number;
  average_heartrate?: number;
  elevation_difference?: number;
}
export interface StravaLap {
  lap_index?: number;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  average_heartrate?: number;
  total_elevation_gain?: number;
}

const SPORT_MAP: Record<string, Sport> = {
  Run: "run", TrailRun: "run", VirtualRun: "run",
  Ride: "bike", VirtualRide: "bike", GravelRide: "bike", MountainBikeRide: "bike", Handcycle: "bike", Velomobile: "bike",
  Swim: "swim",
  WeightTraining: "gym", Workout: "gym", Crossfit: "gym", HighIntensityIntervalTraining: "gym", Pilates: "gym", Yoga: "gym",
};

/** Sport dell'app per un'attività Strava; null = non importata (camminata, sci, e-bike...). */
export function mapSport(a: Pick<StravaActivity, "sport_type" | "type">): Sport | null {
  return SPORT_MAP[a.sport_type ?? ""] ?? SPORT_MAP[a.type ?? ""] ?? null;
}

const r1 = (x: number) => Math.round(x * 10) / 10;

export interface ImportedActivity {
  externalId: string;
  date: string;
  startedAt: string;
  sport: Sport;
  title: string;
  durationMin: number;
  distanceKm?: number;
  avgHr?: number;
  avgPowerW?: number;
  elevationM?: number;
  splits?: Split[];
}

/** Parziali dalla risposta di dettaglio: km per corsa, giri (o tratti da 5 km) per la bici, vasche per il nuoto. */
export function splitsFrom(a: StravaActivity, sport: Sport): Split[] | undefined {
  type Row = { distance: number; moving_time: number; average_heartrate?: number; elev?: number };
  let rows: Row[] = [];
  if (sport === "swim") {
    rows = (a.laps ?? []).map((l) => ({ distance: l.distance, moving_time: l.moving_time, average_heartrate: l.average_heartrate }));
  } else if (sport === "bike") {
    const laps = a.laps ?? [];
    if (laps.length >= 2 && laps.length <= 200) {
      rows = laps.map((l) => ({ distance: l.distance, moving_time: l.moving_time, average_heartrate: l.average_heartrate, elev: l.total_elevation_gain }));
    } else {
      rows = chunk((a.splits_metric ?? []).map((s) => ({ distance: s.distance, moving_time: s.moving_time, average_heartrate: s.average_heartrate, elev: s.elevation_difference })), 5);
    }
  } else if (sport === "run") {
    rows = (a.splits_metric ?? []).map((s) => ({ distance: s.distance, moving_time: s.moving_time, average_heartrate: s.average_heartrate, elev: s.elevation_difference }));
  }
  const splits = rows
    .filter((r) => r.distance >= (sport === "swim" ? 10 : 50) && r.moving_time > 0)
    .slice(0, 200)
    .map((r, i): Split => {
      const km = Math.round(r.distance) / 1000;
      const pace = r.moving_time / km;
      return {
        n: i + 1,
        km,
        ...(plausiblePace(sport, pace) && { paceSec: Math.round(pace) }),
        ...(r.average_heartrate && { hr: Math.round(r.average_heartrate) }),
        ...(r.elev !== undefined && r.elev !== null && { elevM: Math.round(r.elev) }),
      };
    });
  return splits.length >= 2 ? splits : undefined;
}

/** Raggruppa i km della bici in tratti da `size` km: un'uscita da 100 km diventa 20 righe leggibili. */
function chunk<T extends { distance: number; moving_time: number; average_heartrate?: number; elev?: number }>(rows: T[], size: number) {
  const out: { distance: number; moving_time: number; average_heartrate?: number; elev?: number }[] = [];
  for (let i = 0; i < rows.length; i += size) {
    const part = rows.slice(i, i + size);
    const t = part.reduce((s, r) => s + r.moving_time, 0);
    const withHr = part.filter((r) => r.average_heartrate);
    const hrT = withHr.reduce((s, r) => s + r.moving_time, 0);
    out.push({
      distance: part.reduce((s, r) => s + r.distance, 0),
      moving_time: t,
      average_heartrate: withHr.length && hrT ? withHr.reduce((s, r) => s + r.average_heartrate! * r.moving_time, 0) / hrT : undefined,
      elev: part.some((r) => r.elev !== undefined) ? part.reduce((s, r) => s + Math.max(0, r.elev ?? 0), 0) : undefined,
    });
  }
  return out;
}

/** Attività Strava -> attività dell'app. null se lo sport non è tra quelli seguiti o mancano i dati minimi. */
export function toImported(a: StravaActivity): ImportedActivity | null {
  const sport = mapSport(a);
  if (!sport) return null;
  const durationMin = r1((a.moving_time || a.elapsed_time) / 60);
  if (!(durationMin > 0 && durationMin <= 1440)) return null;
  const distanceKm = sport !== "gym" && a.distance > 0 ? Math.round(a.distance / 10) / 100 : undefined;
  return {
    externalId: `strava:${a.id}`,
    date: a.start_date_local.slice(0, 10),
    startedAt: a.start_date,
    sport,
    title: (a.name || "").trim().slice(0, 120),
    durationMin,
    ...(distanceKm !== undefined && { distanceKm }),
    ...(a.has_heartrate !== false && a.average_heartrate && a.average_heartrate >= 30 && a.average_heartrate <= 230 && { avgHr: Math.round(a.average_heartrate) }),
    // Solo potenza misurata da un sensore: la stima di Strava non è un dato.
    ...(sport === "bike" && a.device_watts && a.average_watts && { avgPowerW: Math.round(a.average_watts) }),
    ...(sport !== "swim" && sport !== "gym" && a.total_elevation_gain !== undefined && { elevationM: Math.min(10000, Math.round(a.total_elevation_gain)) }),
    ...(splitsFrom(a, sport) && { splits: splitsFrom(a, sport) }),
  };
}
