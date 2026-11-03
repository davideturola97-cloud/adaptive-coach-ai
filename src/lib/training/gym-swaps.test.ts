import { describe, expect, it } from "vitest";
import type { PlannedWorkout, RaceEvent, WorkoutStep } from "@/lib/domain/types";
import { applySwaps, proposeSwaps, swapContext, swapSuggestion } from "./gym-swaps";

const step = (name: string, sets: number, reps: string, loadKg?: number): WorkoutStep => ({ label: name, durationMin: 8, rpe: [6, 8], exercise: { name, sets, reps, ...(loadKg && { loadKg }), restSec: 120 } });
const gym = (date: string, main: WorkoutStep[]): PlannedWorkout => ({
  id: "g", date, sport: "gym", type: "forza_specifica", title: "Palestra: gambe", objective: "La tua scheda.", durationMin: 60, intensity: "", status: "programmato",
  structure: { warmup: [{ label: "Riscaldamento", durationMin: 10, rpe: [2, 3] }], main, cooldown: [{ label: "Allungamento", durationMin: 5, rpe: [1, 2] }] },
  technicalTips: [], safetyNotes: [],
});
const run = (date: string, type: PlannedWorkout["type"], title: string, status: PlannedWorkout["status"] = "completato") =>
  ({ id: date, date, sport: "run", type, title, status, durationMin: 55, structure: { warmup: [], main: [], cooldown: [] } }) as unknown as PlannedWorkout;

const legs = [step("Squat", 4, "8", 70), step("Affondi", 3, "10", 16), step("Stacco rumeno", 3, "8", 50), step("Plank", 3, "45″")];

describe("sostituzioni in palestra", () => {
  it("l'esempio dell'atleta: mercoledì ripetute, giovedì gambe → pressa al posto dello squat", () => {
    const thu = gym("2026-11-05", legs);
    const plan = [run("2026-11-04", "ripetute", "Ripetute VO₂max 5 × 1 km"), thu];
    const sug = swapSuggestion(thu, { plan, activities: [], events: [], checkins: [] })!;
    expect(sug.reasons).toEqual(["ieri ripetute vo₂max 5 × 1 km: gambe ancora affaticate"]);
    expect(sug.swaps.map((s) => s.to)).toEqual([
      "Leg press 3 × 10-12 · recupero 1'30″ · carico moderato: 3 ripetizioni di margine (RPE 6)",
      "Step up basso 2 × 10 per gamba · recupero 1' · corpo libero o manubri leggeri",
      "Ponte glutei 2 × 12 · recupero 1' · carico moderato: 3 ripetizioni di margine (RPE 6)",
    ]);
    expect(sug.swaps.some((s) => s.from.startsWith("Plank"))).toBe(false);
  });

  it("si applicano solo le sostituzioni scelte, alla sola seduta", () => {
    const thu = gym("2026-11-05", legs);
    const ctx = swapContext(thu, [run("2026-11-04", "ripetute", "Ripetute")], [], [], []);
    const chosen = proposeSwaps(thu, ctx).filter((s) => s.index === 0);
    const r = applySwaps(thu, chosen);
    expect(r.structure.main.map((s) => s.label)).toEqual(["Leg press", "Affondi", "Stacco rumeno", "Plank"]);
    expect(r.structure.main[0].note).toMatch(/al posto di squat/);
    expect(r.structure.main[0].exercise?.name).toBe("Leg press");
    expect(r.objective).toMatch(/Adattata dal coach: Squat → Leg press/);
  });

  it("niente motivi: nessuna proposta; gara a 3 giorni: gambe tolte; mattina con fastidio al polpaccio", () => {
    const thu = gym("2026-11-05", legs);
    expect(swapSuggestion(thu, { plan: [thu], activities: [], events: [], checkins: [] })).toBeNull();
    const race: RaceEvent = { id: "r", name: "Ravenna", date: "2026-11-08", kind: "singolo", sport: "run", distanceKm: 21.1, priority: "A" };
    const s = swapSuggestion(thu, { plan: [thu], activities: [], events: [race], checkins: [] })!;
    expect(s.swaps.slice(0, 3).every((x) => x.to === null)).toBe(true);
    const pain = swapSuggestion(thu, { plan: [thu], activities: [], events: [], checkins: [{ date: "2026-11-05", sleep: 4, fatigue: 2, pain: "leggero", painWhere: "polpaccio" }] })!;
    expect(pain.reasons).toEqual(["fastidio a polpaccio"]);
  });

  it("spalle prima del nuoto di qualità", () => {
    const mon = gym("2026-11-02", [step("Military press", 4, "8", 30), step("Trazioni", 3, "6")]);
    const swim = { ...run("2026-11-03", "css_nuoto", "Ritmo CSS 8 × 100 m", "programmato"), sport: "swim" } as PlannedWorkout;
    const s = swapSuggestion(mon, { plan: [mon, swim], activities: [], events: [], checkins: [] })!;
    expect(s.swaps.map((x) => x.to?.split(" ")[0])).toEqual(["Alzate", "Lat"]);
  });
});
