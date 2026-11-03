import { describe, expect, it } from "vitest";
import type { CompletedActivity, PlannedWorkout } from "@/lib/domain/types";
import { bestSegments, exponentFor, formatRaceTime, predictRaces, type Prediction } from "./predictions";

const run = (id: string, date: string, km: number, min: number, rpe?: number, splits?: CompletedActivity["splits"]): CompletedActivity => ({
  id, date, sport: "run", title: "", durationMin: min, distanceKm: km, source: "strava", splits,
  ...(rpe && { feedback: { rpe, muscleFatigue: 3, cardioFatigue: 3, feeling: "buono" } }),
});
const TODAY = "2026-11-03";

describe("previsioni di gara", () => {
  it("formato dei tempi", () => {
    expect(formatRaceTime(1475)).toBe("24:35");
    expect(formatRaceTime(6330)).toBe("1:45:30");
  });

  it("tratti più veloci dagli intertempi", () => {
    const splits = [320, 300, 290, 295, 310, 330].map((p, i) => ({ n: i + 1, km: 1, paceSec: p }));
    const seg = bestSegments(splits);
    expect(seg).toEqual([{ km: 3, timeSec: 885 }, { km: 5, timeSec: 1515 }]);
    // Un parziale senza passo: niente tratti (il buco falserebbe il conto).
    expect(bestSegments([...splits.slice(0, 3), { n: 4, km: 1 }, ...splits.slice(4)])).toEqual([]);
  });

  it("esponente più alto con poco volume e lunghi corti", () => {
    expect(exponentFor(5, 10, 10, 5)).toBe(1.06); // scendere di distanza: Riegel standard
    expect(exponentFor(42.195, 10, 50, 30)).toBe(1.06);
    expect(exponentFor(42.195, 10, 15, 15)).toBeCloseTo(1.12);
    expect(exponentFor(21.0975, 10, 30, 10)).toBeCloseTo(1.09);
  });

  it("da una gara recente a tutta: affidabilità alta vicino alla distanza, bassa sulla maratona senza lunghi", () => {
    const acts = [
      run("a", "2026-10-25", 10, 45, 9), // 10 km in 45:00 a tutta
      run("b", "2026-10-28", 8, 44, 4),
      run("c", "2026-10-31", 14, 75, 5),
      run("d", "2026-10-20", 12, 64, 4),
    ];
    const r = predictRaces(acts, [], {}, TODAY);
    const by = Object.fromEntries(r.predictions.map((p) => [p.key, p]));
    expect(by["10k"].timeSec).toBe(2700);
    expect(by["10k"].confidence).toBe("alta");
    expect(Math.round(by["5k"].timeSec)).toBe(Math.round(2700 * Math.pow(0.5, 1.06)));
    expect(by["marathon"].confidence).toBe("bassa");
    expect(by["marathon"].notes.join(" ")).toMatch(/lungo più lungo/);
    expect(by["half"].timeSec).toBeGreaterThan(2700 * Math.pow(2.10975, 1.06)); // più prudente per il volume basso
  });

  it("solo corse facili: previsione prudente dichiarata", () => {
    const r = predictRaces([run("a", "2026-10-30", 8, 48, 4)], [], {}, TODAY);
    expect(r.predictions[0].confidence).not.toBe("alta");
    expect(r.predictions[0].notes.join(" ")).toMatch(/più veloce di così/);
  });

  it("usa il test di soglia e segnala il miglioramento", () => {
    const thr = { value: 280, origin: "stimato" as const, date: "2026-10-15" };
    const r = predictRaces([run("a", "2026-09-20", 10, 50, 9)], [], { thresholdPaceSecPerKm: thr }, TODAY);
    const tenK = r.predictions.find((p) => p.key === "10k")!;
    expect(tenK.basedOn.label).toMatch(/test del 15\/10/);
    expect(Math.round(tenK.timeSec)).toBe(Math.round((280 / 1.04) * 10));
    expect(r.trend!["10k"]).toBeLessThan(0);
  });

  it("niente corse: nessuna previsione e una spiegazione", () => {
    const r = predictRaces([], [] as PlannedWorkout[], {}, TODAY);
    expect(r.predictions).toEqual([]);
    expect(r.notes[0]).toMatch(/almeno 3 km/);
  });
});

describe("tre obiettivi di gara", () => {
  const p: Prediction = { key: "half", label: "Mezza", km: 21.0975, timeSec: 6300, paceSec: 298.6, lowSec: 6237, highSec: 6552, confidence: "media", basedOn: { km: 10, timeSec: 2700, date: "2026-10-25", label: "", hard: true }, notes: [] };
  it("sicuro > possibile > ambizioso, con miglioramento dalle settimane che mancano", async () => {
    const { raceGoals } = await import("./predictions");
    const near = raceGoals({ ...p }, 1);
    expect(near.gain).toBe(0);
    expect(near.sicuro).toBe(6552);
    expect(near.possibile).toBe(6300);
    expect(Math.round(near.ambizioso)).toBe(Math.round(6300 * 0.985));
    const far = raceGoals({ ...p }, 6); // 5 settimane utili: 2%
    expect(far.gain).toBeCloseTo(0.02);
    expect(far.possibile).toBeCloseTo(6300 * 0.99);
    expect(far.sicuro).toBeGreaterThan(far.possibile);
    expect(far.possibile).toBeGreaterThan(far.ambizioso);
    expect(raceGoals({ ...p, confidence: "bassa" }, 6).gain).toBeCloseTo(0.01);
  });
});
