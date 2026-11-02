import { describe, expect, it } from "vitest";
import type { Split } from "@/lib/domain/types";
import { analyzeSplits, parsePace } from "./splits";

const km = (paces: number[], hr?: number[]): Split[] => paces.map((p, i) => ({ n: i + 1, km: 1, paceSec: p, hr: hr?.[i] }));

describe("lettura del passo", () => {
  it("accetta i formati comuni", () => {
    expect(parsePace("5:12")).toBe(312);
    expect(parsePace(`5'12"`)).toBe(312);
    expect(parsePace("5:12 /km")).toBe(312);
    expect(parsePace("0:05:12")).toBe(312);
    expect(parsePace("abc")).toBeNull();
    expect(parsePace("5:75")).toBeNull();
  });
});

describe("valutazione dei parziali", () => {
  it("riconosce la progressione", () => {
    const a = analyzeSplits(km([330, 328, 325, 315, 310, 305]), "run");
    expect(a.trend).toBe("progressione");
    expect(a.fastest?.n).toBe(6);
  });
  it("riconosce il calo e il crollo finale", () => {
    const a = analyzeSplits(km([300, 302, 305, 315, 330, 345]), "run");
    expect(a.trend).toBe("calo");
    expect(a.findings.join(" ")).toMatch(/ultimi 2 km/);
  });
  it("corsa facile troppo veloce rispetto alla soglia stimata", () => {
    const a = analyzeSplits(km([300, 298, 302, 299]), "run", { type: "corsa_facile" }, { thresholdPaceSecPerKm: { value: 290, origin: "stimato", date: "2026-10-01" } });
    expect(a.findings.join(" ")).toMatch(/più veloci del previsto/);
  });
  it("ripetute: frazioni veloci uniformi", () => {
    const a = analyzeSplits(km([380, 270, 400, 272, 395, 271, 390]), "run", { type: "ripetute" });
    expect(a.findings.join(" ")).toMatch(/uniformi/);
  });
  it("deriva cardiaca a ritmo costante", () => {
    const a = analyzeSplits(km([320, 321, 319, 320, 322, 320], [140, 142, 145, 150, 152, 154]), "run");
    expect(a.findings.join(" ")).toMatch(/deriva cardiaca/);
  });
  it("il parziale corto finale non falsa i confronti", () => {
    const s = [...km([320, 320, 320]), { n: 4, km: 0.3, paceSec: 250 }];
    const a = analyzeSplits(s, "run");
    expect(a.fastest?.n).not.toBe(4);
    expect(a.findings.join(" ")).toMatch(/più corto/);
  });
  it("con meno di 3 parziali niente conclusioni", () => {
    expect(analyzeSplits(km([300, 310]), "run").trend).toBeNull();
  });
});
