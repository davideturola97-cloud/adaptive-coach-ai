import { describe, expect, it } from "vitest";
import type { CompletedActivity, PlannedWorkout } from "@/lib/domain/types";
import { paceRange, paceReference, thresholdOn, withRunPaces } from "./run-paces";
import { template } from "./templates";

const w = (type: PlannedWorkout["type"]) => ({ ...template(type), id: "x", date: "2026-11-05", status: "programmato" } as PlannedWorkout);
const REF = { thresholdSec: 280, source: "test del 01/11", fiveKPaceSec: 268 }; // soglia 4:40 /km

describe("passi al km per le sedute di corsa", () => {
  it("formato: prima il più veloce, arrotondato a 5 secondi", () => {
    expect(paceRange(280, [0.92, 0.96])).toBe("4:20 – 4:30 /km");
  });

  it("ripetute: passo, metri per ripetuta, recuperi, riscaldamento e defaticamento", () => {
    const r = withRunPaces(w("ripetute"), REF);
    expect(r.structure.main[0].target).toEqual({ value: "4:20 – 4:30 /km (≈ 670–690 m ogni frazione)", origin: "stimato" });
    expect(r.structure.recoveryTarget?.value).toBe("6:20 – 7:15 /km");
    expect(r.structure.warmup[0].target?.value).toBe("5:50 – 6:30 /km");
    expect(r.structure.cooldown[0].target?.value).toBe("6:00 – 6:45 /km");
    expect(r.paceSource).toBe("test del 01/11");
  });

  it("ogni tipo di corsa ha il suo passo; bici e sedute senza riferimento invariate", () => {
    expect(withRunPaces(w("corsa_facile"), REF).structure.main[0].target?.value).toBe("5:35 – 6:10 /km");
    expect(withRunPaces(w("tempo_run"), REF).structure.main[0].target?.value).toMatch(/^4:35 – 4:50 \/km \(≈ 2\d{3}–2\d{3} m ogni blocco\)$/);
    expect(withRunPaces(w("lungo"), REF).structure.main[0].target?.value).toBe("5:20 – 5:55 /km");
    expect(withRunPaces(w("progressivo"), REF).structure.main[0].target?.value).toMatch(/^da 5:50 a 4:45/);
    expect(withRunPaces(w("test_corsa"), REF).structure.main[0].target?.value).toMatch(/^parti a 4:35/);
    const bike = w("endurance");
    expect(withRunPaces(bike, REF)).toBe(bike);
    expect(withRunPaces(w("ripetute"), null).structure.main[0].target).toBeUndefined();
  });

  it("riferimento: test recente, altrimenti previsione dagli allenamenti, altrimenti niente", () => {
    const today = "2026-11-03";
    const recent = { thresholdPaceSecPerKm: { value: 280, origin: "stimato" as const, date: "2026-10-20" } };
    expect(paceReference(recent, [], [], today)?.source).toBe("test del 20/10");
    const runs: CompletedActivity[] = [{ id: "a", date: "2026-10-30", sport: "run", title: "", durationMin: 45, distanceKm: 10, source: "strava", feedback: { rpe: 9, muscleFatigue: 3, cardioFatigue: 4, feeling: "buono" } }];
    const fromRuns = paceReference({}, runs, [], today)!;
    expect(fromRuns.source).toMatch(/previsione dai tuoi allenamenti \(10 km in 45:00, affidabilità alta\)/);
    expect(fromRuns.thresholdSec).toBeCloseTo(270 * 1.04);
    const old = { thresholdPaceSecPerKm: { value: 300, origin: "stimato" as const, date: "2026-01-10" } };
    expect(paceReference(old, runs, [], today)?.source).toMatch(/previsione/);
    expect(paceReference(old, [], [], today)?.source).toMatch(/non recente/);
    expect(paceReference({}, [], [], today)).toBeNull();
    // Test recente ma corsa a tutta ancora più recente: vince la forma attuale.
    const olderTest = { thresholdPaceSecPerKm: { value: 300, origin: "stimato" as const, date: "2026-10-01" } };
    expect(paceReference(olderTest, runs, [], today)?.source).toMatch(/previsione/);
  });
});

