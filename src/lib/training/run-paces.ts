/**
 * Passi al km per ogni fase delle sedute di corsa: riscaldamento, parte centrale, recuperi, defaticamento.
 * Calcolati al momento (non salvati): seguono la forma attuale. Sono STIME, sempre marcate "stimato".
 *
 * Riferimento: il ritmo di soglia (T, secondi/km) dal test recente; se non c'è o è vecchio,
 * dalla previsione sui 10 km calcolata dagli allenamenti (T = passo 10 km × 1,04, come thresholdPaceFromRun).
 * Senza riferimento le sedute restano in RPE.
 *
 * Allenarsi per migliorare: verso una gara con un obiettivo, la soglia delle sedute future scende un po' ogni settimana,
 * dalla forma di oggi a quella che serve per l'obiettivo (raggiunta 10 giorni prima della gara), mai oltre l'obiettivo
 * "ambizioso". Le sedute a ritmo gara usano il passo dell'obiettivo. Facili e lunghi restano tranquilli.
 */
import type { AthleteProfile, CompletedActivity, PlannedWorkout, RaceEvent, WorkoutStep, WorkoutType } from "@/lib/domain/types";
import { addDays, daysBetween } from "@/lib/dates";
import { riegel } from "./formulas";
import { formatRaceTime, predictRaces, raceGoals, type PredictionReport } from "./predictions";

export interface PaceReference {
  thresholdSec: number;
  /** Frase per l'atleta: da dove vengono i passi. */
  source: string;
  /** Passo previsto sui 5 km (per il test). */
  fiveKPaceSec?: number;
  /** Gare con obiettivo verso cui far progredire i passi, in ordine di data. */
  targets?: PaceTarget[];
  /** Giorno da cui parte la progressione (oggi). */
  from?: string;
}

export interface PaceTarget {
  raceName: string;
  raceDate: string;
  raceKm: number;
  /** Tempo obiettivo della gara (secondi). */
  goalSec: number;
  goalSource: "tuo" | "possibile";
  /** Soglia da raggiungere a fine preparazione (mai più veloce dell'obiettivo "ambizioso", mai più lenta di oggi). */
  goalThresholdSec: number;
  /** Zona di passo che corrisponde al ritmo gara. */
  zone?: "mezza" | "dieci" | "maratona";
  /** Il tuo obiettivo è più veloce dell'"ambizioso". */
  ambitious?: boolean;
  /** Il tuo obiettivo è più lento del "possibile": la progressione punta comunque al "possibile". */
  easyGoal?: boolean;
  possibleSec?: number;
}

/** Soglia equivalente a un tempo di gara: tempo sui 10 km (Riegel) ÷ 10 × 1,04. */
const thresholdFromRace = (sec: number, km: number) => (riegel(sec, km, 10) / 10) * 1.04;

/** Obiettivi delle prossime gare di corsa: il tuo, se l'hai scritto, altrimenti il "possibile". */
export function paceTargets(events: RaceEvent[], report: PredictionReport, today: string, nowT: number): PaceTarget[] {
  return events
    .filter((e) => e.date > today && e.kind === "singolo" && e.sport === "run" && e.distanceKm && e.priority !== "C")
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((e) => {
      const km = e.distanceKm!;
      const p = report.predictions.find((x) => Math.abs(x.km - km) < 0.6);
      const g = p ? raceGoals(p, Math.ceil(daysBetween(today, e.date) / 7)) : undefined;
      const goalSec = e.goalTimeSec ?? g?.possibile;
      if (!goalSec) return [];
      // Con una previsione: la soglia migliora nella stessa proporzione in cui l'obiettivo è più veloce della previsione
      // (così previsione e obiettivo usano la stessa misura). Senza previsione: dalla formula di Riegel.
      // Anche con un obiettivo facile si migliora: la progressione punta al più veloce tra il tuo obiettivo e il "possibile".
      const progressSec = g ? Math.min(goalSec, g.possibile) : goalSec;
      let goalT = p ? nowT * (progressSec / p.timeSec) : thresholdFromRace(progressSec, km);
      if (p && g) goalT = Math.max(goalT, nowT * (g.ambizioso / p.timeSec)); // non oltre l'ambizioso
      goalT = Math.min(goalT, nowT); // mai più lento di oggi
      const zone = Math.abs(km - 21.1) < 0.6 ? "mezza" : Math.abs(km - 42.2) < 0.6 ? "maratona" : Math.abs(km - 10) < 0.6 ? "dieci" : undefined;
      return [{ raceName: e.name, raceDate: e.date, raceKm: km, goalSec, goalSource: e.goalTimeSec ? "tuo" : "possibile", goalThresholdSec: goalT, zone, ambitious: Boolean(e.goalTimeSec && g && e.goalTimeSec < g.ambizioso), easyGoal: Boolean(e.goalTimeSec && g && e.goalTimeSec > g.possibile), possibleSec: g?.possibile } as PaceTarget];
    });
}

