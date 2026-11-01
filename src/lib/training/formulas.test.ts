import { describe, expect, it } from "vitest";
import {
  acuteChronicRatio,
  cooperVo2max,
  formatDuration,
  formatPace,
  formatTime,
  ftpFrom20Min,
  ftpFromRamp,
  powerZones,
  riegel,
  sessionLoad,
  thresholdPaceFrom5k,
} from "./formulas";

describe("riegel", () => {
  it("stima la mezza da un 10 km", () => {
    // 45:00 sui 10 km -> circa 1:39:3x sulla mezza
    const t = riegel(45 * 60, 10, 21.0975);
    expect(t).toBeGreaterThan(5950);
    expect(t).toBeLessThan(6000);
  });
  it("rifiuta valori non validi", () => {
    expect(() => riegel(0, 5, 10)).toThrow();
  });
});

describe("cooper", () => {
  it("2800 m in 12 minuti -> circa 51 ml/kg/min", () => {
    expect(cooperVo2max(2800)).toBeCloseTo(51.3, 1);
  });
  it("rifiuta distanze implausibili", () => {
    expect(() => cooperVo2max(10000)).toThrow();
  });
});

describe("ftp", () => {
  it("test 20 minuti: 95%", () => expect(ftpFrom20Min(260)).toBe(247));
  it("ramp test: 75% del miglior minuto", () => expect(ftpFromRamp(320)).toBe(240));
  it("zone di Coggan", () => {
    const z = powerZones(250);
    expect(z).toHaveLength(6);
    expect(z[1]).toMatchObject({ name: "Endurance", minW: 140, maxW: 188 });
    expect(z[5].maxW).toBeNull();
  });
});

describe("carico", () => {
  it("session-RPE", () => expect(sessionLoad(60, 6)).toBe(360));
  it("rapporto acuto/cronico stabile = 1", () => {
    expect(acuteChronicRatio(Array(28).fill(50))).toBeCloseTo(1);
  });
  it("servono 28 giorni", () => expect(acuteChronicRatio(Array(10).fill(50))).toBeNull());
});

describe("ritmi e formati", () => {
  it("soglia da 5 km in 25:00 è più lenta del ritmo 5 km", () => {
    const p = thresholdPaceFrom5k(25 * 60);
    expect(p).toBeGreaterThan(300);
    expect(p).toBeLessThan(330);
  });
  it("formatta", () => {
    expect(formatDuration(95)).toBe("1h 35'");
    expect(formatDuration(45)).toBe("45'");
    expect(formatPace(305)).toBe("5:05 /km");
    expect(formatTime(6126)).toBe("1:42:06");
  });
});
