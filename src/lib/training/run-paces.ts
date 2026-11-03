/**
 * Passi al km per ogni fase delle sedute di corsa: riscaldamento, parte centrale, recuperi, defaticamento.
 * Calcolati al momento (non salvati): seguono la forma attuale. Sono STIME, sempre marcate "stimato".
 *
 * Riferimento: il ritmo di soglia (T, secondi/km) dal test recente; se non c'è o è vecchio,
 * dalla previsione sui 10 km calcolata dagli allenamenti (T = passo 10 km × 1,04, come thresholdPaceFromRun).
 * Senza riferimento le sedute restano in RPE.
 */
import type { AthleteProfile, CompletedActivity, PlannedWorkout, WorkoutStep, WorkoutType } from "@/lib/domain/types";
import { addDays } from "@/lib/dates";
import { formatRaceTime, predictRaces } from "./predictions";

export interface PaceReference {
  thresholdSec: number;
  /** Frase per l'atleta: da dove vengono i passi. */
  source: string;
  /** Passo previsto sui 5 km (per il test). */
  fiveKPaceSec?: number;
}

/** Fasce come multipli del ritmo di soglia: [più veloce, più lento]. */
export const ZONES = {
  recupero: [1.3, 1.45],
  facile: [1.2, 1.32],
  lungo: [1.15, 1.27],
  riscaldamento: [1.25, 1.4],
  defaticamento: [1.28, 1.45],
  recuperoTraProve: [1.35, 1.55],
  soglia: [0.99, 1.03],
  ripetute: [0.92, 0.96],
} as const satisfies Record<string, [number, number]>;

const MAIN_ZONE: Partial<Record<WorkoutType, keyof typeof ZONES>> = {
  corsa_facile: "facile",
  lungo: "lungo",
  recupero_corsa: "recupero",
  tempo_run: "soglia",
  ripetute: "ripetute",
};

const fmtDay = (d: string) => d.split("-").reverse().slice(0, 2).join("/");
/** Arrotonda a 5 secondi: più facile da leggere sull'orologio. */
const r5 = (s: number) => Math.round(s / 5) * 5;
export function paceText(sec: number): string {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
/** "4:30 – 4:40 /km": prima il passo più veloce. */
export function paceRange(t: number, [fast, slow]: readonly [number, number]): string {
  return `${paceText(r5(t * fast))} – ${paceText(r5(t * slow))} /km`;
}

export function paceReference(
  athlete: Pick<AthleteProfile, "thresholdPaceSecPerKm">,
  activities: CompletedActivity[],
  plan: Pick<PlannedWorkout, "type" | "completedActivityId">[],
  today: string,
): PaceReference | null {
  const report = predictRaces(activities, plan, athlete, today);
  const five = report.predictions.find((p) => p.key === "5k");
  const ten = report.predictions.find((p) => p.key === "10k");
  const test = athlete.thresholdPaceSecPerKm;
  // Una previsione affidabile (media o alta) basata su una corsa più recente del test descrive meglio la forma attuale.
  const fresher = ten && ten.confidence !== "bassa" && (!test || ten.basedOn.date > test.date);
  // Il test vale se recente (4 mesi); altrimenti la previsione dagli allenamenti, se c'è.
  if (test && test.date >= addDays(today, -120) && !fresher) {
    return { thresholdSec: test.value, source: `test del ${fmtDay(test.date)}`, fiveKPaceSec: five?.paceSec };
  }
  if (ten) {
    return {
      thresholdSec: ten.paceSec * 1.04,
      source: `previsione dai tuoi allenamenti (10 km in ${formatRaceTime(ten.timeSec)}, affidabilità ${ten.confidence})`,
      fiveKPaceSec: five?.paceSec,
    };
  }
  if (test) return { thresholdSec: test.value, source: `test del ${fmtDay(test.date)} (non recente: rifallo appena puoi)`, fiveKPaceSec: five?.paceSec };
  return null;
}

/** Metri percorsi in una ripetuta a tempo, ai due estremi del passo: "≈ 640–670 m". */
function repDistance(min: number, t: number, [fast, slow]: readonly [number, number]): string {
  const m = (pace: number) => Math.round(((min * 60) / pace) * 100) * 10; // km -> metri, arrotondati a 10
  return `≈ ${m(r5(t * slow))}–${m(r5(t * fast))} m`;
}

function withTarget(s: WorkoutStep, value: string): WorkoutStep {
  return { ...s, target: { value, origin: "stimato" } };
}

/** Seduta di corsa con i passi su ogni fase. Le altre sedute restano invariate. */
export function withRunPaces<T extends PlannedWorkout>(w: T, ref: PaceReference | null): T {
  if (w.sport !== "run" || !ref) return w;
  const t = ref.thresholdSec;
  const main = w.structure.main.map((s) => {
    if (w.type === "progressivo") {
      return withTarget(s, `da ${paceText(r5(t * 1.25))} a ${paceText(r5(t * 1.02))} /km: un terzo a ${paceText(r5(t * 1.25))}, uno a ${paceText(r5(t * 1.12))}, l'ultimo a ${paceText(r5(t * 1.02))}`);
    }
    if (w.type === "test_corsa") {
      const p = ref.fiveKPaceSec ?? t / 1.04 / 1.03;
      return withTarget(s, `parti a ${paceText(r5(p + 5))} /km, poi tieni o aumenta se stai bene`);
    }
    const zone = MAIN_ZONE[w.type];
    if (!zone) return s;
    const z = ZONES[zone];
    const reps = s.repeat && s.durationMin && (zone === "ripetute" || zone === "soglia") ? ` (${repDistance(s.durationMin, t, z)} ogni ${zone === "ripetute" ? "ripetuta" : "blocco"})` : "";
    return withTarget(s, `${paceRange(t, z)}${reps}`);
  });
  const hasReps = w.structure.main.some((s) => (s.repeat ?? 1) > 1);
  return {
    ...w,
    paceSource: ref.source,
    structure: {
      ...w.structure,
      warmup: w.structure.warmup.map((s) => withTarget(s, paceRange(t, ZONES.riscaldamento))),
      main,
      ...(hasReps && { recoveryTarget: { value: paceRange(t, ZONES.recuperoTraProve), origin: "stimato" as const } }),
      cooldown: w.structure.cooldown.map((s) => withTarget(s, paceRange(t, ZONES.defaticamento))),
    },
  };
}
