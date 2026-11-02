import { describe, expect, it } from "vitest";
import { addDays, weekdayName } from "@/lib/dates";
import type { AthleteProfile, PlannedWorkout, RaceEvent, Sport } from "@/lib/domain/types";
import { generatePlan, isHard } from "./engine";
import { type Disruption, type DisruptionKind, proposeReschedule, violations } from "./reschedule";

const athlete: AthleteProfile = {
  name: "T",
  sports: [
    { sport: "run", level: "intermedio", yearsExperience: 4 },
    { sport: "bike", level: "intermedio", yearsExperience: 2 },
    { sport: "swim", level: "principiante", yearsExperience: 1 },
    { sport: "gym", level: "intermedio", yearsExperience: 3 },
  ],
  weeklyHoursAvailable: 8, availableDays: ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"], maxSessionMin: 75,
  longDays: ["Sab", "Dom"], longSessionMaxMin: 150, sportDays: {}, equipment: [], limitations: [], goals: { primary: "", secondary: [] },
};
const events: RaceEvent[] = [
  { id: "r", name: "Reggio", date: "2026-12-13", kind: "singolo", sport: "run", priority: "A" },
  { id: "l", name: "Ledro", date: "2027-07-04", kind: "triathlon", triFormat: "medio", legs: { swimKm: 1.9, bikeKm: 90, runKm: 21.1 }, priority: "A" },
];
const today = "2026-11-16";
const draft = generatePlan({ today, startDate: today, athlete, events, weeks: 4 });
const plan: PlannedWorkout[] = draft.workouts.map((w, i) => ({ ...w, id: `w${i}`, status: "programmato" }));
const run = (d: Disruption, p = plan) => proposeReschedule({ today, athlete, plan: p, events, disruption: d });
const day = (name: string) => [0, 1, 2, 3, 4, 5, 6].map((i) => addDays("2026-11-16", i)).find((d) => weekdayName(d, true) === name)!;

describe("non posso allenarmi", () => {
  const tue = day("Mar");
  const r = run({ kind: "nessun_allenamento", from: tue });
  it("propone di spostare le sedute importanti e, in alternativa, di toglierle", () => {
    expect(r.proposals.map((p) => p.id)).toEqual(expect.arrayContaining(["elimina"]));
    const onTue = plan.filter((w) => w.date === tue);
    if (onTue.some((w) => isHard(w.type))) expect(r.proposals.map((p) => p.id)).toContain("sposta");
  });
  it("ogni proposta ha motivo e rispetta le regole", () => {
    for (const p of r.proposals) {
      expect(p.reasons.length).toBeGreaterThan(0);
      expect(violations(plan, p.changes, { today, athlete, plan, events, disruption: { kind: "nessun_allenamento", from: tue } })).toEqual([]);
    }
  });
  it("nessuna seduta resta nel giorno bloccato", () => {
    const sposta = r.proposals.find((p) => p.id === "sposta");
    for (const c of sposta?.changes ?? []) if (c.op !== "elimina") expect(c.patch.date).not.toBe(tue);
  });
});

describe("poco tempo", () => {
  it("accorcia senza superare i minuti disponibili per le sedute continue", () => {
    const longest = plan.filter((w) => w.date < "2026-11-23").sort((x, y) => y.durationMin - x.durationMin)[0];
    const r = run({ kind: "poco_tempo", from: longest.date, availableMin: 45 });
    const acc = r.proposals.find((p) => p.id === "accorcia");
    expect(acc).toBeDefined();
    for (const c of acc!.changes) if (c.op !== "elimina" && c.before.type !== "ripetute") expect(c.patch.durationMin).toBeLessThanOrEqual(50);
  });
  it("se la seduta sta già nel tempo, nessuna modifica", () => {
    const r = run({ kind: "poco_tempo", from: day("Sab"), availableMin: 600 });
    expect(r.proposals).toEqual([]);
  });
});

describe("dolore e malattia", () => {
  it("con dolore alla corsa, nessuna seduta dura di corsa nei 3 giorni e sempre l'avviso di cura", () => {
    const r = run({ kind: "dolore", from: day("Lun"), painSport: "run" });
    expect(r.care).toMatch(/medico|fisioterapista/);
    for (const p of r.proposals) {
      for (const c of p.changes) if (c.op !== "elimina") expect(isHard(c.patch.type) && c.patch.sport === "run").toBe(false);
    }
  });
  it("con dolore forte niente opzione 'alleggerisci'", () => {
    const r = run({ kind: "dolore", from: day("Lun"), painSport: "run", painSevere: true });
    expect(r.proposals.map((p) => p.id)).not.toContain("alleggerisci");
  });
  it("malattia: niente sedute nei giorni di malattia e rientro solo facile", () => {
    const r = run({ kind: "malato", from: day("Lun"), to: day("Mer") });
    const p = r.proposals.find((x) => x.id === "rientro")!;
    for (const c of p.changes) if (c.op !== "elimina") expect(isHard(c.patch.type)).toBe(false);
    expect(r.care).toBeDefined();
  });
});

describe("seduta saltata", () => {
  it("una seduta facile saltata non si recupera", () => {
    const easy = plan.find((w) => !isHard(w.type) && w.sport !== "gym")!;
    const p2 = plan.map((w) => (w.id === easy.id ? { ...w, status: "saltato" as const } : w));
    const r = run({ kind: "saltata", from: easy.date, workoutId: easy.id }, p2);
    expect(r.proposals.every((p) => p.changes.length === 0)).toBe(true);
  });
});

describe("400 imprevisti casuali", () => {
  it("nessuna proposta viola le regole di sicurezza", () => {
    let seed = 11;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const kinds: DisruptionKind[] = ["nessun_allenamento", "poco_tempo", "stanco", "dolore", "malato", "viaggio"];
    const sports: Sport[] = ["run", "bike", "swim"];
    const problems: string[] = [];
    for (let i = 0; i < 400; i++) {
      const kind = kinds[Math.floor(rnd() * kinds.length)];
      const from = addDays(today, Math.floor(rnd() * 20));
      const d: Disruption = {
        kind, from,
        to: kind === "viaggio" || kind === "malato" ? addDays(from, Math.floor(rnd() * 4)) : undefined,
        availableMin: kind === "poco_tempo" ? [15, 30, 45, 60][Math.floor(rnd() * 4)] : undefined,
        painSport: kind === "dolore" ? sports[Math.floor(rnd() * 3)] : undefined,
        painSevere: kind === "dolore" ? rnd() < 0.3 : undefined,
      };
      const r = run(d);
      for (const p of r.proposals) {
        const v = violations(plan, p.changes, { today, athlete, plan, events, disruption: d });
        if (v.length) problems.push(`${kind} ${from} ${p.id}: ${v[0]}`);
        if (!p.reasons.length) problems.push(`${kind} ${p.id}: senza motivo`);
      }
    }
    expect(problems.slice(0, 5)).toEqual([]);
  });
});
