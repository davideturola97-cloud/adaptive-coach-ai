import { describe, expect, it } from "vitest";
import { activityFromForm, parseDurationMin } from "@/lib/domain/activity-schema";
import type { CompletedActivity, Feedback, PlannedWorkout } from "@/lib/domain/types";
import { template } from "./templates";
import { dedupeKey, feedbackSignals, findSimilar, matchPlanned } from "./feedback";

const fb = (over: Partial<Feedback> = {}): Feedback => ({ rpe: 5, muscleFatigue: 2, cardioFatigue: 2, feeling: "buono", ...over });
const act = (id: string, date: string, over: Partial<CompletedActivity> = {}): CompletedActivity => ({ id, date, sport: "run", title: "Corsa", durationMin: 45, source: "manuale", ...over });
const planned = (id: string, date: string, activityId?: string): PlannedWorkout => ({
  ...template("corsa_facile"), id, date, status: activityId ? "completato" : "programmato", completedActivityId: activityId,
});

describe("duplicati", () => {
  it("stessa impronta per durate quasi uguali", () => {
    expect(dedupeKey("run", "2026-11-03", 44)).toBe(dedupeKey("run", "2026-11-03", 46));
  });
  it("riconosce un'attività simile, non una diversa", () => {
    const list = [act("a", "2026-11-03", { durationMin: 50 })];
    expect(findSimilar(list, "run", "2026-11-03", 53)).toHaveLength(1);
    expect(findSimilar(list, "run", "2026-11-03", 80)).toHaveLength(0);
    expect(findSimilar(list, "bike", "2026-11-03", 50)).toHaveLength(0);
  });
  it("collega la seduta del programma dello stesso giorno e sport", () => {
    expect(matchPlanned([planned("p", "2026-11-03")], "run", "2026-11-03")?.id).toBe("p");
    expect(matchPlanned([planned("p", "2026-11-03")], "swim", "2026-11-03")).toBeUndefined();
  });
});

describe("segnali dai feedback", () => {
  const today = "2026-11-20";
  it("un solo dolore non basta, due in due settimane sì", () => {
    expect(feedbackSignals([act("a", "2026-11-18", { feedback: fb({ pain: "ginocchio" }) })], [], today).map((s) => s.id)).not.toContain("dolore");
    const two = [act("a", "2026-11-10", { feedback: fb({ pain: "ginocchio" }) }), act("b", "2026-11-18", { feedback: fb({ pain: "ginocchio" }) })];
    expect(feedbackSignals(two, [], today).map((s) => s.id)).toContain("dolore");
  });
  it("fatica: almeno 3 sedute su 5 molto sopra l'RPE previsto", () => {
    const acts = ["12", "14", "16", "18"].map((d, i) => act(`a${i}`, `2026-11-${d}`, { feedback: fb({ rpe: i < 3 ? 7 : 4 }) }));
    const plan = acts.map((a, i) => planned(`p${i}`, a.date, a.id)); // corsa facile: RPE previsto 4
    expect(feedbackSignals(acts, plan, today).map((s) => s.id)).toContain("fatica");
    expect(feedbackSignals(acts.slice(0, 2), plan, today).map((s) => s.id)).not.toContain("fatica");
  });
  it("sedute passate non registrate", () => {
    expect(feedbackSignals([], [planned("p", "2026-11-18")], today).map((s) => s.id)).toEqual(["registrare"]);
  });
  it("nessun testo parla di malattie o diagnosi", () => {
    const acts = ["10", "12", "14", "16", "18"].map((d, i) => act(`a${i}`, `2026-11-${d}`, { feedback: fb({ rpe: 9, pain: "x", sleepQuality: 1 }) }));
    const text = JSON.stringify(feedbackSignals(acts, acts.map((a, i) => planned(`p${i}`, a.date, a.id)), today));
    expect(text).not.toMatch(/sovrallenamento|patologi|malatti|diagnos/i);
  });
});

describe("modulo attività", () => {
  const form = (v: Record<string, string>) => { const fd = new FormData(); Object.entries(v).forEach(([k, x]) => fd.append(k, x)); return fd; };
  const ok = { date: "2026-11-01", sport: "run", duration: "45", rpe: "6", muscleFatigue: "3", cardioFatigue: "3", feeling: "buono" };
  it("durate in minuti o come tempo", () => {
    expect(parseDurationMin("45")).toBe(45);
    expect(parseDurationMin("1:05:30")).toBe(65.5);
    expect(parseDurationMin("abc")).toBeNull();
  });
  it("accetta un'attività valida", () => {
    const r = activityFromForm(form({ ...ok, distanceKm: "8,4" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.activity.distanceKm).toBe(8.4);
  });
  it("richiede RPE e sensazioni, rifiuta valori impossibili", () => {
    expect(activityFromForm(form({ ...ok, rpe: "" })).ok).toBe(false);
    expect(activityFromForm(form({ ...ok, avgHr: "300" })).ok).toBe(false);
    expect(activityFromForm(form({ ...ok, date: "2999-01-01" })).ok).toBe(false);
  });
});
