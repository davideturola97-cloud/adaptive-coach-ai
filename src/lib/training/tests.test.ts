import { describe, expect, it } from "vitest";
import type { RaceEvent } from "@/lib/domain/types";
import { cssFrom400200, cssFromRecentSwim, parseTime, thresholdPaceFromCooper } from "./formulas";
import { declineDate, evaluateReadiness, evaluateTest, pickTestDay, postponeDate, proposeInitialTests, retestDue } from "./tests";

describe("formule del nuoto", () => {
  it("CSS da 400 e 200 m", () => {
    // 400 m in 6:40, 200 m in 3:10 -> (400-190)/2 = 105 s = 1:45 /100 m
    expect(cssFrom400200(400, 190)).toBe(105);
  });
  it("rifiuta tempi incoerenti", () => {
    expect(() => cssFrom400200(300, 200)).toThrow();
  });
  it("CSS da un 1500 m coincide con il suo ritmo", () => {
    expect(cssFromRecentSwim(1500, 1500 * 1.1)).toBeCloseTo(110, 0);
  });
});

describe("tempi scritti a mano", () => {
  it("accetta mm:ss e h:mm:ss", () => {
    expect(parseTime("24:30")).toBe(1470);
    expect(parseTime("1:42:06")).toBe(6126);
    expect(parseTime("6.40")).toBe(400);
  });
  it("rifiuta testo non valido", () => {
    expect(parseTime("abc")).toBeNull();
    expect(parseTime("24:75")).toBeNull();
    expect(parseTime("42")).toBeNull();
  });
});

describe("proposta dei test iniziali", () => {
  it("principianti: test brevi; esperti: test classici; palestra: nessun test", () => {
    const p = proposeInitialTests([
      { sport: "run", level: "principiante", yearsExperience: 0 },
      { sport: "bike", level: "avanzato", yearsExperience: 5 },
      { sport: "swim", level: "intermedio", yearsExperience: 2 },
      { sport: "gym", level: "intermedio", yearsExperience: 2 },
    ]);
    expect(p.map((x) => x.kind)).toEqual(["cooper", "ftp20", "css"]);
  });
  it("niente CSS a chi non nuota 400 m di fila", () => {
    expect(proposeInitialTests([{ sport: "swim", level: "principiante", yearsExperience: 0 }], { canSwim400: false })).toEqual([]);
  });
});

describe("valutazione dei risultati", () => {
  it("5 km -> ritmo di soglia stimato", () => {
    const r = evaluateTest({ kind: "5km", timeSec: 1470 });
    expect(r.update.thresholdPaceSec).toBeGreaterThan(300);
    expect(r.derived.every((d) => d.origin === "stimato")).toBe(true);
  });
  it("FTP dichiarata resta 'dichiarata'", () => {
    const r = evaluateTest({ kind: "ftp_nota", ftpW: 250 });
    expect(r.update.ftpW).toBe(250);
    expect(r.derived[0].origin).toBe("dichiarato");
  });
  it("rifiuta valori impossibili", () => {
    expect(() => evaluateTest({ kind: "5km", timeSec: 300 })).toThrow();
    expect(() => evaluateTest({ kind: "ftp20", avgPowerW: 2000 })).toThrow();
  });
  it("Cooper dà un ritmo di soglia plausibile", () => {
    const p = thresholdPaceFromCooper(2800);
    expect(p).toBeGreaterThan(250);
    expect(p).toBeLessThan(330);
  });
});

describe("rinvii e scelta del giorno", () => {
  const today = "2026-11-02"; // lunedì
  it("rimanda di 1 o 2 settimane, rifiuta per 4", () => {
    expect(postponeDate(today, 1)).toBe("2026-11-09");
    expect(postponeDate(today, 2)).toBe("2026-11-16");
    expect(declineDate(today)).toBe("2026-11-30");
  });
  it("sceglie un giorno disponibile ad almeno 2 giorni da oggi", () => {
    expect(pickTestDay(today, ["Sab"], [])).toBe("2026-11-07");
  });
  it("evita la settimana prima di una gara importante e i giorni subito dopo", () => {
    const race: RaceEvent = { id: "r", name: "Ravenna", date: "2026-11-08", kind: "singolo", sport: "run", priority: "A" };
    expect(pickTestDay(today, ["Sab"], [race])).toBe("2026-11-14");
  });
  it("le gare C non spostano i test", () => {
    const race: RaceEvent = { id: "r", name: "Gara C", date: "2026-11-08", kind: "singolo", sport: "run", priority: "C" };
    expect(pickTestDay(today, ["Sab"], [race])).toBe("2026-11-07");
  });
  it("suggerisce un nuovo test dopo 8 settimane", () => {
    expect(retestDue("2026-08-01", today)).toBe(true);
    expect(retestDue("2026-10-01", today)).toBe(false);
  });
});

describe("controllo di sicurezza", () => {
  it("segnala qualsiasi risposta positiva", () => {
    expect(evaluateReadiness({ cuore: false, malattia: true }).flagged).toBe(true);
    expect(evaluateReadiness({}).flagged).toBe(false);
  });
});
