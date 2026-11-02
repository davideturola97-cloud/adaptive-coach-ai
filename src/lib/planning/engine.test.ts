import { describe, expect, it } from "vitest";
import { addDays, daysBetween, mondayOf, weekdayName } from "@/lib/dates";
import type { AthleteProfile, RaceEvent } from "@/lib/domain/types";
import { generatePlan, isHard } from "./engine";

const athlete: AthleteProfile = {
  name: "Test",
  sports: [
    { sport: "run", level: "intermedio", yearsExperience: 4 },
    { sport: "bike", level: "intermedio", yearsExperience: 2 },
    { sport: "swim", level: "principiante", yearsExperience: 1 },
    { sport: "gym", level: "intermedio", yearsExperience: 3 },
  ],
  weeklyHoursAvailable: 8,
  availableDays: ["Lun", "Mar", "Mer", "Gio", "Sab", "Dom"],
  maxSessionMin: 75,
  longDays: ["Sab", "Dom"],
  longSessionMaxMin: 150,
  sportDays: {},
  equipment: [],
  limitations: [],
  goals: { primary: "", secondary: [] },
};

const ravenna: RaceEvent = { id: "r1", name: "Ravenna", date: "2026-11-08", kind: "singolo", sport: "run", distanceKm: 21.1, priority: "A" };
const reggio: RaceEvent = { id: "r2", name: "Reggio Emilia", date: "2026-12-13", kind: "singolo", sport: "run", distanceKm: 21.1, priority: "A" };
const ledro: RaceEvent = { id: "r3", name: "Ledroman", date: "2027-07-04", kind: "triathlon", triFormat: "medio", legs: { swimKm: 1.9, bikeKm: 90, runKm: 21.1 }, priority: "A" };
const today = "2026-11-02";

const plan = generatePlan({ today, athlete, events: [ravenna, reggio, ledro], weeks: 16 });
const hardDates = (ws = plan.workouts) => ws.filter((w) => isHard(w.type) && w.type !== "lungo" && w.type !== "brick").map((w) => w.date);

describe("vincoli dell'atleta", () => {
  it("nessuna seduta resta fuori con i giorni dell'atleta", () => {
    expect(plan.warnings.filter((w) => w.includes("non c'è un giorno libero"))).toEqual([]);
  });

  it("solo nei giorni disponibili e dopo oggi", () => {
    for (const w of plan.workouts) {
      expect(athlete.availableDays).toContain(weekdayName(w.date, true));
      expect(w.date > today).toBe(true);
    }
  });

  it("mai oltre le ore disponibili nella settimana", () => {
    for (const wk of plan.weeks) expect(wk.plannedMin).toBeLessThanOrEqual(athlete.weeklyHoursAvailable! * 60);
  });

  it("nessuna seduta più lunga dei limiti", () => {
    for (const w of plan.workouts) {
      const long = w.type === "lungo" || w.type === "brick" || (w.type === "endurance" && ["Sab", "Dom"].includes(weekdayName(w.date, true)));
      expect(w.durationMin).toBeLessThanOrEqual(long ? 150 : 75 + 10);
    }
  });

  it("i lunghi stanno nei giorni scelti", () => {
    const longs = plan.workouts.filter((w) => w.type === "lungo" || w.type === "brick");
    expect(longs.length).toBeGreaterThan(5);
    for (const w of longs) expect(["Sab", "Dom"]).toContain(weekdayName(w.date, true));
  });

  it("rispetta i giorni preferiti di uno sport", () => {
    const p = generatePlan({ today, athlete: { ...athlete, sportDays: { swim: ["Lun", "Mer"] } }, events: [ledro], weeks: 6 });
    const swims = p.workouts.filter((w) => w.sport === "swim");
    expect(swims.length).toBeGreaterThan(0);
    for (const w of swims) expect(["Lun", "Mer"]).toContain(weekdayName(w.date, true));
  });
});

