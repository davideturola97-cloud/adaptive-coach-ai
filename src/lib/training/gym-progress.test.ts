import { describe, expect, it } from "vitest";
import type { CompletedActivity, GymLogEntry, RaceEvent } from "@/lib/domain/types";
import { suggestLoad } from "./gym-progress";

const TODAY = "2026-11-20";
const act = (date: string, log: GymLogEntry[]): CompletedActivity => ({ id: date, date, sport: "gym", title: "", durationMin: 60, source: "manuale", gymLog: log });

describe("progressione dei carichi", () => {
  it("intervallo 8-10: si sale dopo due sedute di fila al massimo delle ripetizioni", () => {
    const panca = { name: "Panca piana", sets: 4, reps: "8-10", loadKg: 60 };
    const one = [act("2026-11-16", [{ name: "Panca piana", sets: 4, reps: "10", loadKg: 60, done: true }])];
    expect(suggestLoad(panca, one, [], TODAY)).toMatchObject({ action: "mantieni", loadKg: 60 });
    const two = [...one, act("2026-11-09", [{ name: "panca piana", sets: 4, reps: "10", loadKg: 60, done: true }])];
    expect(suggestLoad(panca, two, [], TODAY)).toMatchObject({ action: "aumenta", loadKg: 62.5 });
  });

  it("grandi esercizi di gambe: +5 kg; ripetizioni fisse: basta una seduta riuscita", () => {
    const squat = { name: "Squat", sets: 4, reps: "8", loadKg: 70 };
    expect(suggestLoad(squat, [act("2026-11-13", [{ name: "Squat", sets: 4, reps: "8", loadKg: 70, done: true }])], [], TODAY)).toMatchObject({ action: "aumenta", loadKg: 75 });
  });

  it("due sedute non riuscite: −5%; gara vicina: gambe invariate", () => {
    const squat = { name: "Squat", sets: 4, reps: "8", loadKg: 70 };
    const fail = [act("2026-11-13", [{ name: "Squat", sets: 4, reps: "8", loadKg: 80, done: false }]), act("2026-11-06", [{ name: "Squat", sets: 4, reps: "8", loadKg: 80, done: false }])];
    expect(suggestLoad(squat, fail, [], TODAY)).toMatchObject({ action: "riduci", loadKg: 75 });
    const race: RaceEvent = { id: "r", name: "Reggio", date: "2026-12-06", kind: "singolo", sport: "run", distanceKm: 21.1, priority: "A" };
    const ok = [act("2026-11-13", [{ name: "Squat", sets: 4, reps: "8", loadKg: 70, done: true }])];
    expect(suggestLoad(squat, ok, [race], TODAY)).toMatchObject({ action: "mantieni", loadKg: 70 });
  });

  it("mai registrato: il carico della scheda", () => {
    expect(suggestLoad({ name: "Trazioni", sets: 3, reps: "6" }, [], [], TODAY)).toMatchObject({ action: "nuovo" });
  });
});
