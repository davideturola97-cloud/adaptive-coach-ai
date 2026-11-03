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

describe("esercizi della scheda", () => {
  const gambe: GymDay = {
    day: "Gio", groups: ["gambe"], durationMin: 60,
    exercises: [
      { name: "Squat", sets: 4, reps: "8", loadKg: 60, restSec: 120 },
      { name: "Affondi", sets: 3, reps: "10", loadKg: 16, restSec: 90 },
      { name: "Plank", sets: 3, reps: "45″", restSec: 45 },
    ],
  };

  it("validazione: righe vuote ignorate, valori sbagliati segnalati", async () => {
    const { parseExercises } = await import("./gym-parse");
    expect(parseExercises(JSON.stringify([{ name: "Squat", sets: "4", reps: "8-10", loadKg: "62,5", restSec: "120" }, { name: "", sets: "3" }]), "Gio")).toEqual([
      { name: "Squat", sets: 4, reps: "8-10", loadKg: 62.5, restSec: 120 },
    ]);
    expect(parseExercises(JSON.stringify([{ name: "Plank", sets: "3", reps: "45″", loadKg: "", restSec: "45" }]), "Gio")).toEqual([{ name: "Plank", sets: 3, reps: "45″", restSec: 45 }]);
    expect(parseExercises(JSON.stringify([{ name: "Squat", sets: "40", reps: "8" }]), "Gio")).toMatch(/Gio, Squat: al massimo 10 serie/);
    expect(parseExercises(JSON.stringify([{ name: "Squat", sets: "4", reps: "tante" }]), "Gio")).toMatch(/ripetizioni non valide/);
  });

  it("le gambe si riconoscono anche dagli esercizi", () => {
    expect(legLoad({ groups: ["parte alta"], exercises: [{ name: "Squat bulgaro", sets: 3, reps: "8" }, { name: "Leg press", sets: 3, reps: "10" }] })).toBe("pesante");
  });

  it("consiglio con i numeri: gambe alleggerite il giorno prima delle ripetute", () => {
    const plan = [w("2026-11-20", "ripetute", "Ripetute VO₂max 5 × 1 km")];
    const a = gymAdvice([gambe], plan, [], athlete, TODAY).find((x) => x.level === "attenzione")!;
    expect(a.text).toMatch(/alleggerisci: squat 2 × 8 a 47,5 kg invece di 4 × 8 a 60 kg, affondi 2 × 10 a 12,5 kg invece di 3 × 10 a 16 kg/);
  });

  it("nel programma: gli esercizi diventano la seduta, in scarico meno serie e vicino alla gara niente gambe", () => {
    const sch: GymDay[] = [gambe, { day: "Lun", groups: ["petto"], durationMin: 45, exercises: [{ name: "Panca piana", sets: 4, reps: "8", loadKg: 60, restSec: 120 }] }];
    const race: RaceEvent = { id: "r", name: "Gara", date: "2026-12-13", kind: "singolo", sport: "run", distanceKm: 21.1, priority: "A" };
    const p = generatePlan({ today: "2026-11-15", athlete: { ...athlete, gymSchedule: sch }, events: [race], weeks: 4 });
    const first = p.workouts.find((x) => x.sport === "gym" && weekdayName(x.date, true) === "Gio")!;
    expect(first.structure.main.map((s) => [s.label, s.note])).toEqual([
      ["Squat", "4 × 8 · 60 kg · recupero 2'"],
      ["Affondi", "3 × 10 · 16 kg · recupero 1'30″"],
      ["Plank", "3 × 45″ · recupero 45″"],
    ]);
    const raceWeekThu = p.workouts.find((x) => x.sport === "gym" && x.date === "2026-12-10");
    expect(raceWeekThu?.structure.main.map((s) => s.label)).toEqual(["Plank"]);
    const taperMon = p.workouts.find((x) => x.sport === "gym" && x.date === "2026-12-07")!;
    expect(taperMon.structure.main[0].note).toMatch(/^2 × 8 · 60 kg/);
  });
});
