import type { AthleteProfile, WorkoutType } from "@/lib/domain/types";
import { formatPace, formatSwimPace } from "@/lib/training/formulas";
import type { DraftWorkout } from "./engine";

/**
 * Aggiunge ritmi, watt o passi in vasca alla parte centrale, SOLO se l'atleta ha un parametro da test.
 * Senza parametri la seduta resta in RPE. I valori sono sempre marcati "stimato".
 */
const RUN: Partial<Record<WorkoutType, [number, number]>> = {
  corsa_facile: [1.2, 1.3], lungo: [1.15, 1.25], recupero_corsa: [1.3, 1.4], tempo_run: [1.0, 1.03], ripetute: [0.92, 0.95], progressivo: [1.0, 1.25],
};
const BIKE: Partial<Record<WorkoutType, [number, number]>> = {
  endurance: [0.56, 0.75], recupero_bici: [0.45, 0.55], tempo_bici: [0.76, 0.9], sweet_spot: [0.88, 0.94], soglia: [0.95, 1.05], vo2max: [1.06, 1.2], brick: [0.65, 0.78],
};
const SWIM: Partial<Record<WorkoutType, [number, number]>> = {
  aerobico_nuoto: [8, 15], css_nuoto: [0, 3], ripetute_nuoto: [-5, -2], recupero_nuoto: [15, 25],
};

export function applyTargets(w: DraftWorkout, a: AthleteProfile) {
  const main = w.structure.main[0];
  if (!main) return;
  if (w.sport === "run" && a.thresholdPaceSecPerKm && RUN[w.type]) {
    const [lo, hi] = RUN[w.type]!;
    const p = a.thresholdPaceSecPerKm.value;
    main.target = { value: `${formatPace(p * hi).replace(" /km", "")} – ${formatPace(p * lo)}`, origin: "stimato" };
  }
  if ((w.sport === "bike") && a.ftpW && BIKE[w.type]) {
    const [lo, hi] = BIKE[w.type]!;
    main.target = { value: `${Math.round(a.ftpW.value * lo)}–${Math.round(a.ftpW.value * hi)} W`, origin: "stimato" };
  }
  if (w.sport === "swim" && a.cssPaceSecPer100m && SWIM[w.type]) {
    const [lo, hi] = SWIM[w.type]!;
    const c = a.cssPaceSecPer100m.value;
    main.target = { value: `${formatSwimPace(c + lo).replace(" /100 m", "")} – ${formatSwimPace(c + hi)}`, origin: "stimato" };
  }
}
