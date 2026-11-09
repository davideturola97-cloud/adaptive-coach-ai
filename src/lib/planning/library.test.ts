import { describe, expect, it } from "vitest";
import type { PlannedWorkout, CompletedActivity } from "@/lib/domain/types";
import { buildSession, FAMILIES, fitLevel, workMinutes, type Family } from "./library";
import { trainingState } from "./progression";
import { qualityFamily } from "./engine";
import { withRunPaces } from "@/lib/training/run-paces";

const athlete = { sports: [{ sport: "run" as const, level: "intermedio" as const, yearsExperience: 4 }] };
const TODAY = "2026-11-03";

describe("libreria delle sedute", () => {
  it("i livelli crescono: più lavoro a ogni gradino", () => {
    for (const f of Object.keys(FAMILIES) as Family[]) {
      const work = FAMILIES[f].levels.map((_, i) => workMinutes(f, i + 1, 280) - (FAMILIES[f].levels[i].rec * (FAMILIES[f].levels[i].reps - 1)));
      for (let i = 1; i < work.length; i++) expect(work[i], `${f} livello ${i + 1}`).toBeGreaterThanOrEqual(work[i - 1] - 0.5);
    }
  });

  it("recuperi proporzionati: VO₂max circa metà della frazione, soglia breve", () => {
    for (const r of FAMILIES.vo2.levels) {
      const rep = r.min ?? (r.km! * 280 * 0.94) / 60;
      expect(r.rec / rep).toBeLessThanOrEqual(0.65);
      expect(r.rec / rep).toBeGreaterThanOrEqual(0.3);
    }
    for (const r of FAMILIES.soglia.levels.filter((x) => x.rec)) {
      const rep = r.min ?? (r.km! * 280) / 60;
      expect(r.rec / rep).toBeLessThanOrEqual(0.3);
    }
    // L'esempio dell'atleta: 3' di ripetuta non hanno mai 2' di recupero.
    expect(FAMILIES.vo2.levels.find((r) => r.min === 3)!.rec).toBeLessThan(2);
  });

  it("seduta costruita: titolo, struttura, recupero e passi per fase", () => {
    const s = buildSession("vo2", 4, 280);
    expect(s.title).toBe("Ripetute VO₂max 5 × 1 km");
    expect(s.structure.recoveries).toBe("2' di corsa lenta tra le frazioni");
    expect(s.structure.session).toEqual({ family: "vo2", level: 4, maxLevel: 7 });
    const w = withRunPaces({ ...s, id: "x", date: TODAY, sport: "run", status: "programmato", safetyNotes: [] } as PlannedWorkout, { thresholdSec: 280, source: "test" });
    expect(w.structure.main[0].target?.value).toBe("4:20 – 4:30 /km (≈ 4:20–4:30 ogni 1 km)");
    expect(w.structure.warmup[1].target).toBeUndefined(); // allunghi a sensazione
    expect(w.structure.recoveryTarget?.value).toBe("6:20 – 7:15 /km · circa 300 m ogni recupero");
    const hills = withRunPaces({ ...buildSession("salite", 2), id: "y", date: TODAY, sport: "run", status: "programmato", safetyNotes: [] } as PlannedWorkout, { thresholdSec: 280, source: "test" });
    expect(hills.structure.main[0].target).toBeUndefined();
    expect(hills.structure.recoveryTarget).toBeUndefined();
  });

  it("il livello scende se la seduta non sta nella durata massima", () => {
    expect(fitLevel("ritmo_mezza", 7, 75, 280)).toBeLessThan(7);
    expect(fitLevel("vo2", 3, 120, 280)).toBe(3);
  });
});

describe("scelta della seduta come un allenatore", () => {
  const reggio = { id: "r", name: "Reggio", date: "2026-12-13", kind: "singolo" as const, sport: "run" as const, distanceKm: 21.1, priority: "A" as const };
  it("mezza: soglia come seduta principale, ritmo gara nelle ultime 6 settimane", () => {
    expect(qualityFamily("run", "costruzione", reggio, 0, 0, 8)).toBe("soglia");
    expect(qualityFamily("run", "costruzione", reggio, 0, 1, 5)).toBe("ritmo_mezza");
    expect(qualityFamily("run", "base", reggio, 0, 0)).toBe("fartlek");
    expect(qualityFamily("run", "base", reggio, 1, 0)).toBe("salite");
    expect(qualityFamily("run", "rifinitura", reggio, 0, 0)).toBe("ritmo_mezza");
  });
  it("10 km: VO₂max e ritmo 10 km", () => {
    const tenK = { ...reggio, distanceKm: 10 };
    expect(qualityFamily("run", "costruzione", tenK, 0, 0, 8)).toBe("vo2");
    expect(qualityFamily("run", "costruzione", tenK, 0, 1, 4)).toBe("ritmo_10k");
  });
});

describe("progressione dalla storia", () => {
  const past = (date: string, level: number, status: PlannedWorkout["status"], actId?: string) =>
    ({ ...buildSession("soglia", level), id: date, date, sport: "run", status, completedActivityId: actId, safetyNotes: [] }) as PlannedWorkout;
  const act = (id: string, rpe: number) => ({ id, date: "2026-10-28", sport: "run", title: "", durationMin: 60, source: "strava", feedback: { rpe, muscleFatigue: 3, cardioFatigue: 3, feeling: "buono" } }) as CompletedActivity;

  it("chiusa come previsto: si sale; molto dura: si scende; saltata: si ripete", () => {
    expect(trainingState({ plan: [past("2026-10-28", 3, "completato", "a")], activities: [act("a", 7)] }, athlete, TODAY).levels.soglia).toMatchObject({ level: 4 });
    expect(trainingState({ plan: [past("2026-10-28", 3, "completato", "a")], activities: [act("a", 8)] }, athlete, TODAY).levels.soglia).toMatchObject({ level: 3 });
    expect(trainingState({ plan: [past("2026-10-28", 3, "completato", "a")], activities: [act("a", 9)] }, athlete, TODAY).levels.soglia?.level).toBe(2);
    expect(trainingState({ plan: [past("2026-10-28", 3, "saltato")], activities: [] }, athlete, TODAY).levels.soglia?.level).toBe(3);
    expect(trainingState(undefined, athlete, TODAY).levels.soglia).toMatchObject({ level: 2 });
  });

  it("volume e lungo dai dati reali", () => {
    const acts = Array.from({ length: 12 }, (_, i) => ({ id: `x${i}`, date: `2026-10-${String(6 + i * 2).padStart(2, "0")}`, sport: "run", title: "", durationMin: i === 5 ? 95 : 50, source: "strava" }) as CompletedActivity);
    const st = trainingState({ plan: [], activities: acts }, athlete, TODAY);
    expect(st.longestMin.run).toBe(95);
    expect(st.weeklyMin).toBeGreaterThan(100);
  });
});

describe("allenamenti costruiti sull'obiettivo", () => {
  it("obiettivo ambizioso: lavoro a ritmo gara 8 settimane prima invece di 6", () => {
    const reggio = { id: "r", name: "Reggio", date: "2026-12-13", kind: "singolo" as const, sport: "run" as const, distanceKm: 21.1, priority: "A" as const };
    expect(qualityFamily("run", "costruzione", reggio, 0, 1, 7, 0)).not.toBe("ritmo_mezza");
    expect(qualityFamily("run", "costruzione", reggio, 0, 1, 7, 0.03)).toBe("ritmo_mezza");
  });
});
