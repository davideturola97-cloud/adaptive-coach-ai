import { describe, expect, it } from "vitest";
import { analyzeActivity, type ActivityData } from "./analysis";
import { template } from "./templates";

const bike: ActivityData = { date: "2026-11-01", sport: "bike", durationMin: 125, distanceKm: 60, avgHr: 138, avgPowerW: 180, elevationM: 750 };

describe("analisi della seduta", () => {
  it("bici: velocità, percorso, zona di potenza, uscita lunga", () => {
    const r = analyzeActivity(bike, { athlete: { ftpW: { value: 240, origin: "stimato", date: "2026-10-01" }, weightKg: 75 } });
    expect(r.headline).toMatch(/Uscita in bici di 2h 05', 60,0 km, percorso collinare/);
    const all = r.findings.join(" ");
    expect(all).toMatch(/28,8 km\/h/);
    expect(all).toMatch(/75% della tua FTP/);
    expect(all).toMatch(/zona 2 Endurance/);
    expect(all).toMatch(/2,40 W\/kg/);
    expect(all).toMatch(/mangiare e bere/);
  });
  it("bici senza potenza né test: niente valori inventati", () => {
    const r = analyzeActivity({ ...bike, avgPowerW: undefined });
    expect(r.findings.join(" ")).toMatch(/Senza misuratore di potenza/);
    expect(r.findings.join(" ")).not.toMatch(/FTP \(/);
  });
  it("endurance troppo forte rispetto alla FTP", () => {
    const planned = { ...template("endurance", 1), type: "endurance" as const };
    const r = analyzeActivity({ ...bike, avgPowerW: 210 }, { planned, athlete: { ftpW: { value: 240, origin: "stimato", date: "x" } } });
    expect(r.findings.join(" ")).toMatch(/la media è alta/);
  });
  it("confronto con le uscite precedenti", () => {
    const history: ActivityData[] = [1, 2, 3].map((d) => ({ date: `2026-10-2${d}`, sport: "bike", durationMin: 120, distanceKm: 54, avgHr: 130 }));
    const all = analyzeActivity(bike, { history }).findings.join(" ");
    expect(all).toMatch(/Più veloce di 1,8 km\/h rispetto alla media delle ultime 3 uscite/);
    expect(all).toMatch(/8 battiti sopra/);
  });
  it("corsa: zona rispetto alla soglia e seduta facile troppo veloce", () => {
    const planned = { ...template("corsa_facile", 1), type: "corsa_facile" as const };
    const r = analyzeActivity({ date: "2026-11-01", sport: "run", durationMin: 50, distanceKm: 10 }, { planned, athlete: { thresholdPaceSecPerKm: { value: 280, origin: "stimato", date: "x" } } });
    expect(r.findings.join(" ")).toMatch(/Passo medio 5:00 \/km: ritmo medio/);
    expect(r.findings.join(" ")).toMatch(/un po' veloce/);
  });
  it("nuoto: confronto con il CSS", () => {
    const r = analyzeActivity({ date: "2026-11-01", sport: "swim", durationMin: 40, distanceKm: 2 }, { athlete: { cssPaceSecPer100m: { value: 110, origin: "stimato", date: "x" } } });
    expect(r.findings.join(" ")).toMatch(/Passo medio 2:00 \/100 m, 10 secondi più lento del tuo CSS/);
  });
  it("palestra e confronto con la seduta prevista e l'RPE", () => {
    const planned = { ...template("forza_generale", 1), type: "forza_generale" as const };
    const r = analyzeActivity({ date: "2026-11-01", sport: "gym", durationMin: planned.durationMin * 0.5, feedback: { rpe: 10, muscleFatigue: 4, cardioFatigue: 3, feeling: "stanco" } }, { planned });
    const all = r.findings.join(" ");
    expect(all).toMatch(/Più corta del previsto/);
    expect(all).toMatch(/sopra il previsto/);
    expect(all).toMatch(/Carico della seduta/);
  });
});
