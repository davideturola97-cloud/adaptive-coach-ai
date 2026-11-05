/**
 * Modello di dominio di Adaptive Coach AI.
 *
 * Gli sport sono un elenco chiuso ma estendibile: per aggiungerne uno basta la chiave qui,
 * la sua scheda in `sports.ts` e una riga nella tabella `sports` del database.
 * Il triathlon non è uno sport a sé: è un tipo di gara che combina nuoto, bici e corsa.
 */

export type Sport = "swim" | "bike" | "run" | "gym";

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
  | "test_ftp"
  | "brick"
  // nuoto
  | "tecnica_nuoto"
  | "aerobico_nuoto"
  | "css_nuoto"
  | "ripetute_nuoto"
  | "recupero_nuoto"
  | "test_css"
  // palestra (di supporto agli sport praticati)
  | "forza_generale"
  | "forza_specifica"
  | "core_mobilita"
  | "prevenzione";

/** Una fase della seduta. L'intensità è sempre espressa in RPE; ritmo o potenza solo se esiste un dato affidabile. */
export interface WorkoutStep {
  label: string;
  durationMin?: number;
  distanceKm?: number;
  repeat?: number;
  rpe: [number, number];
  target?: { value: string; origin: ValueOrigin };
  note?: string;
  /** Zona di passo della corsa per questa fase (es. "soglia", "mezza"); "rpe" = solo sensazioni, nessun passo. */
  zone?: string;
  /** Esercizio della scheda di palestra (serie, ripetizioni, carico previsti). */
  exercise?: GymExercise;
}

export interface WorkoutStructure {
  warmup: WorkoutStep[];
  main: WorkoutStep[];
  recoveries?: string;
  /** Passo dei recuperi tra ripetute o blocchi (calcolato, non salvato). */
  recoveryTarget?: { value: string; origin: ValueOrigin };
  /** Zona di passo dei recuperi (corsa): "recuperoTraProve" di default, "rpe" se si cammina o si scende da una salita. */
  recoveryZone?: string;
  /** Seduta della libreria: famiglia e livello, per far progredire le sedute successive. */
  session?: { family: string; level: number; maxLevel: number };
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
  skipReason?: string;
  /** Da dove vengono i passi mostrati (calcolati al momento, non salvati). */
  paceSource?: string;
}

export interface Feedback {
  rpe: number; // 1-10
  /** Facoltativi: basta l'RPE. */
  muscleFatigue?: number; // 1-5
  cardioFatigue?: number; // 1-5
  sleepQuality?: number; // 1-5
  feeling?: "ottimo" | "buono" | "normale" | "stanco" | "pessimo";
  pain?: string;
  notes?: string;
}

/** Un parziale (di solito un km). `paceSec` è il tempo per km in secondi, anche per bici e nuoto. */
export interface Split {
  n: number;
  km: number;
  paceSec?: number;
  hr?: number;
  elevM?: number;
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
  source: "manuale" | "screenshot" | "file" | "demo" | "strava";
  /** Identificativo dell'attività di origine, es. "strava:123456". */
  externalId?: string;
  splits?: Split[];
  /** Palestra: carichi e ripetizioni fatti davvero. */
  gymLog?: GymLogEntry[];
  /** L'atleta non ricorda lo sforzo: non chiedere più l'RPE. */
  feedbackSkipped?: boolean;
  feedback?: Feedback;
}

export interface TestResult {
  id: string;
  date: string;
  sport: Sport;
  kind: TestKind;
  rawValue: string;
  derived: { label: string; value: string; origin: ValueOrigin }[];
}

export type TestKind = "5km" | "cooper" | "recente_corsa" | "ftp20" | "ramp" | "ftp_nota" | "css" | "recente_nuoto";

export type TriFormat = "sprint" | "olimpico" | "medio" | "lungo" | "personalizzato";

/** Una gara. Se `kind` è "triathlon" le distanze delle frazioni sono in `legs` e `sport` non c'è. */
export interface RaceEvent {
  id: string;
  name: string;
  date: string;
  dateTentative?: boolean;
  kind: "singolo" | "triathlon";
  sport?: Sport;
  distanceKm?: number;
  triFormat?: TriFormat;
  legs?: { swimKm: number; bikeKm: number; runKm: number };
  priority: "A" | "B" | "C";
  /** Obiettivo di tempo scelto dall'atleta (secondi). */
  goalTimeSec?: number;
}

export interface AthleteSport {
  sport: Sport;
  level: Level;
  yearsExperience: number;
  weeklyVolume?: string;
}

/** Profilo atleta. I campi facoltativi possono mancare finché l'atleta non completa l'onboarding. */
export interface GymExercise {
  name: string; // es. "Squat"
  sets: number;
  reps: string; // es. "8", "8-10", "30″"
  loadKg?: number;
  restSec?: number;
  note?: string;
}

/** Un esercizio fatto: carico usato, ripetizioni per serie e se tutte le serie sono riuscite. */
export interface GymLogEntry {
  name: string;
  sets: number;
  reps: string;
  loadKg?: number;
  done: boolean;
}

export interface GymDay {
  day: string; // "Lun" ... "Dom"
  groups: string[]; // es. ["petto", "tricipiti"]
  durationMin: number;
  /** Esercizi della seduta, nell'ordine. */
  exercises?: GymExercise[];
}

export interface AthleteProfile {
  name: string;
  birthDate?: string;
  sex?: "M" | "F" | "altro";
  heightCm?: number;
  weightKg?: number;
  sports: AthleteSport[];
  weeklyHoursAvailable?: number;
  availableDays: string[];
  maxSessionMin?: number;
  equipment: string[];
  limitations: string[];
  goals: { primary: string; secondary: string[] };
  swim?: { poolLengthM?: 25 | 50; openWater: boolean; wetsuit: boolean; strokes: string[] };
  /** Giorni in cui mettere lunghi e combinati (es. Sab, Dom). Vuoto = weekend disponibile. */
  longDays: string[];
  /** Durata massima nei giorni dei lunghi. Se manca vale `maxSessionMin`. */
  longSessionMaxMin?: number;
  /** Giorni preferiti per sport (facoltativo), es. nuoto solo Lun e Mer. */
  sportDays: Partial<Record<Sport, string[]>>;
  /** Attività quotidiana fuori dall'allenamento (lavoro), per il fabbisogno calorico. */
  dailyActivity?: "sedentario" | "in piedi" | "fisico";
  /** Scheda di palestra a giorni fissi scelta dall'atleta (se c'è, il motore la rispetta invece di proporre la sua). */
  gymSchedule?: GymDay[];
  ftpW?: { value: number; origin: ValueOrigin; date: string };
  thresholdPaceSecPerKm?: { value: number; origin: ValueOrigin; date: string };
  cssPaceSecPer100m?: { value: number; origin: ValueOrigin; date: string };
}

export type PlannedTestStatus = "proposto" | "programmato" | "rimandato" | "rifiutato" | "completato";

/** Un test proposto dal coach. Finché non è fatto, l'app usa gli ultimi parametri affidabili (o l'RPE). */
export interface PlannedTest {
  id: string;
  sport: Sport;
  kind: TestKind;
  status: PlannedTestStatus;
  dueDate?: string;
  reason: string;
}
