import { describe, expect, it } from "vitest";
import type { PlannedWorkout } from "@/lib/domain/types";
import { readinessAdvice, type CheckIn } from "./readiness";
import { weeklyReview, reviewTarget } from "@/lib/planning/weekly-review";
import { generatePlan } from "@/lib/planning/engine";

const T = "2026-11-03";
const w = (type: PlannedWorkout["type"]) => ({ id: "x", date: T, sport: "run", type, title: type === "ripetute" ? "Ripetute 5 × 1 km" : "Corsa facile", status: "programmato", durationMin: 50, structure: { warmup: [], main: [], cooldown: [] } }) as unknown as PlannedWorkout;
const c = (o: Partial<CheckIn>): CheckIn => ({ date: T, sleep: 4, fatigue: 2, pain: "nessuno", ...o });

describe("controllo del mattino", () => {
  it("in forma: via libera", () => {
    expect(readinessAdvice(c({}), [w("ripetute")]).status).toBe("via libera");
  });
  it("dormito male e stanco con seduta dura: proposta più leggera", () => {
    const a = readinessAdvice(c({ sleep: 2, fatigue: 4 }), [w("ripetute")]);
    expect(a.status).toBe("attenzione");
    expect(a.disruption).toMatchObject({ kind: "stanco", from: T });
    expect(a.text).toMatch(/Hai dormito male e sei stanco: ripetute 5 × 1 km/);
  });
  it("stanco ma oggi seduta facile: nessuna modifica", () => {
    expect(readinessAdvice(c({ sleep: 2, fatigue: 4 }), [w("corsa_facile")]).status).toBe("via libera");
  });
  it("dolore forte: stop e invito a sentire un professionista", () => {
    const a = readinessAdvice(c({ pain: "forte", painWhere: "ginocchio" }), [w("corsa_facile")]);
    expect(a.status).toBe("stop");
    expect(a.text).toMatch(/ginocchio.*medico o un fisioterapista/);
    expect(a.disruption).toMatchObject({ kind: "dolore", painSevere: true, painSport: "run" });
  });
  it("tre mattine di fila molto stanco", () => {
    const recent = [c({ date: "2026-11-02", fatigue: 4 }), c({ date: "2026-11-01", fatigue: 4 })];
    expect(readinessAdvice(c({ fatigue: 4 }), [w("ripetute")], recent).text).toMatch(/Terza mattina di fila/);
  });
});

describe("revisione della settimana", () => {
  const athlete = { name: "T", sports: [{ sport: "run", level: "intermedio", yearsExperience: 4 }], weeklyHoursAvailable: 5, availableDays: ["Mar", "Gio", "Sab", "Dom"], maxSessionMin: 75, longDays: ["Dom"], longSessionMaxMin: 120, sportDays: {}, equipment: [], limitations: [], goals: { primary: "", secondary: [] } } as never;
  const base = generatePlan({ today: "2026-10-26", athlete, events: [], weeks: 4 }).workouts.map((x, i) => ({ ...x, id: `w${i}`, status: "programmato" as const }));
  const plan = base.map((p) => (p.date < "2026-11-07" ? { ...p, status: "saltato" as const } : p));

  it("solo da sabato a lunedì", () => {
    expect(reviewTarget("2026-11-07")).toBe("2026-11-09");
    expect(reviewTarget("2026-11-09")).toBe("2026-11-09");
    expect(reviewTarget("2026-11-05")).toBeNull();
  });
  it("settimana saltata: la prossima riparte più leggera, con le differenze giorno per giorno", () => {
    const r = weeklyReview({ today: "2026-11-07", athlete, events: [], plan, activities: [], plannedTests: [], checkins: [] })!;
    expect(r.targetMonday).toBe("2026-11-09");
    expect(r.factor).toBe(0.85);
    expect(r.summary[0]).toMatch(/Sedute fatte: 0 su \d+, \d+ saltate/);
    expect(r.decision).toMatch(/più leggera/);
    expect(r.draft.workouts.every((x) => x.date >= "2026-11-09")).toBe(true);
    expect(weeklyReview({ today: "2026-11-07", athlete, events: [], plan, activities: [], plannedTests: [], checkins: [], reviewedWeek: "2026-11-09" })).toBeNull();
  });
});
