import { describe, expect, it } from "vitest";
import type { CompletedActivity, Split } from "@/lib/domain/types";
import { decoupling, efficiency, heartAnalysis, hrAtPace, referencePace } from "./hr-pace";

const splits = (paces: number[], hrs: number[]): Split[] => paces.map((p, i) => ({ n: i + 1, km: 1, paceSec: p, hr: hrs[i] }));
const run = (id: string, date: string, km: number, min: number, hr: number, sp?: Split[]): CompletedActivity => ({ id, date, sport: "run", title: "", durationMin: min, distanceKm: km, avgHr: hr, source: "strava", splits: sp });

describe("cuore e passo", () => {
  it("efficienza: metri per battito", () => {
    expect(efficiency(run("a", "2026-11-01", 10, 50, 150))!).toBeCloseTo(200 / 150);
    expect(efficiency({ sport: "bike", durationMin: 60, distanceKm: 30, avgHr: 140, avgPowerW: 196 })).toBeCloseTo(1.4);
  });

  it("deriva cardiaca: cuore che sale a passo costante", () => {
    expect(decoupling(splits([300, 300, 300, 300, 300, 300], [140, 141, 142, 141, 142, 141]), "run")!).toBeLessThan(2);
    expect(decoupling(splits([300, 300, 300, 300, 300, 300, 300, 300], [140, 142, 144, 146, 152, 156, 158, 160]), "run")!).toBeGreaterThan(8);
    expect(decoupling(splits([300, 300, 300], [140, 150, 160]), "run")).toBeUndefined();
  });

  it("confronto con le uscite simili: efficienza, battito a passo simile, posizione", () => {
    const hist = [
      run("p1", "2026-10-10", 10, 51, 156),
      run("p2", "2026-10-17", 10.2, 51.5, 155),
      run("p3", "2026-10-24", 9.8, 49.5, 154),
    ];
    const cur = run("c", "2026-11-01", 10, 50, 148, splits(Array(10).fill(300), Array(10).fill(148)));
    const h = heartAnalysis(cur, [...hist, cur])!;
    const all = h.findings.join(" ");
    expect(all).toMatch(/meglio della media delle ultime 3 uscite simili/);
    expect(all).toMatch(/A passo simile \(5:00 \/km\) il cuore è stato 7 battiti più basso/);
    expect(all).toMatch(/Il passo più veloce tra le ultime 4 uscite/);
    expect(all).toMatch(/Deriva cardiaca 0,0%/);
    expect(h.similar[0]).toMatchObject({ id: "c", current: true });
  });

  it("FC a passo fisso: un mese dopo, stesso passo con meno battiti", () => {
    const mk = (date: string, base: number) => run(date, date, 8, 44, base, splits([310, 320, 330, 340, 325, 315, 335, 330], [base + 6, base + 3, base, base - 3, base + 1, base + 4, base - 1, base]));
    const acts = [...["2026-09-05", "2026-09-10", "2026-09-15"].map((d) => mk(d, 150)), ...["2026-10-15", "2026-10-22", "2026-10-29"].map((d) => mk(d, 144))];
    const r = hrAtPace(acts, "2026-11-03", 330)!;
    expect(Math.round(r.delta!)).toBe(-6);
    expect(r.text).toMatch(/A 5:30 \/km il cuore batte circa 144 bpm, 6 in meno di un mese fa/);
    expect(referencePace([], "2026-11-03", 270)).toBe(340);
  });
});
