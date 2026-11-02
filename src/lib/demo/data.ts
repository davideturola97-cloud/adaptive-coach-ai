import { addDays, mondayOf, todayISO } from "@/lib/dates";
import type { AthleteProfile, CompletedActivity, Feedback, PlannedTest, PlannedWorkout, RaceEvent, TestResult, WorkoutType } from "@/lib/domain/types";
import { formatPace, formatTime, ftpFrom20Min, powerZones, thresholdPaceFrom5k } from "@/lib/training/formulas";
import { template } from "./workouts";

/**
 * DATI DIMOSTRATIVI. Nessuno di questi numeri appartiene a una persona reale.
 * Sono generati in modo deterministico attorno alla data di oggi, così le schermate
 * hanno sempre una settimana in corso, uno storico e un programma futuro.
 */
export const DEMO = true;

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Lun=0 ... Dom=6. null = riposo.
const WEEK: ((week: number) => WorkoutType | null)[] = [
  (w) => (w % 2 ? "core_mobilita" : "forza_generale"),
  (w) => (w % 2 ? "tempo_run" : "ripetute"),
  () => "endurance",
  () => "corsa_facile",
  (w) => (w % 2 ? "css_nuoto" : "tecnica_nuoto"),
  (w) => (w % 2 ? "soglia" : "sweet_spot"),
  (w) => (w % 4 === 3 ? "progressivo" : "lungo"),
];
const LOAD_CYCLE = [0.9, 1, 1.1, 0.8]; // tre settimane di carico, una di scarico

export interface DemoData {
  today: string;
  athlete: AthleteProfile;
  events: RaceEvent[];
  plan: PlannedWorkout[];
  activities: CompletedActivity[];
  tests: TestResult[];
  plannedTests: PlannedTest[];
}