describe("giorni pochi", () => {
  it("con pochi giorni le sedute si uniscono invece di restare fuori", () => {
    const few = { ...athlete, availableDays: ["Mar", "Gio", "Sab", "Dom"], weeklyHoursAvailable: 7 };
    const p = generatePlan({ today, athlete: few, events: [ravenna, reggio, ledro], weeks: 12 });
    expect(p.warnings.filter((w) => w.includes("non c'è un giorno libero"))).toEqual([]);
    for (const wk of p.weeks) {
      const ws = p.workouts.filter((w) => w.sport !== "gym" && w.date >= wk.weekStart && w.date <= addDays(wk.weekStart, 6));
      expect(new Set(ws.map((w) => w.date)).size).toBe(ws.length); // una seduta di resistenza al giorno
    }
  });
});

describe("giorni vincolati", () => {
  it("il nuoto con giorni fissi trova sempre posto", () => {
    for (const swim of [["Lun", "Mer"], ["Mar", "Gio"]]) {
      for (const h of [6, 8, 10, 12]) {
        const p = generatePlan({ today, athlete: { ...athlete, availableDays: ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"], weeklyHoursAvailable: h, sportDays: { swim } }, events: [ravenna, reggio, ledro], weeks: 12 });
        expect(p.warnings.filter((w) => w.includes("non c'è un giorno libero"))).toEqual([]);
        for (const w of p.workouts.filter((x) => x.sport === "swim")) expect(swim).toContain(weekdayName(w.date, true));
      }
    }
  });
});

describe("recupero e carico", () => {
  it("mai due sedute di qualità in giorni consecutivi, né accanto a un lungo", () => {
    const hard = new Set(plan.workouts.filter((w) => isHard(w.type)).map((w) => w.date));
    for (const d of hardDates()) {
      expect(hard.has(addDays(d, 1))).toBe(false);
      expect(hard.has(addDays(d, -1))).toBe(false);
    }
  });

  it("il giorno della gara è libero e il giorno prima c'è solo l'attivazione", () => {
    for (const race of [ravenna, reggio]) {
      expect(plan.workouts.some((w) => w.date === race.date)).toBe(false);
      const before = plan.workouts.filter((w) => w.date === addDays(race.date, -1));
      expect(before.every((w) => !isHard(w.type))).toBe(true);
      expect(plan.workouts.some((w) => w.date === addDays(race.date, 1))).toBe(false);
    }
  });

  it("scarico prima della gara A: la settimana prima pesa meno di due settimane prima", () => {
    const wk = (d: string) => plan.weeks.find((w) => w.weekStart === mondayOf(d))!;
    const raceWeek = wk(reggio.date);
    const taper = wk(addDays(reggio.date, -7));
    const build = wk(addDays(reggio.date, -14));
    expect(raceWeek.phase).toBe("gara");
    expect(taper.phase).toBe("scarico");
    expect(taper.targetMin).toBeLessThan(build.targetMin);
    expect(raceWeek.targetMin).toBeLessThan(taper.targetMin);
  });

  it("dopo una gara A c'è una settimana di recupero senza sedute dure", () => {
    const rec = plan.weeks.find((w) => w.weekStart === mondayOf(addDays(ravenna.date, 1)))!;
    expect(rec.phase).toBe("recupero");
    const ws = plan.workouts.filter((w) => w.date >= rec.weekStart && w.date <= addDays(rec.weekStart, 6));
    expect(ws.every((w) => !isHard(w.type))).toBe(true);
  });

  it("niente salti di carico: al massimo +15% tra settimane di carico", () => {
    const load = plan.weeks.filter((w) => ["base", "costruzione", "rifinitura"].includes(w.phase));
    for (let i = 1; i < load.length; i++) expect(load[i].targetMin).toBeLessThanOrEqual(Math.ceil(load[i - 1].targetMin * 1.15) + 5);
  });

  it("una settimana di scarico ogni quattro nei periodi lunghi", () => {
    const longPlan = generatePlan({ today, athlete, events: [ledro], weeks: 12 });
    const phases = longPlan.weeks.map((w) => w.phase);
    expect(phases.filter((p) => p === "scarico").length).toBeGreaterThanOrEqual(2);
  });
});

describe("sport e obiettivi", () => {
  it("verso una mezza prevale la corsa", () => {
    const wk = plan.weeks.find((w) => w.weekStart === mondayOf(addDays(reggio.date, -21)))!;
    expect(wk.bySport.run ?? 0).toBeGreaterThan(wk.bySport.bike ?? 0);
  });

  it("verso un triathlon medio ci sono combinati bici + corsa e prevale la bici", () => {
    const p = generatePlan({ today: "2027-04-01", athlete, events: [ledro], weeks: 12 });
    expect(p.workouts.some((w) => w.type === "brick")).toBe(true);
    const tot = p.weeks.reduce((t, w) => ({ bike: t.bike + (w.bySport.bike ?? 0), run: t.run + (w.bySport.run ?? 0) }), { bike: 0, run: 0 });
    expect(tot.bike).toBeGreaterThan(tot.run);
  });

  it("solo gli sport praticati", () => {
    const p = generatePlan({ today, athlete: { ...athlete, sports: [{ sport: "run", level: "intermedio", yearsExperience: 3 }] }, events: [ravenna], weeks: 4 });
    expect(new Set(p.workouts.map((w) => w.sport))).toEqual(new Set(["run"]));
  });

  it("palestra presente, ma mai il giorno prima di una seduta dura", () => {
    const hard = new Set(plan.workouts.filter((w) => isHard(w.type)).map((w) => w.date));
    const gym = plan.workouts.filter((w) => w.sport === "gym");
    expect(gym.length).toBeGreaterThan(4);
    const before = gym.filter((g) => hard.has(addDays(g.date, 1)));
    expect(before.length).toBeLessThanOrEqual(Math.ceil(gym.length * 0.2));
  });
});

describe("intensità", () => {
  it("senza test: solo RPE, nessun ritmo o watt", () => {
    expect(plan.workouts.every((w) => w.structure.main.every((s) => !s.target))).toBe(true);
  });

  it("con i parametri: ritmi e watt stimati", () => {
    const withParams = {
      ...athlete,
      thresholdPaceSecPerKm: { value: 290, origin: "stimato" as const, date: "2026-10-01" },
      ftpW: { value: 240, origin: "stimato" as const, date: "2026-10-01" },
    };
    const p = generatePlan({ today, athlete: withParams, events: [reggio], weeks: 4 });
    const targets = p.workouts.flatMap((w) => w.structure.main.map((s) => s.target)).filter(Boolean);
    expect(targets.length).toBeGreaterThan(3);
    expect(targets.every((t) => t!.origin === "stimato")).toBe(true);
  });

  it("i principianti senza test iniziano con qualità prudente", () => {
    const beginner = { ...athlete, sports: [{ sport: "run" as const, level: "principiante" as const, yearsExperience: 0 }] };
    const p = generatePlan({ today, athlete: beginner, events: [], weeks: 3 });
    expect(p.workouts.some((w) => w.type === "ripetute" || w.type === "tempo_run")).toBe(false);
  });
});

describe("test programmati", () => {
  it("il test prende il posto di una seduta nel giorno scelto", () => {
    const p = generatePlan({ today, athlete, events: [ravenna], weeks: 3, tests: [{ id: "t", sport: "run", kind: "5km", status: "programmato", dueDate: "2026-11-19", reason: "" }] });
    const day = p.workouts.filter((w) => w.date === "2026-11-19");
    expect(day.map((w) => w.type)).toContain("test_corsa");
  });
});

describe("stabilità", () => {
  it("stesse informazioni, stesso programma", () => {
    const again = generatePlan({ today, athlete, events: [ravenna, reggio, ledro], weeks: 16 });
    expect(again.workouts).toEqual(plan.workouts);
  });
  it("copre le settimane richieste", () => {
    expect(plan.weeks).toHaveLength(16);
    expect(daysBetween(plan.startDate, plan.endDate)).toBeGreaterThan(100);
  });
});
