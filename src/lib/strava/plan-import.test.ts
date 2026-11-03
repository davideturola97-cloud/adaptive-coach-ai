import { describe, expect, it } from "vitest";
import type { CompletedActivity, PlannedWorkout } from "@/lib/domain/types";
import { planImport } from "./plan-import";
import type { StravaActivity } from "./mapping";

const s = (id: number, sport: string, day: string, min: number): StravaActivity => ({
  id, name: `A${id}`, sport_type: sport, start_date: `${day}T07:00:00Z`, start_date_local: `${day}T08:00:00Z`, moving_time: min * 60, elapsed_time: min * 60, distance: 10000,
});
const planned = (id: string, sport: "run" | "bike", date: string) => ({ id, sport, date, status: "programmato" } as PlannedWorkout);

describe("cosa importare da Strava", () => {
  it("salta doppioni, sport non seguiti e attività già registrate a mano; collega il programma", () => {
    const existing = [
      { id: "x", date: "2026-11-01", sport: "run", durationMin: 40, title: "", source: "strava", externalId: "strava:1" },
      { id: "y", date: "2026-11-02", sport: "bike", durationMin: 62, title: "Bici", source: "manuale" },
    ] as (CompletedActivity & { externalId?: string })[];
    const p = planImport(
      [s(3, "Run", "2026-11-03", 45), s(1, "Run", "2026-11-01", 40), s(2, "Ride", "2026-11-02", 60), s(4, "Walk", "2026-11-03", 30), s(5, "Run", "2026-11-03", 20)],
      existing,
      [planned("p1", "run", "2026-11-03")],
    );
    expect(p.alreadyImported).toBe(1);
    expect(p.alreadyLogged).toEqual([{ title: "A2", date: "2026-11-02" }]);
    expect(p.unsupported).toEqual(["Walk"]);
    expect(p.toImport.map((a) => [a.stravaId, a.plannedId])).toEqual([[3, "p1"], [5, undefined]]); // una seduta, un'attività
  });
});
