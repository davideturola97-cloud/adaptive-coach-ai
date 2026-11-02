import type { Sport, TriFormat, WorkoutType } from "./types";

/** Ordine di visualizzazione: come in una gara di triathlon, poi la palestra. */
export const SPORT_KEYS: Sport[] = ["swim", "bike", "run", "gym"];

/** Scheda di ogni sport: nome, colori e tipi di seduta. Aggiungere uno sport = aggiungere una voce. */
export const SPORTS: Record<Sport, { label: string; colorVar: string; softVar: string; types: WorkoutType[]; volumeHint: string; endurance: boolean }> = {
  swim: {
    label: "Nuoto",
    colorVar: "var(--color-swim)",
    softVar: "var(--color-swim-soft)",
    types: ["tecnica_nuoto", "aerobico_nuoto", "css_nuoto", "ripetute_nuoto", "recupero_nuoto", "test_css"],
    volumeHint: "Es. 2 uscite, 4 km a settimana",
    endurance: true,
  },
  bike: {
    label: "Ciclismo",
    colorVar: "var(--color-bike)",
    softVar: "var(--color-bike-soft)",
    types: ["endurance", "recupero_bici", "tempo_bici", "sweet_spot", "soglia", "vo2max", "test_ftp"],
    volumeHint: "Es. 4 ore a settimana",
    endurance: true,
  },
  run: {
    label: "Corsa",
    colorVar: "var(--color-run)",
    softVar: "var(--color-run-soft)",
    types: ["corsa_facile", "lungo", "ripetute", "tempo_run", "progressivo", "recupero_corsa", "test_corsa"],
    volumeHint: "Es. 30 km a settimana",
    endurance: true,
  },
  gym: {
    label: "Palestra",
    colorVar: "var(--color-gym)",
    softVar: "var(--color-gym-soft)",
    types: ["forza_generale", "forza_specifica", "core_mobilita", "prevenzione"],
    volumeHint: "Es. 2 sedute da 45 minuti",
    endurance: false,
  },
};

export const sportLabel = (s: Sport) => SPORTS[s].label;

export const WORKOUT_TYPE_LABEL: Record<WorkoutType, string> = {
  corsa_facile: "Corsa facile",
  lungo: "Lungo",
  ripetute: "Ripetute",
  tempo_run: "Tempo run",
  progressivo: "Progressivo",
  recupero_corsa: "Recupero",
  test_corsa: "Test",
  endurance: "Endurance",
  recupero_bici: "Recupero",
  tempo_bici: "Tempo",
  sweet_spot: "Sweet spot",
  soglia: "Soglia",
  vo2max: "VO₂max",
  test_ftp: "Test FTP",
  tecnica_nuoto: "Tecnica",
  aerobico_nuoto: "Aerobico",
  css_nuoto: "Ritmo CSS",
  ripetute_nuoto: "Ripetute",
  recupero_nuoto: "Recupero",
  test_css: "Test CSS",
  forza_generale: "Forza generale",
  forza_specifica: "Forza specifica",
  core_mobilita: "Core e mobilità",
  prevenzione: "Prevenzione infortuni",
};

/** Distanze standard dei formati di triathlon (km). */
export const TRI_FORMATS: Record<Exclude<TriFormat, "personalizzato">, { label: string; swimKm: number; bikeKm: number; runKm: number }> = {
  sprint: { label: "Sprint", swimKm: 0.75, bikeKm: 20, runKm: 5 },
  olimpico: { label: "Olimpico", swimKm: 1.5, bikeKm: 40, runKm: 10 },
  medio: { label: "Medio (70.3)", swimKm: 1.9, bikeKm: 90, runKm: 21.1 },
  lungo: { label: "Lungo (Ironman)", swimKm: 3.8, bikeKm: 180, runKm: 42.2 },
};
