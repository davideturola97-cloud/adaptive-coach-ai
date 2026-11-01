import { describe, expect, it } from "vitest";
import { buildDemoData } from "@/lib/demo/data";
import { adherence, dailyLoads, loadState, weeklySummaries } from "./analytics";

const demo = buildDemoData(new Date("2026-11-04T10:00:00"));

describe("dati dimostrativi", () => {
  it("hanno storico e programma futuro", () => {
    expect(demo.activities.length).toBeGreaterThan(20);
    expect(demo.plan.some((p) => p.date >= demo.today && p.status === "programmato")).toBe(true);
    expect(demo.plan.filter((p) => p.date >= demo.today).every((p) => p.status === "programmato")).toBe(true);
  });
  it("sono deterministici", () => {
    const again = buildDemoData(new Date("2026-11-04T10:00:00"));
    expect(again.activities).toEqual(demo.activities);
  });
  it("ogni seduta ha la struttura completa", () => {
    for (const w of demo.plan) {
      expect(w.structure.warmup.length).toBeGreaterThan(0);
      expect(w.structure.main.length).toBeGreaterThan(0);
      expect(w.structure.cooldown.length).toBeGreaterThan(0);
      expect(w.safetyNotes.length).toBeGreaterThan(0);
    }
  });
});

describe("analisi", () => {
  it("riepilogo settimanale con la settimana corrente per ultima", () => {
    const weeks = weeklySummaries(demo.activities, demo.plan, demo.today, 8);
    expect(weeks).toHaveLength(8);
    expect(weeks[7].weekStart).toBe("2026-11-02");
    expect(weeks[6].runKm).toBeGreaterThan(0);
  });
  it("28 carichi giornalieri", () => {
    expect(dailyLoads(demo.activities, demo.today)).toHaveLength(28);
  });
  it("stato del carico calcolato", () => {
    expect(loadState(demo.activities, demo.today).state).not.toBeNull();
  });
  it("aderenza tra 0 e 1", () => {
    const a = adherence(demo.plan, "2026-09-01", demo.today)!;
    expect(a).toBeGreaterThan(0.5);
    expect(a).toBeLessThanOrEqual(1);
  });
});
