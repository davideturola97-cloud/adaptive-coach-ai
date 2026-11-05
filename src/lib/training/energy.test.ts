import { describe, expect, it } from "vitest";
import type { AthleteProfile, PlannedWorkout, RaceEvent } from "@/lib/domain/types";
import { bmr, energyDay, sessionKcal } from "./energy";

const a = { name: "D", birthDate: "1997-01-01", sex: "M", heightCm: 178, weightKg: 70, dailyActivity: "sedentario", sports: [], availableDays: [], longDays: [], sportDays: {}, equipment: [], limitations: [], goals: { primary: "", secondary: [] } } as AthleteProfile;
const D = "2026-11-05";
const w = (type: PlannedWorkout["type"], sport: PlannedWorkout["sport"], min: number, km?: number) => ({ id: type, date: D, sport, type, title: type, durationMin: min, distanceKm: km, status: "programmato", structure: { warmup: [], main: [], cooldown: [] } }) as unknown as PlannedWorkout;

describe("fabbisogno della giornata", () => {
  it("metabolismo a riposo (Mifflin-St Jeor)", () => {
    expect(bmr(a, D)).toBe(Math.round(700 + 6.25 * 178 - 5 * 29 + 5));
    expect(bmr({ ...a, weightKg: undefined }, D)).toBeNull();
  });
  it("calorie delle sedute", () => {
    expect(sessionKcal({ sport: "run", minutes: 50, distanceKm: 10 }, 70, "media")).toBe(665);
    expect(sessionKcal({ sport: "bike", minutes: 60, avgPowerW: 200 }, 70, "media")).toBe(720);
    expect(sessionKcal({ sport: "swim", minutes: 45 }, 70, "facile")).toBe(Math.round(5 * 70 * 0.75));
  });
  it("riposo, giornata dura e vigilia di gara", () => {
    const rest = energyDay(a, [], [], [], D)!;
    expect(rest.dayType).toBe("riposo");
    expect(rest.total).toBe(Math.round(Math.round(bmr(a, D)! * 1.3) / 50) * 50);
    expect(rest.carbsG).toBe(210);
    const hard = energyDay(a, [w("ripetute", "run", 60, 12), w("forza_generale", "gym", 45)], [], [], D)!;
    expect(hard.dayType).toBe("moderata");
    expect(hard.training).toBeGreaterThan(800);
    expect(hard.total).toBeGreaterThan(rest.total + 800);
    const race: RaceEvent = { id: "r", name: "Ravenna", date: "2026-11-06", kind: "singolo", sport: "run", distanceKm: 21.1, priority: "A" };
    const pre = energyDay(a, [w("recupero_corsa", "run", 25, 4)], [], [race], D)!;
    expect(pre.dayType).toBe("pre-gara");
    expect(pre.carbsG).toBeGreaterThanOrEqual(r(70 * 7));
    expect(pre.fatG).toBeGreaterThanOrEqual(55);
    expect(pre.notes[0]).toMatch(/Domani c'è Ravenna/);
  });
});
const r = (x: number) => Math.round(x / 5) * 5;
