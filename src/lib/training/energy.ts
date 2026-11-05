/**
 * Fabbisogno di mantenimento della giornata: metabolismo a riposo + vita quotidiana + allenamento.
 * Sono STIME (±10–15%): servono a orientarsi, non a contare ogni caloria. Non è un consiglio medico o dietetico:
 * con obiettivi di peso, disturbi alimentari o patologie serve un professionista.
 *
 * - Metabolismo a riposo: Mifflin-St Jeor (1990). Uomo 10·kg + 6,25·cm − 5·anni + 5; donna … − 161.
 * - Vita quotidiana (senza allenamento): × 1,3 lavoro sedentario, × 1,5 in piedi, × 1,7 lavoro fisico (1,4 se non indicato).
 * - Allenamento, calorie NETTE (oltre quelle già contate):
 *   corsa ≈ 0,95 kcal per kg per km; bici con potenza ≈ watt medi × secondi ÷ 1000 (lavoro meccanico in kJ ≈ kcal spese,
 *   perché il rendimento del corpo è circa il 24%); senza potenza e per nuoto e palestra: (MET − 1) × kg × ore,
 *   con MET da Ainsworth (Compendium of Physical Activities) per intensità facile/media/dura.
 * - Ripartizione (linee guida per atleti di resistenza, ACSM/IOC): proteine 1,6 g/kg (1,8 nei giorni duri o lunghi),
 *   carboidrati da 3 g/kg (riposo) a 8 g/kg (giornate oltre 2 ore o molto intense), 8–10 g/kg il giorno prima di una gara
 *   lunga; grassi il resto, mai sotto 0,8 g/kg.
 */
import { addDays, daysBetween } from "@/lib/dates";
import type { AthleteProfile, CompletedActivity, PlannedWorkout, RaceEvent, Sport } from "@/lib/domain/types";
import { isHard } from "@/lib/planning/engine";

type Intensity = "facile" | "media" | "dura";
const MET: Record<Exclude<Sport, "run">, Record<Intensity, number>> = {
  bike: { facile: 6, media: 8, dura: 10.5 },
  swim: { facile: 6, media: 8.3, dura: 10 },
  gym: { facile: 3.5, media: 5, dura: 6 },
};
const RUN_MET: Record<Intensity, number> = { facile: 8.5, media: 10, dura: 11.5 };

export interface EnergySession {
  title: string;
  sport: Sport;
  minutes: number;
  kcal: number;
  done: boolean;
}

export interface EnergyDay {
  bmr: number;
  daily: number;
  training: number;
  total: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  dayType: "riposo" | "leggera" | "moderata" | "intensa" | "pre-gara" | "gara";
  sessions: EnergySession[];
  notes: string[];
}

export function bmr(a: Pick<AthleteProfile, "weightKg" | "heightCm" | "birthDate" | "sex">, today: string): number | null {
  if (!a.weightKg || !a.heightCm || !a.birthDate) return null;
  const age = Math.floor(daysBetween(a.birthDate, today) / 365.25);
  const base = 10 * a.weightKg + 6.25 * a.heightCm - 5 * age;
  return Math.round(base + (a.sex === "M" ? 5 : a.sex === "F" ? -161 : -78));
}

const DAILY: Record<NonNullable<AthleteProfile["dailyActivity"]>, number> = { sedentario: 1.3, "in piedi": 1.5, fisico: 1.7 };

function intensityOf(rpe: number | undefined, hard: boolean): Intensity {
  if (rpe !== undefined) return rpe >= 7 ? "dura" : rpe >= 5 ? "media" : "facile";
  return hard ? "dura" : "facile";
}

/** Calorie nette di una seduta (oltre metabolismo e vita quotidiana). */
export function sessionKcal(x: { sport: Sport; minutes: number; distanceKm?: number; avgPowerW?: number }, kg: number, intensity: Intensity): number {
  const h = x.minutes / 60;
  if (x.sport === "run") return Math.round(x.distanceKm ? 0.95 * kg * x.distanceKm : (RUN_MET[intensity] - 1) * kg * h);
  if (x.sport === "bike" && x.avgPowerW) return Math.round((x.avgPowerW * x.minutes * 60) / 1000);
  return Math.round((MET[x.sport][intensity] - 1) * kg * h);
}

const r50 = (n: number) => Math.round(n / 50) * 50;
const r5 = (n: number) => Math.round(n / 5) * 5;

