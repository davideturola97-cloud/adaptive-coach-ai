import { expect, it } from "vitest";
import type { AthleteProfile, RaceEvent, Sport } from "@/lib/domain/types";
import { addDays, weekdayName } from "@/lib/dates";
import { generatePlan, isHard } from "./engine";

const DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const ev: RaceEvent[] = [
  { id: "1", name: "Ravenna", date: "2026-11-08", kind: "singolo", sport: "run", priority: "A" },
  { id: "2", name: "Reggio", date: "2026-12-13", kind: "singolo", sport: "run", priority: "A" },
  { id: "3", name: "Ledro", date: "2027-07-04", kind: "triathlon", triFormat: "medio", legs: { swimKm: 1.9, bikeKm: 90, runKm: 21.1 }, priority: "A" },
];
function rng(seed: number) { return () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648); }

it("400 combinazioni casuali di giorni e preferenze: nessuna seduta fuori e regole sempre rispettate", () => {
  const r = rng(7);
  const problems: string[] = [];
  for (let i = 0; i < 400; i++) {
    const avail = DAYS.filter(() => r() < 0.75);
    if (avail.length < 3) continue;
    const pick = () => avail.filter(() => r() < 0.5);
    const sportDays: Partial<Record<Sport, string[]>> = {};
    for (const s of ["swim", "bike", "run", "gym"] as Sport[]) if (r() < 0.5) { const p = pick(); if (p.length) sportDays[s] = p; }
    const longDays = avail.filter((d) => d === "Sab" || d === "Dom");
    const a: AthleteProfile = {
      name: "x", equipment: [], limitations: [], goals: { primary: "", secondary: [] },
      sports: [{ sport: "run", level: "intermedio", yearsExperience: 3 }, { sport: "bike", level: "intermedio", yearsExperience: 2 }, { sport: "swim", level: "principiante", yearsExperience: 1 }, { sport: "gym", level: "intermedio", yearsExperience: 2 }],
      availableDays: avail, longDays, weeklyHoursAvailable: 5 + Math.floor(r() * 10), maxSessionMin: 60 + Math.floor(r() * 4) * 15, longSessionMaxMin: 150, sportDays,
    };
    const p = generatePlan({ today: "2026-11-02", athlete: a, events: ev, weeks: 10 });
    const id = `${avail.join(",")} | ${JSON.stringify(sportDays)} | ${a.weeklyHoursAvailable}h`;
    const bad = p.warnings.filter((w) => w.includes("non c'è un giorno libero"));
    if (bad.length) problems.push(`${id} | ${bad[0]}`);
    // Regole che devono valere sempre
    const hard = new Set(p.workouts.filter((w) => isHard(w.type)).map((w) => w.date));
    for (const w of p.workouts) {
      const day = weekdayName(w.date, true);
      if (!avail.includes(day)) problems.push(`${id} | seduta in un giorno non disponibile`);
      if (sportDays[w.sport]?.length && !sportDays[w.sport]!.includes(day)) problems.push(`${id} | ${w.sport} fuori dai giorni preferiti`);
      const quality = isHard(w.type) && w.type !== "lungo" && w.type !== "brick" && w.type !== "endurance";
      if (quality && (hard.has(addDays(w.date, 1)) || hard.has(addDays(w.date, -1)))) problems.push(`${id} | sedute dure consecutive ${w.date}`);
    }
    for (const wk of p.weeks) if (wk.plannedMin > a.weeklyHoursAvailable! * 60) problems.push(`${id} | settimana oltre le ore`);
  }
  expect(problems.slice(0, 5)).toEqual([]);
});
