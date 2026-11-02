import { describe, expect, it } from "vitest";
import { eventFromForm } from "./event-schema";
import { profileFromForm } from "./profile-schema";

function form(values: Record<string, string | string[]>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) (Array.isArray(v) ? v : [v]).forEach((x) => fd.append(k, x));
  return fd;
}

const base = {
  displayName: "Davide",
  birthDate: "1997-03-10",
  heightCm: "180",
  weightKg: "75,5",
  availableDays: ["Mar", "Gio", "Dom"],
  equipment: "Orologio GPS, Bici da corsa\nRulli",
  "run.enabled": "on",
  "run.level": "intermedio",
  "run.yearsExperience": "3",
};

describe("validazione profilo", () => {
  it("accetta un profilo valido e normalizza i valori", () => {
    const r = profileFromForm(form(base));
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.weightKg).toBe(75.5);
    expect(r.data.equipment).toEqual(["Orologio GPS", "Bici da corsa", "Rulli"]);
    expect(r.data.bike.enabled).toBe(false);
    expect(r.data.sex).toBeUndefined();
  });

  it("rifiuta un peso impossibile", () => {
    const r = profileFromForm(form({ ...base, weightKg: "5" }));
    expect(r.success).toBe(false);
  });

  it("richiede almeno uno sport", () => {
    const { ["run.enabled"]: _, ...noSport } = base;
    void _;
    expect(profileFromForm(form(noSport)).success).toBe(false);
  });

  it("rifiuta giorni inventati e nomi vuoti", () => {
    expect(profileFromForm(form({ ...base, availableDays: ["Xyz"] })).success).toBe(false);
    expect(profileFromForm(form({ ...base, displayName: "  " })).success).toBe(false);
  });

  it("rifiuta date di nascita nel futuro", () => {
    expect(profileFromForm(form({ ...base, birthDate: "2999-01-01" })).success).toBe(false);
  });
});

describe("gare", () => {
  it("un triathlon con formato standard prende le distanze in automatico", () => {
    const r = eventFromForm(form({ name: "Ledroman", date: "2027-07-01", kind: "triathlon", triFormat: "medio", priority: "A" }));
    expect(r.success).toBe(true);
    if (r.success) expect([r.data.swimKm, r.data.bikeKm, r.data.runKm]).toEqual([1.9, 90, 21.1]);
  });
  it("un triathlon personalizzato richiede le tre distanze", () => {
    expect(eventFromForm(form({ name: "x", date: "2027-07-01", kind: "triathlon", triFormat: "personalizzato", swimKm: "1", priority: "A" })).success).toBe(false);
  });
  it("una gara singola richiede lo sport", () => {
    expect(eventFromForm(form({ name: "Mezza", date: "2026-11-08", kind: "singolo", priority: "A" })).success).toBe(false);
    expect(eventFromForm(form({ name: "Mezza", date: "2026-11-08", kind: "singolo", sport: "run", distanceKm: "21,1", priority: "A" })).success).toBe(true);
  });
});

describe("nuoto nel profilo", () => {
  it("salva vasca e stili, rifiuta vasche inventate", () => {
    const ok = profileFromForm(form({ ...base, "swim.enabled": "on", "swim.level": "principiante", "swim.poolLengthM": "25", "swim.strokes": ["Stile libero", "Rana"] }));
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.swimDetails.poolLengthM).toBe(25);
    expect(profileFromForm(form({ ...base, "swim.poolLengthM": "33" })).success).toBe(false);
  });
});

describe("giorni per i lunghi e per sport", () => {
  it("accetta giorni preferiti tra quelli disponibili", () => {
    const r = profileFromForm(form({ ...base, "swim.enabled": "on", "swim.days": ["Mar", "Gio"], longDays: ["Dom"] }));
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.sportDays.swim).toEqual(["Mar", "Gio"]);
  });
  it("rifiuta giorni preferiti o dei lunghi fuori dai disponibili", () => {
    expect(profileFromForm(form({ ...base, "swim.enabled": "on", "swim.days": ["Lun"] })).success).toBe(false);
    expect(profileFromForm(form({ ...base, longDays: ["Sab"] })).success).toBe(false);
  });
});