export function energyDay(
  a: AthleteProfile,
  plan: PlannedWorkout[],
  activities: CompletedActivity[],
  events: RaceEvent[],
  date: string,
): EnergyDay | null {
  const base = bmr(a, date);
  if (!base || !a.weightKg) return null;
  const kg = a.weightKg;
  const daily = Math.round(base * (a.dailyActivity ? DAILY[a.dailyActivity] : 1.4));
  // Fatte oggi (dati veri) + quelle ancora in programma.
  const done = activities.filter((x) => x.date === date);
  const todo = plan.filter((p) => p.date === date && p.status === "programmato");
  const sessions: EnergySession[] = [
    ...done.map((x) => {
      const p = plan.find((w) => w.completedActivityId === x.id);
      return { title: x.title || p?.title || "Attività", sport: x.sport, minutes: x.durationMin, done: true, kcal: sessionKcal({ sport: x.sport, minutes: x.durationMin, distanceKm: x.distanceKm, avgPowerW: x.avgPowerW }, kg, intensityOf(x.feedback?.rpe, Boolean(p && isHard(p.type)))) };
    }),
    ...todo.map((p) => ({ title: p.title, sport: p.sport, minutes: p.durationMin, done: false, kcal: sessionKcal({ sport: p.sport, minutes: p.durationMin, distanceKm: p.distanceKm }, kg, intensityOf(undefined, isHard(p.type))) })),
  ];
  const training = sessions.reduce((t, s) => t + s.kcal, 0);
  const minutes = sessions.filter((s) => s.sport !== "gym").reduce((t, s) => t + s.minutes, 0);
  const hard = todo.some((p) => isHard(p.type) && p.type !== "lungo") || done.some((x) => (x.feedback?.rpe ?? 0) >= 7);
  const raceToday = events.find((e) => e.date === date && e.priority !== "C");
  const raceTomorrow = events.find((e) => e.date === addDays(date, 1) && e.priority !== "C");
  const longRace = raceTomorrow && ((raceTomorrow.distanceKm ?? 0) >= 21 || raceTomorrow.kind === "triathlon");

  let dayType: EnergyDay["dayType"];
  let carbPerKg: number;
  if (raceToday) { dayType = "gara"; carbPerKg = 7; }
  else if (longRace) { dayType = "pre-gara"; carbPerKg = 8; }
  else if (!sessions.length) { dayType = "riposo"; carbPerKg = 3; }
  else if (minutes >= 120 || (hard && minutes >= 75)) { dayType = "intensa"; carbPerKg = minutes >= 150 ? 8 : 7; }
  else if (hard || minutes >= 60) { dayType = "moderata"; carbPerKg = 5.5; }
  else { dayType = "leggera"; carbPerKg = 4.5; }

  // Il giorno della gara si stima anche la gara stessa, se non è già nel programma.
  let raceKcal = 0;
  if (raceToday && raceToday.distanceKm && raceToday.sport === "run" && !sessions.some((s) => s.sport === "run")) raceKcal = Math.round(0.95 * kg * raceToday.distanceKm);
  let total = r50(daily + training + raceKcal);
  const proteinG = r5(kg * (dayType === "intensa" || dayType === "gara" ? 1.8 : 1.6));
  let carbsG = r5(kg * carbPerKg);
  let fatG = r5((total - proteinG * 4 - carbsG * 4) / 9);
  const minFat = r5(kg * 0.8);
  const notes: string[] = [];
  const extra: string[] = [];
  if (fatG < minFat) {
    fatG = minFat;
    if (dayType === "pre-gara" || dayType === "gara") {
      // Carico di carboidrati: si tengono, anche se il totale supera un po' il mantenimento (riempiono le riserve di glicogeno).
      const needed = r50(proteinG * 4 + carbsG * 4 + fatG * 9);
      if (needed > total) extra.push(`Oggi il totale supera il mantenimento di circa ${needed - total} kcal: è voluto, i carboidrati in più riempiono le riserve per la gara.`);
      total = Math.max(total, needed);
    } else {
      // Negli altri giorni i carboidrati suggeriti non devono far superare il mantenimento: si riducono un po'.
      carbsG = r5((total - proteinG * 4 - fatG * 9) / 4);
    }
  }
  if (dayType === "pre-gara") notes.push(`Domani c'è ${raceTomorrow!.name}: oggi carboidrati abbondanti (pasta, riso, pane, patate), pochi grassi e poche fibre la sera, niente cibi nuovi.`);
  if (dayType === "gara") notes.push("Giorno di gara: colazione ricca di carboidrati 3 ore prima, durante la gara i gel del piano, dopo l'arrivo carboidrati e proteine entro un'ora.");
  if (dayType === "intensa") notes.push("Giornata impegnativa: carboidrati prima e dopo la seduta; nelle sedute oltre i 90' porta 30–60 g di carboidrati all'ora.");
  if (dayType === "riposo") notes.push("Giorno di riposo: meno carboidrati, proteine come sempre per il recupero muscolare.");
  if (sessions.some((s) => !s.done)) notes.push("Comprende le sedute ancora da fare: se cambiano, il conto si aggiorna.");
  notes.push(...extra);
  if (!a.dailyActivity) notes.push("Indica che lavoro fai per una stima più precisa.");
  return { bmr: base, daily, training: training + raceKcal, total, carbsG, proteinG, fatG, dayType, sessions, notes };
}
