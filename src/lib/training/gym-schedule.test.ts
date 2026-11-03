import { describe, expect, it } from "vitest";
import { addDays, weekdayName } from "@/lib/dates";
import type { AthleteProfile, GymDay, PlannedWorkout, RaceEvent } from "@/lib/domain/types";
import { generatePlan } from "@/lib/planning/engine";
import { gymAdvice, gymLabel, legLoad } from "./gym-schedule";

const scheda: GymDay[] = [
  { day: "Lun", groups: ["petto", "tricipiti"], durationMin: 60 },
  { day: "Mar", groups: ["schiena", "bicipiti"], durationMin: 60 },
  { day: "Gio", groups: ["gambe"], durationMin: 60 },
  { day: "Ven", groups: ["parte alta"], durationMin: 45 },
];
const athlete: AthleteProfile = {
  name: "T",
  sports: [{ sport: "run", level: "intermedio", yearsExperience: 4 }, { sport: "gym", level: "intermedio", yearsExperience: 3 }],
  weeklyHoursAvailable: 6, availableDays: ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"], maxSessionMin: 80, longDays: ["Dom"], longSessionMaxMin: 120,
  sportDays: {}, equipment: [], limitations: [], goals: { primary: "", secondary: [] },
};
const TODAY = "2026-11-16"; // lunedì
const w = (date: string, type: PlannedWorkout["type"], title: string, sport: PlannedWorkout["sport"] = "run") =>
  ({ id: date, date, type, title, sport, status: "programmato", durationMin: 60, structure: { warmup: [], main: [], cooldown: [] } }) as unknown as PlannedWorkout;

describe("scheda di palestra", () => {
  it("riconosce il carico sulle gambe", () => {
    expect(legLoad({ groups: ["gambe"] })).toBe("pesante");
    expect(legLoad({ groups: ["petto", "tricipiti"] })).toBeNull();
    expect(legLoad({ groups: ["total body"] })).toBe("medio");
    expect(gymLabel({ groups: ["schiena", "bicipiti"] })).toBe("Palestra: schiena e bicipiti");
  });

  it("gambe il giorno prima delle ripetute: avviso con alternativa", () => {
    const plan = [w("2026-11-18", "tempo_run", "Soglia 3 × 10'"), w("2026-11-20", "ripetute", "Ripetute VO₂max 5 × 1 km"), w("2026-11-22", "lungo", "Lungo")];
    const adv = gymAdvice(scheda, plan, [], athlete, TODAY);
    const a = adv.find((x) => x.level === "attenzione")!;
    expect(a.text).toMatch(/Giovedì gambe e venerdì ripetute vo₂max 5 × 1 km: le gambe arrivano stanche/);
    expect(a.text).toMatch(/Sposta le gambe a mercoledì dopo soglia 3 × 10'/);
  });

  it("vicino a una gara: niente gambe; senza conflitti lo dice", () => {
    const race: RaceEvent = { id: "r", name: "Reggio", date: "2026-11-22", kind: "singolo", sport: "run", distanceKm: 21.1, priority: "A" };
    const adv = gymAdvice(scheda, [], [race], athlete, TODAY);
    expect(adv.some((x) => /Giovedì: gambe a 3 giorni da Reggio/.test(x.text))).toBe(true);
    const ok = gymAdvice([{ day: "Mer", groups: ["gambe", "core"], durationMin: 60 }], [w("2026-11-18", "ripetute", "Ripetute")], [], athlete, TODAY);
    expect(ok[0]).toMatchObject({ level: "ok" });
    expect(ok.some((x) => /lo stesso giorno di ripetute/.test(x.text))).toBe(true);
  });

  it("il programma rispetta la scheda: palestra nei suoi giorni, niente sedute chiave il giorno dopo le gambe", () => {
    const p = generatePlan({ today: "2026-11-15", athlete: { ...athlete, gymSchedule: scheda }, events: [], weeks: 6 });
    const gym = p.workouts.filter((x) => x.sport === "gym");
    expect(gym.length).toBeGreaterThanOrEqual(20);
    for (const g of gym) expect(["Lun", "Mar", "Gio", "Ven"]).toContain(weekdayName(g.date, true));
    expect(gym.find((g) => weekdayName(g.date, true) === "Gio")!.title).toBe("Palestra: gambe");
    const key = ["ripetute", "tempo_run", "lungo", "progressivo"];
    for (const x of p.workouts.filter((x) => x.sport === "run" && key.includes(x.type))) {
      expect(weekdayName(x.date, true), `${x.title} il ${x.date}`).not.toBe("Ven");
    }
    // In settimana di gara le gambe diventano parte alta o mobilità.
    const race: RaceEvent = { id: "r", name: "Gara", date: "2026-11-29", kind: "singolo", sport: "run", distanceKm: 10, priority: "A" };
    const pr = generatePlan({ today: "2026-11-15", athlete: { ...athlete, gymSchedule: scheda }, events: [race], weeks: 2 });
    const thu = pr.workouts.find((x) => x.sport === "gym" && x.date === addDays(race.date, -3))!;
    expect(thu.title).toMatch(/settimana di gara/);
  });
});
