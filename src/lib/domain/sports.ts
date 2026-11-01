import type { Sport, WorkoutType } from "./types";

/** Scheda di ogni sport: nome, colore e tipi di seduta. Aggiungere uno sport = aggiungere una voce. */
export const SPORTS: Record<Sport, { label: string; colorVar: string; types: WorkoutType[] }> = {
  run: {
    label: "Corsa",
    colorVar: "var(--color-run)",
    types: ["corsa_facile", "lungo", "ripetute", "tempo_run", "progressivo", "recupero_corsa", "test_corsa"],
  },
  bike: {
    label: "Ciclismo",
    colorVar: "var(--color-bike)",
    types: ["endurance", "recupero_bici", "tempo_bici", "sweet_spot", "soglia", "vo2max", "test_ftp"],
  },
};

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
};
