/**
 * Valutazione degli intertempi con regole fisse. Ogni frase nasce da un calcolo sui parziali:
 * l'AI non interpreta i numeri, li riceve già valutati.
 */
import type { AthleteProfile, PlannedWorkout, Split, Sport, WorkoutType } from "@/lib/domain/types";
import { formatPace, formatSwimPace } from "./formulas";

export function formatSplitPace(sport: Sport, paceSec: number): string {
  if (sport === "bike") return `${(3600 / paceSec).toFixed(1).replace(".", ",")} km/h`;
  if (sport === "swim") return formatSwimPace(paceSec / 10);
  return formatPace(paceSec);
}

/** "5:12", "5'12\"", "5:12 /km", "0:05:12" -> secondi. */
export function parsePace(text: string): number | null {
  const m = text.replace(/\s/g, "").match(/^(?:(\d{1,2})[:'])?(\d{1,2})[:'](\d{1,2})"?/);
  if (!m) return null;
  const [, h, mm, ss] = m;
  const sec = (h ? Number(h) * 3600 : 0) + Number(mm) * 60 + Number(ss);
  return Number(ss) < 60 && sec > 0 ? sec : null;
}

const PLAUSIBLE: Record<Sport, [number, number]> = { run: [150, 900], bike: [60, 600], swim: [600, 3000], gym: [0, 0] };
export const plausiblePace = (sport: Sport, paceSec: number) => paceSec >= PLAUSIBLE[sport][0] && paceSec <= PLAUSIBLE[sport][1];

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

export interface SplitAnalysis {
  /** Frasi brevi, già pronte da mostrare. */
  findings: string[];
  trend: "progressione" | "regolare" | "calo" | null;
  fastest?: Split;
  slowest?: Split;
  avgPaceSec?: number;
  variabilityPct?: number;
}

const EASY: WorkoutType[] = ["corsa_facile", "lungo", "recupero_corsa"];

export function analyzeSplits(splits: Split[], sport: Sport, planned?: Pick<PlannedWorkout, "type">, athlete?: Pick<AthleteProfile, "thresholdPaceSecPerKm">): SplitAnalysis {
  const full = splits.filter((s) => s.paceSec && s.km >= (sport === "swim" ? 0.09 : 0.9));
  const fmt = (p: number) => formatSplitPace(sport, p);
  const unit = sport === "swim" ? "100 m" : "km";
  const label = (s: Split) => (sport === "swim" ? `${s.n}° tratto` : `${s.n}° km`);
  if (full.length < 3) {
    return { findings: full.length ? ["Troppo pochi parziali per una valutazione."] : [], trend: null };
  }
  const paces = full.map((s) => s.paceSec!);
  const avg = mean(paces);
  const cv = (sd(paces) / avg) * 100;
  const fastest = full.reduce((a, b) => (b.paceSec! < a.paceSec! ? b : a));
  const slowest = full.reduce((a, b) => (b.paceSec! > a.paceSec! ? b : a));
  const half = Math.floor(full.length / 2);
  const first = mean(paces.slice(0, half));
  const second = mean(paces.slice(full.length - half));
  const diff = second - first;
  const findings: string[] = [];
  const isIntervals = planned?.type === "ripetute" || planned?.type === "ripetute_nuoto" || planned?.type === "vo2max";

  findings.push(`Passo medio sui parziali completi: ${fmt(avg)}. Il più veloce il ${label(fastest)} (${fmt(fastest.paceSec!)}), il più lento il ${label(slowest)} (${fmt(slowest.paceSec!)}).`);

  let trend: SplitAnalysis["trend"] = "regolare";
  if (diff <= -5) {
    trend = "progressione";
    findings.push(`Seconda metà più veloce di ${Math.round(-diff)} secondi al ${unit}: chiusura in progressione, ottima gestione.`);
  } else if (diff >= 8) {
    trend = "calo";
    findings.push(`Seconda metà più lenta di ${Math.round(diff)} secondi al ${unit}: probabilmente sei partito troppo forte o è arrivata la fatica.`);
  } else {
    findings.push("Prima e seconda metà quasi uguali: andatura regolare.");
  }

  if (!isIntervals) {
    if (cv < 2) findings.push("Ritmo molto costante da un parziale all'altro.");
    else if (cv > 5) findings.push(`Ritmo variabile (oscillazione del ${cv.toFixed(0)}%): salite, semafori o una gestione da rendere più regolare.`);
  }

  if (full.length >= 5) {
    const last2 = mean(paces.slice(-2));
    if (last2 - avg >= 10 && trend !== "progressione") findings.push(`Negli ultimi 2 ${unit === "km" ? "km" : "tratti"} sei calato di ${Math.round(last2 - avg)} secondi rispetto alla media.`);
  }

  if (isIntervals) {
    const median = [...paces].sort((a, b) => a - b)[Math.floor(paces.length / 2)];
    const fast = paces.filter((p) => p <= median - 15);
    if (fast.length >= 2) {
      const spread = Math.max(...fast) - Math.min(...fast);
      findings.push(spread <= 6 ? `Frazioni veloci uniformi (scarto massimo ${Math.round(spread)} secondi): ben dosate.` : `Frazioni veloci disuguali (scarto ${Math.round(spread)} secondi): prova a partire un po' più piano nelle prime.`);
    }
  }

  // Confronto con la seduta prevista, solo se c'è un ritmo di soglia da test (stimato).
  const thr = athlete?.thresholdPaceSecPerKm?.value;
  if (sport === "run" && thr && planned && EASY.includes(planned.type)) {
    const fastLimit = thr * (planned.type === "lungo" ? 1.15 : 1.2);
    const tooFast = full.filter((s) => s.paceSec! < fastLimit - 5);
    if (tooFast.length) findings.push(`${tooFast.length} km più veloci del previsto per una seduta facile (sotto ${formatPace(fastLimit)}, stima dal tuo test): nelle sedute facili è meglio restare tranquilli.`);
    else findings.push("Ritmo dentro l'intensità prevista per una seduta facile.");
  }
  if (sport === "run" && thr && planned?.type === "tempo_run") {
    const inRange = full.filter((s) => s.paceSec! >= thr - 5 && s.paceSec! <= thr * 1.03 + 5).length;
    findings.push(`${inRange} km su ${full.length} vicini al ritmo di soglia stimato (${formatPace(thr)}).`);
  }

  // Deriva cardiaca: battito che sale a ritmo costante.
  const withHr = full.filter((s) => s.hr);
  if (withHr.length >= 4 && Math.abs(diff) < 8) {
    const h = Math.floor(withHr.length / 2);
    const hr1 = mean(withHr.slice(0, h).map((s) => s.hr!));
    const hr2 = mean(withHr.slice(withHr.length - h).map((s) => s.hr!));
    const rise = ((hr2 - hr1) / hr1) * 100;
    if (rise >= 5) findings.push(`Il battito è salito del ${rise.toFixed(0)}% a ritmo costante (deriva cardiaca): caldo, poca idratazione o fondo ancora da costruire.`);
  }

  const partial = splits.find((s) => s.km < (sport === "swim" ? 0.09 : 0.9));
  if (partial) findings.push(`L'ultimo parziale (${partial.km.toLocaleString("it-IT")} km) è più corto e non entra nei confronti.`);

  return { findings, trend, fastest, slowest, avgPaceSec: avg, variabilityPct: cv };
}

export interface SplitTotals {
  distanceKm: number;
  /** Solo se tutti i parziali hanno il passo: altrimenti la somma sarebbe incompleta. */
  durationMin?: number;
  avgPaceSec?: number;
  /** Media pesata sul tempo di ogni parziale (o sui km, se manca il tempo). */
  avgHr?: number;
  /** true se la FC c'era solo in una parte dei parziali. */
  hrPartial: boolean;
}

/**
 * Totali ricavati dagli intertempi: distanza = somma dei parziali, durata = somma di passo × km,
 * passo medio = durata / distanza, FC media pesata sul tempo. Nessun valore stimato: se un passo manca, niente durata.
 */
export function totalsFromSplits(splits: Split[]): SplitTotals | null {
  const valid = splits.filter((s) => s.km > 0);
  if (!valid.length) return null;
  const distanceKm = Math.round(valid.reduce((a, s) => a + s.km, 0) * 100) / 100;
  const complete = valid.every((s) => s.paceSec);
  const totalSec = complete ? valid.reduce((a, s) => a + s.paceSec! * s.km, 0) : undefined;
  const withHr = valid.filter((s) => s.hr);
  let avgHr: number | undefined;
  if (withHr.length) {
    const weight = (s: Split) => (s.paceSec ? s.paceSec * s.km : s.km);
    const w = withHr.reduce((a, s) => a + weight(s), 0);
    avgHr = Math.round(withHr.reduce((a, s) => a + s.hr! * weight(s), 0) / w);
  }
  return {
    distanceKm,
    ...(totalSec !== undefined && { durationMin: Math.round((totalSec / 60) * 100) / 100, avgPaceSec: Math.round(totalSec / distanceKm) }),
    ...(avgHr !== undefined && { avgHr }),
    hrPartial: withHr.length > 0 && withHr.length < valid.length,
  };
}