/** Soglia per una seduta in una certa data: dalla forma di oggi verso quella dell'obiettivo, raggiunta 10 giorni prima della gara. */
export function thresholdOn(ref: PaceReference, date: string): { t: number; target?: PaceTarget } {
  const target = ref.targets?.find((x) => x.raceDate >= date);
  if (!target || !ref.from) return { t: ref.thresholdSec };
  const end = addDays(target.raceDate, -10);
  const span = daysBetween(ref.from, end);
  const frac = span <= 0 ? 1 : Math.min(1, Math.max(0, daysBetween(ref.from, date) / span));
  return { t: ref.thresholdSec + (target.goalThresholdSec - ref.thresholdSec) * frac, target };
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
  dieci: [0.95, 0.98],
  mezza: [1.01, 1.05],
  maratona: [1.06, 1.1],
  fartlek: [0.96, 1.02],
} as const satisfies Record<string, [number, number]>;
type ZoneKey = keyof typeof ZONES;
const isZone = (z: string | undefined): z is ZoneKey => z !== undefined && z in ZONES;

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
  athlete: Pick<AthleteProfile, "thresholdPaceSecPerKm"> & Partial<Pick<AthleteProfile, "birthDate">>,
  activities: CompletedActivity[],
  plan: Pick<PlannedWorkout, "type" | "completedActivityId">[],
  today: string,
  events: RaceEvent[] = [],
): PaceReference | null {
  const report = predictRaces(activities, plan, athlete, today);
  const withTargets = (r: PaceReference): PaceReference => ({ ...r, from: today, targets: paceTargets(events, report, today, r.thresholdSec) });
  const five = report.predictions.find((p) => p.key === "5k");
  const ten = report.predictions.find((p) => p.key === "10k");
  const test = athlete.thresholdPaceSecPerKm;
  const recentTest = test && test.date >= addDays(today, -120) ? test : undefined;
  const predT = ten ? ten.paceSec * 1.04 : undefined;
  // Vince la prova più forte: un test recente e una previsione da uno sforzo duro si confrontano e si tiene la più veloce.
  // Una previsione da corse facili non scavalca mai un test recente (le corse facili non dicono quanto vai forte).
  if (recentTest && (!predT || !ten!.basedOn.hard || recentTest.value <= predT)) {
    return withTargets({ thresholdSec: recentTest.value, source: `test del ${fmtDay(recentTest.date)}`, fiveKPaceSec: five?.paceSec });
  }
  if (ten) {
    return withTargets({
      thresholdSec: ten.paceSec * 1.04,
      source: `previsione dai tuoi allenamenti (10 km in ${formatRaceTime(ten.timeSec)}, affidabilità ${ten.confidence})`,
      fiveKPaceSec: five?.paceSec,
    });
  }
  if (test) return withTargets({ thresholdSec: test.value, source: `test del ${fmtDay(test.date)} (non recente: rifallo appena puoi)`, fiveKPaceSec: five?.paceSec });
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

/** Tempo atteso di una frazione a distanza: "≈ 4:25–4:35 per ogni 1000 m". */
function repTime(km: number, t: number, [fast, slow]: readonly [number, number]): string {
  const sec = (pace: number) => paceText(r5(pace) * km);
  const what = km < 1 ? `${Math.round(km * 1000)} m` : `${String(km).replace(".", ",")} km`;
  return `≈ ${sec(t * fast)}–${sec(t * slow)} ogni ${what}`;
}

/** Seduta di corsa con i passi su ogni fase. Le altre sedute restano invariate. */
export function withRunPaces<T extends PlannedWorkout>(w: T, ref: PaceReference | null): T {
  if (w.sport !== "run" || !ref) return w;
  const { t, target } = thresholdOn(ref, w.date);
  // Ritmo gara: il passo dell'obiettivo (±3″), non la forma di oggi.
  const racePace = target ? target.goalSec / target.raceKm : undefined;
  const raceRange = (p: number) => `${paceText(Math.round(p - 3))} – ${paceText(Math.round(p + 3))} /km (ritmo obiettivo ${target!.raceName})`;
  const main = w.structure.main.map((s) => {
    if (w.type === "progressivo") {
      return withTarget(s, `da ${paceText(r5(t * 1.25))} a ${paceText(r5(t * 1.02))} /km: un terzo a ${paceText(r5(t * 1.25))}, uno a ${paceText(r5(t * 1.12))}, l'ultimo a ${paceText(r5(t * 1.02))}`);
    }
    if (w.type === "test_corsa") {
      const p = ref.fiveKPaceSec ?? t / 1.04 / 1.03;
      return withTarget(s, `parti a ${paceText(r5(p + 5))} /km, poi tieni o aumenta se stai bene`);
    }
    // La fase dice la sua zona (sedute della libreria); "rpe" = a sensazione (salite, allunghi).
    if (s.zone === "rpe") return s;
    const zone = isZone(s.zone) ? s.zone : MAIN_ZONE[w.type];
    if (!zone) return s;
    if (racePace && target?.zone === zone) {
      const hintR = s.distanceKm ? ` · ≈ ${paceText(racePace * s.distanceKm)} ogni ${s.distanceKm < 1 ? `${Math.round(s.distanceKm * 1000)} m` : `${String(s.distanceKm).replace(".", ",")} km`}` : "";
      return withTarget(s, `${raceRange(racePace)}${hintR}`);
    }
    const z = ZONES[zone];
    const fast = zone === "ripetute" || zone === "soglia" || zone === "dieci" || zone === "mezza" || zone === "fartlek";
    const hint =
      s.distanceKm && (s.repeat ?? 1) > 1 ? ` (${repTime(s.distanceKm, t, z)})`
      : s.distanceKm ? ` (${repTime(s.distanceKm, t, z)})`
      : s.repeat && s.durationMin && fast ? ` (${repDistance(s.durationMin, t, z)} ogni ${zone === "soglia" || zone === "mezza" ? "blocco" : "frazione"})`
      : "";
    return withTarget(s, `${paceRange(t, z)}${hint}`);
  });
  const hasReps = w.structure.main.some((s) => (s.repeat ?? 1) > 1 && s.zone !== "rpe") || Boolean(w.structure.recoveries && w.structure.recoveryZone);
  const recZone = w.structure.recoveryZone;
  const progress =
    target && Math.round(t) < Math.round(ref.thresholdSec)
      ? `; soglia di questa seduta ${paceText(t)} /km (oggi ${paceText(ref.thresholdSec)}, a fine preparazione ${paceText(target.goalThresholdSec)}) verso ${target.raceName} in ${formatRaceTime(target.goalSec)}${target.goalSource === "tuo" ? " (il tuo obiettivo)" : ""}`
      : target
        ? `; obiettivo ${target.raceName} in ${formatRaceTime(target.goalSec)}${target.goalSource === "tuo" ? " (il tuo)" : ""}`
        : "";
  return {
    ...w,
    paceSource: `${ref.source}${progress}${target?.easyGoal && target.possibleSec ? `. Il tuo obiettivo è alla portata: le sedute di qualità puntano comunque a migliorare, verso il "possibile" (${formatRaceTime(target.possibleSec)}); le sedute a ritmo gara restano sul tuo passo` : ""}${target?.ambitious ? ". Il tuo obiettivo è più veloce dell'\"ambizioso\": la progressione si ferma lì per sicurezza, le sedute a ritmo gara usano comunque il tuo passo" : ""}`,
    structure: {
      ...w.structure,
      warmup: w.structure.warmup.map((s) => (s.zone === "rpe" ? s : withTarget(s, paceRange(t, ZONES.riscaldamento)))),
      main,
      ...(hasReps && recZone !== "rpe" && { recoveryTarget: { value: paceRange(t, ZONES[isZone(recZone) ? recZone : "recuperoTraProve"]), origin: "stimato" as const } }),
      cooldown: w.structure.cooldown.map((s) => withTarget(s, paceRange(t, ZONES.defaticamento))),
    },
  };
}
