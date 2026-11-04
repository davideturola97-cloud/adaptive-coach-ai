import { describe, expect, it } from "vitest";
import { racePlan } from "./race-plan";

describe("piano gara", () => {
  it("mezza in 1:40: partenza più lenta, finale più veloce, tempo finale esatto", () => {
    const p = racePlan({ distanceKm: 21.0975 }, 6000)!;
    expect(p.segments.map((s) => [s.fromKm, Math.round(s.toKm * 10) / 10])).toEqual([[0, 5], [5, 17], [17, 21.1]]);
    const goal = 6000 / 21.0975;
    expect(p.segments[0].paceSec).toBeCloseTo(goal + 5);
    expect(p.segments[2].paceSec).toBeCloseTo(goal - 3);
    expect(p.splits.map((s) => s.km)).toEqual([5, 10, 15, 20, 21.0975]);
    expect(p.splits.at(-1)!.timeSec).toBe(6000);
    const total = p.segments.reduce((t, s) => t + (s.toKm - s.fromKm) * s.paceSec, 0);
    expect(total).toBeCloseTo(6000, 0);
    expect(p.fueling[0]).toMatch(/km 7 e al km 14/);
  });
  it("5 km: niente gel, riscaldamento più lungo", () => {
    const p = racePlan({ distanceKm: 5 }, 1320)!;
    expect(p.fueling[0]).toMatch(/niente gel/);
    expect(p.checklist[1].items.join(" ")).toMatch(/allunghi/);
  });
  it("distanza mancante: nessun piano", () => expect(racePlan({}, 3000)).toBeNull());
});
