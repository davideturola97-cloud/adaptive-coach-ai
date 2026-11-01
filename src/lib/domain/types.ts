/**
 * Modello di dominio di Adaptive Coach AI.
 *
 * Gli sport sono un elenco chiuso ma estendibile: per aggiungere nuoto,
 * palestra o triathlon basta aggiungere la chiave qui e la sua scheda in
 * `sports.ts`. Il resto dell'app lavora su `Sport` senza casi speciali.
 */

export type Sport = "run" | "bike";

export type Level = "principiante" | "intermedio" | "avanzato";

/** Da dove viene un numero: misurato da un dispositivo, stimato da una formula, o dato dimostrativo. */
export type ValueOrigin = "misurato" | "stimato" | "dichiarato";

export type WorkoutType =
  // corsa
  | "corsa_facile"
  | "lungo"
  | "ripetute"
  | "tempo_run"
  | "progressivo"
  | "recupero_corsa"
  | "test_corsa"
  // ciclismo
  | "endurance"
  | "recupero_bici"
  | "tempo_bici"
  | "sweet_spot"
  | "soglia"
  | "vo2max"
  | "test_ftp";

/** Una fase della seduta. L'intensità è sempre espressa in RPE; ritmo o potenza solo se esiste un dato affidabile. */
export interface WorkoutStep {
  label: string;
  durationMin?: number;
  distanceKm?: number;
  repeat?: number;
  rpe: [number, number];
  target?: { value: string; origin: ValueOrigin };
  note?: string;
}

export interface WorkoutStructure {
  warmup: WorkoutStep[];
  main: WorkoutStep[];
  recoveries?: string;
  cooldown: WorkoutStep[];
}

export type WorkoutStatus = "programmato" | "completato" | "saltato" | "modificato";

export interface PlannedWorkout {
  id: string;
  date: string; // YYYY-MM-DD
  sport: Sport;
  type: WorkoutType;
  title: string;
  objective: string;
  durationMin: number;
  distanceKm?: number;
  intensity: string;
  structure: WorkoutStructure;
  technicalTips: string[];
  safetyNotes: string[];
  status: WorkoutStatus;
  completedActivityId?: string;
}

export interface Feedback {
  rpe: number; // 1-10
  muscleFatigue: number; // 1-5
  cardioFatigue: number; // 1-5
  sleepQuality?: number; // 1-5
  feeling: "ottimo" | "buono" | "normale" | "stanco" | "pessimo";
  pain?: string;
  notes?: string;
}

export interface CompletedActivity {
  id: string;
  date: string;
  sport: Sport;
  title: string;
  durationMin: number;
  distanceKm?: number;
  avgHr?: number;
  avgPowerW?: number;
  elevationM?: number;
  source: "manuale" | "screenshot" | "file" | "demo";
  feedback?: Feedback;
}

export interface TestResult {
  id: string;
  date: string;
  sport: Sport;
  kind: "5km" | "cooper" | "ftp20" | "ramp" | "dichiarato";
  rawValue: string;
  derived: { label: string; value: string; origin: ValueOrigin }[];
}

export interface RaceEvent {
  id: string;
  name: string;
  date: string;
  sport: Sport;
  distanceKm?: number;
  priority: "A" | "B" | "C";
}

export interface AthleteProfile {
  name: string;
  birthDate: string;
  sex?: "M" | "F" | "altro";
  heightCm: number;
  weightKg: number;
  sports: { sport: Sport; level: Level; yearsExperience: number }[];
  weeklyHoursAvailable: number;
  availableDays: string[];
  maxSessionMin: number;
  equipment: string[];
  limitations: string[];
  goals: { primary: string; secondary: string[] };
  ftpW?: { value: number; origin: ValueOrigin; date: string };
  thresholdPaceSecPerKm?: { value: number; origin: ValueOrigin; date: string };
}