export function buildDemoData(now = new Date()): DemoData {
  const today = todayISO(now);
  const monday = mondayOf(today);
  const firstMonday = addDays(monday, -7 * 10);
  const rand = rng(42);

  const plan: PlannedWorkout[] = [];
  const activities: CompletedActivity[] = [];

  for (let w = 0; w < 14; w++) {
    const weekStart = addDays(firstMonday, w * 7);
    const scale = LOAD_CYCLE[w % 4];
    for (let d = 0; d < 7; d++) {
      const type = WEEK[d](w);
      if (!type) continue;
      const date = addDays(weekStart, d);
      const t = template(type, scale);
      const id = `w-${date}`;
      const past = date < today;
      const skipped = past && rand() < 0.1;
      const workout: PlannedWorkout = { ...t, id, date, status: past ? (skipped ? "saltato" : "completato") : "programmato" };

      if (past && !skipped) {
        const durationMin = Math.round(t.durationMin * (0.92 + rand() * 0.16));
        const mainRpe = t.structure.main[0]?.rpe[1] ?? 4;
        const rpe = Math.max(2, Math.min(10, Math.round(mainRpe - 1 + rand() * 1.6)));
        const feedback: Feedback = {
          rpe,
          muscleFatigue: Math.min(5, Math.max(1, Math.round(rpe / 2 + rand() - 0.5))),
          cardioFatigue: Math.min(5, Math.max(1, Math.round(rpe / 2))),
          sleepQuality: 3 + Math.round(rand() * 2),
          feeling: rpe >= 8 ? "stanco" : rand() > 0.5 ? "buono" : "ottimo",
        };
        const isRun = t.sport === "run";
        const isSwim = t.sport === "swim";
        const isGym = t.sport === "gym";
        const paceSec = 330 - w * 1.5 + (rpe >= 7 ? -40 : 0); // il ritmo migliora piano nelle settimane
        const act: CompletedActivity = {
          id: `a-${date}`,
          date,
          sport: t.sport,
          title: t.title,
          durationMin,
          distanceKm: isGym ? undefined : isSwim ? Math.round(durationMin * 0.04 * 100) / 100 : isRun ? Math.round(((durationMin * 60) / paceSec) * 10) / 10 : Math.round(durationMin * 0.48 * 10) / 10,
          avgHr: isGym ? undefined : Math.round(128 + rpe * 5 + rand() * 6),
          avgPowerW: t.sport === "bike" ? Math.round(140 + rpe * 12 + w * 1.2) : undefined,
          elevationM: isRun || t.sport === "bike" ? Math.round(rand() * (isRun ? 80 : 600)) : undefined,
          source: "demo",
          feedback,
        };
        activities.push(act);
        workout.completedActivityId = act.id;
      }
      plan.push(workout);
    }
  }

  const test5kSec = 24 * 60 + 30;
  const thrPace = thresholdPaceFrom5k(test5kSec);
  const ftp = ftpFrom20Min(248);
  const tests: TestResult[] = [
    {
      id: "t-5k", date: addDays(firstMonday, 5), sport: "run", kind: "5km", rawValue: `5 km in ${formatTime(test5kSec)}`,
      derived: [
        { label: "Ritmo di soglia", value: formatPace(thrPace), origin: "stimato" },
        { label: "Ritmo corsa facile", value: `${formatPace(thrPace * 1.2)} – ${formatPace(thrPace * 1.3)}`, origin: "stimato" },
      ],
    },
    {
      id: "t-ftp", date: addDays(firstMonday, 19), sport: "bike", kind: "ftp20", rawValue: "20' a 248 W di media",
      derived: [{ label: "FTP", value: `${ftp} W`, origin: "stimato" }, ...powerZones(ftp).slice(1, 4).map((z) => ({
        label: `Z${z.zone} ${z.name}`, value: `${z.minW}–${z.maxW} W`, origin: "stimato" as const,
      }))],
    },
  ];

  const athlete: AthleteProfile = {
    name: "Atleta demo",
    birthDate: "1990-05-14",
    sex: "M",
    heightCm: 178,
    weightKg: 74,
    sports: [
      { sport: "run", level: "intermedio", yearsExperience: 4 },
      { sport: "bike", level: "principiante", yearsExperience: 1 },
      { sport: "swim", level: "principiante", yearsExperience: 1 },
      { sport: "gym", level: "intermedio", yearsExperience: 3 },
    ],
    swim: { poolLengthM: 25, openWater: true, wetsuit: true, strokes: ["Stile libero", "Dorso"] },
    weeklyHoursAvailable: 7,
    availableDays: ["Mar", "Mer", "Gio", "Ven", "Sab", "Dom"],
    maxSessionMin: 120,
    equipment: ["Orologio GPS con fascia cardio", "Bici da strada", "Rulli smart"],
    limitations: ["Tendine d'Achille sinistro sensibile dopo le salite"],
    goals: { primary: "Mezza maratona sotto 1:45", secondary: ["Primo triathlon olimpico", "Correre con costanza 3 volte a settimana"] },
    ftpW: { value: ftp, origin: "stimato", date: tests[1].date },
    thresholdPaceSecPerKm: { value: thrPace, origin: "stimato", date: tests[0].date },
  };

  const events: RaceEvent[] = [
    { id: "e-1", name: "Mezza maratona (demo)", date: addDays(monday, 7 * 3 + 6), kind: "singolo", sport: "run", distanceKm: 21.1, priority: "A" },
    { id: "e-2", name: "Triathlon olimpico (demo)", date: addDays(monday, 7 * 14 + 6), kind: "triathlon", triFormat: "olimpico", legs: { swimKm: 1.5, bikeKm: 40, runKm: 10 }, priority: "B" },
  ];

  const plannedTests: PlannedTest[] = [
    { id: "pt-css", sport: "swim", kind: "css", status: "proposto", reason: "Non hai ancora un ritmo di soglia in acqua." },
  ];

  return { today, athlete, events, plan, activities, tests, plannedTests };
}