describe("riferimento: vince la prova più forte", () => {
  const today = "2026-11-03";
  const run = (id: string, date: string, km: number, min: number, hr?: number, rpe?: number): CompletedActivity => ({ id, date, sport: "run", title: "", durationMin: min, distanceKm: km, avgHr: hr, source: "strava", ...(rpe && { feedback: { rpe } }) });
  it("test lento ma gara recente più veloce: si usa la gara", () => {
    const test = { thresholdPaceSecPerKm: { value: 300, origin: "stimato" as const, date: "2026-10-01" } };
    const r = paceReference(test, [run("g", "2026-10-26", 10, 42, undefined, 9)], [], today)!;
    expect(r.source).toMatch(/previsione/);
    expect(r.thresholdSec).toBeCloseTo(252 * 1.04, 0);
  });
  it("test veloce e solo corse facili più recenti: resta il test", () => {
    const test = { thresholdPaceSecPerKm: { value: 255, origin: "stimato" as const, date: "2026-10-01" } };
    const r = paceReference(test, [run("e", "2026-10-30", 10, 55, undefined, 4)], [], today)!;
    expect(r.source).toBe("test del 01/10");
  });
});

describe("allenarsi per migliorare: passi che progrediscono verso l'obiettivo", () => {
  const today = "2026-11-06";
  const reggio = { id: "r", name: "Reggio Emilia", date: "2026-12-13", kind: "singolo" as const, sport: "run" as const, distanceKm: 21.0975, priority: "A" as const };
  const hard = (date: string, km: number, min: number): CompletedActivity => ({ id: date, date, sport: "run", title: "", durationMin: min, distanceKm: km, source: "strava", feedback: { rpe: 9 } });
  const acts = [hard("2026-10-25", 10, 45), hard("2026-10-18", 21.0975, 102)];

  it("la soglia scende ogni settimana fino all'obiettivo, raggiunto 10 giorni prima della gara", () => {
    const ref = paceReference({}, acts, [], today, [reggio])!;
    expect(ref.targets?.[0]).toMatchObject({ raceName: "Reggio Emilia", goalSource: "possibile" });
    const t0 = thresholdOn(ref, today).t;
    const mid = thresholdOn(ref, "2026-11-20").t;
    const end = thresholdOn(ref, "2026-12-05").t;
    expect(t0).toBeCloseTo(ref.thresholdSec);
    expect(mid).toBeLessThan(t0);
    expect(end).toBeLessThan(mid);
    expect(end).toBeCloseTo(ref.targets![0].goalThresholdSec);
    expect(thresholdOn(ref, "2026-12-10").t).toBeCloseTo(end); // in scarico resta lì
  });

  it("il ritmo gara usa il tuo obiettivo; oltre l'ambizioso la progressione si ferma e te lo dice", () => {
    const mine = { ...reggio, goalTimeSec: 99 * 60 }; // 1:39:00
    const ref = paceReference({}, acts, [], today, [mine])!;
    expect(ref.targets![0].goalSource).toBe("tuo");
    const w = withRunPaces({ ...template("tempo_run"), id: "x", date: "2026-11-25", status: "programmato", structure: { warmup: [], main: [{ label: "3 km", distanceKm: 3, repeat: 3, rpe: [6, 7], zone: "mezza" }], cooldown: [] } } as unknown as PlannedWorkout, ref);
    expect(w.structure.main[0].target?.value).toMatch(/^4:39 – 4:45 \/km \(ritmo obiettivo Reggio Emilia\)/);
    expect(w.paceSource).toMatch(/verso Reggio Emilia in 1:39:00 \(il tuo obiettivo\)/);
    const wild = paceReference({}, acts, [], today, [{ ...reggio, goalTimeSec: 85 * 60 }])!;
    expect(wild.targets![0].ambitious).toBe(true);
    expect(withRunPaces({ ...template("corsa_facile"), id: "y", date: "2026-11-25", status: "programmato" } as PlannedWorkout, wild).paceSource).toMatch(/più veloce dell'"ambizioso"/);
  });
});

describe("obiettivo facile", () => {
  it("i ritmi migliorano lo stesso verso il possibile", () => {
    const today = "2026-11-06";
    const easy = { id: "r", name: "Reggio", date: "2026-12-13", kind: "singolo" as const, sport: "run" as const, distanceKm: 21.0975, priority: "A" as const, goalTimeSec: 115 * 60 };
    const acts = [{ id: "h", date: "2026-10-25", sport: "run" as const, title: "", durationMin: 45, distanceKm: 10, source: "strava" as const, feedback: { rpe: 9 } }];
    const ref = paceReference({}, acts, [], today, [easy])!;
    expect(ref.targets![0].easyGoal).toBe(true);
    expect(thresholdOn(ref, "2026-12-05").t).toBeLessThan(ref.thresholdSec);
  });
});
