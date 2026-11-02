import { describe, expect, it } from "vitest";
import type { Split } from "@/lib/domain/types";
import { analyzeSplits, parsePace, parseSplitTime, totalsFromSplits } from "./splits";

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

describe("totali dagli intertempi", () => {
  it("somma km e tempi, FC pesata sul tempo", () => {
    const t = totalsFromSplits([{ n: 1, km: 1, paceSec: 300, hr: 140 }, { n: 2, km: 1, paceSec: 330, hr: 160 }, { n: 3, km: 0.21, paceSec: 300 }])!;
    expect(t.distanceKm).toBe(2.21);
    expect(t.durationMin).toBe(11.55); // 300 + 330 + 63 s
    expect(t.avgPaceSec).toBe(314);
    expect(t.avgHr).toBe(150); // (140·300 + 160·330) / 630 = 150,5 -> 150
    expect(t.hrPartial).toBe(true);
  });
  it("un passo mancante: niente durata", () => {
    const t = totalsFromSplits([{ n: 1, km: 1, paceSec: 300 }, { n: 2, km: 1 }])!;
    expect(t.durationMin).toBeUndefined();
    expect(t.distanceKm).toBe(2);
  });
  it("nessun parziale: null", () => expect(totalsFromSplits([])).toBeNull());
});

describe("nuoto in vasca", () => {
  it("legge i tempi dei parziali", () => {
    expect(parseSplitTime("53s")).toBe(53);
    expect(parseSplitTime("3:03")).toBe(183);
    expect(parseSplitTime("1:05:30")).toBe(3930);
    expect(parseSplitTime("3:75")).toBeNull();
  });
  it("separa le vasche con pausa e quelle anomale", () => {
    const secs = [183, 53, 67, 121, 94, 105, 95, 144, 97, 65, 182, 143, 61, 135, 92, 15, 91, 25];
    const lens = [25, 25, 25, 25, 50, 25, 50, 25, 50, 25, 50, 25, 25, 25, 50, 25, 50, 25];
    const splits = secs.map((t, i) => ({ n: i, km: lens[i] / 1000, paceSec: Math.round(t / (lens[i] / 1000)) }));
    const a = analyzeSplits(splits, "swim");
    const all = a.findings.join(" ");
    expect(all).toMatch(/vasche includono una pausa/);
    expect(all).toMatch(/troppo veloci rispetto alle altre \(15ª, 17ª\)/);
    expect(all).toMatch(/Passo medio sui parziali completi: 3:\d\d \/100 m/);
  });
});
