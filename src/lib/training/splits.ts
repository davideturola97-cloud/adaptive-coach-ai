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

// Nuoto: fino a 25:00 /100 m perché nelle app le vasche spesso includono la pausa a bordo vasca.
const PLAUSIBLE: Record<Sport, [number, number]> = { run: [150, 900], bike: [60, 600], swim: [400, 15000], gym: [0, 0] };

/** Tempo di un parziale: "53s", "3:03", "1:05:30" -> secondi. */
export function parseSplitTime(text: string): number | null {
  const t = text.trim().replace(/\s/g, "");
  const sOnly = t.match(/^(\d{1,4})(?:[.,]\d)?s$/);
  if (sOnly) return Number(sOnly[1]) || null;
  const m = t.match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.,]\d)?$/);
  if (!m || Number(m[3]) >= 60 || (m[1] && Number(m[2]) >= 60)) return null;
  const sec = (m[1] ? Number(m[1]) * 3600 : 0) + Number(m[2]) * 60 + Number(m[3]);
  return sec > 0 ? sec : null;
}
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
  // Nuoto: vasche da 25/50 m, 100 m o ripetute più lunghe; conta come completo un tratto lungo almeno il 90% della lunghezza tipica.
  const lengths = splits.map((s) => s.km).sort((a, b) => a - b);
  const typical = lengths.length ? lengths[Math.floor(lengths.length / 2)] : 1;
  const minKm = sport === "swim" ? Math.max(0.02, typical * 0.9) : sport === "bike" ? Math.max(0.9, Math.max(...splits.map((s) => s.km)) * 0.9) : 0.9;
  let full = splits.filter((s) => s.paceSec && s.km >= minKm);
  // Nuoto: le app registrano spesso la pausa a bordo vasca dentro la vasca successiva, e a volte una virata come vasca a parte.
  // Si confrontano solo le vasche nuotate: né molto più lente (pausa inclusa) né impossibilmente veloci rispetto alle tue vasche tipiche.
  const swimNotes: string[] = [];
  if (sport === "swim" && full.length >= 4) {
    const sorted = full.map((s) => s.paceSec!).sort((a, b) => a - b);
    const ref = sorted[Math.floor(sorted.length / 4)];
    const rest = full.filter((s) => s.paceSec! > ref * 1.6);
    const odd = full.filter((s) => s.paceSec! < ref * 0.6);
    full = full.filter((s) => !rest.includes(s) && !odd.includes(s));
    if (rest.length) swimNotes.push(`${rest.length} vasche includono una pausa (passo oltre ${formatSplitPace(sport, ref * 1.6)}): non entrano nei confronti.`);
    if (odd.length) swimNotes.push(`${odd.length} vasche risultano troppo veloci rispetto alle altre (${odd.map((s) => `${s.n}ª`).join(", ")}): probabile errore di rilevamento dell'orologio, le escludo.`);
  }
  const fmt = (p: number) => formatSplitPace(sport, p);
  const unit = sport === "swim" ? "100 m" : "km";
  const perUnit = sport === "swim" ? "ai 100 m" : "al km";
  const label = (s: Split) => (sport === "swim" ? (typical <= 0.05 ? `${s.n}ª vasca` : `${s.n}° tratto`) : sport === "bike" ? `${s.n}° parziale` : `${s.n}° km`);
  // In bici si ragiona in km/h: la differenza di passo diventa differenza di velocità.
  const gap = (a: number, b: number) =>
    sport === "bike" ? `${Math.abs(3600 / a - 3600 / b).toFixed(1).replace(".", ",")} km/h` : `${Math.round(Math.abs(a - b) / (sport === "swim" ? 10 : 1))} secondi ${perUnit}`;
  // Le soglie sono in secondi al km; nel nuoto 1 s ai 100 m = 10 s al km, quindi soglie più larghe (2–3 s ai 100 m).
  const T = sport === "swim" ? { prog: 20, calo: 30, last: 30, fast: 50, even: 20 } : { prog: 5, calo: 8, last: 10, fast: 15, even: 6 };
  const sec = (x: number) => Math.round(x / (sport === "swim" ? 10 : 1));
  if (full.length < 3) {
    return { findings: full.length ? [...swimNotes, "Troppo pochi parziali per una valutazione."] : swimNotes, trend: null };
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
  const findings: string[] = [...swimNotes];
  const isIntervals = planned?.type === "ripetute" || planned?.type === "ripetute_nuoto" || planned?.type === "vo2max";

  findings.push(`${sport === "bike" ? "Velocità media" : "Passo medio"} sui parziali completi: ${fmt(avg)}. Più veloce: ${label(fastest)} (${fmt(fastest.paceSec!)}); più lento: ${label(slowest)} (${fmt(slowest.paceSec!)}).`);

  let trend: SplitAnalysis["trend"] = "regolare";
  if (diff <= -T.prog) {
    trend = "progressione";
    findings.push(`Seconda metà più veloce di ${gap(first, second)}: chiusura in progressione, ottima gestione.`);
  } else if (diff >= T.calo) {
    trend = "calo";
    findings.push(`Seconda metà più lenta di ${gap(first, second)}${sport === "bike" ? ": può dipendere dal percorso (salite, vento) o dalla fatica" : sport === "swim" ? ": è arrivata la fatica o la tecnica cala quando sei stanco" : ": probabilmente sei partito troppo forte o è arrivata la fatica"}.`);
  } else {
    findings.push("Prima e seconda metà quasi uguali: andatura regolare.");
  }

  if (!isIntervals) {
    if (cv < 2) findings.push("Ritmo molto costante da un parziale all'altro.");
    else if (cv > 5) findings.push(`Ritmo variabile (oscillazione del ${cv.toFixed(0)}%): ${sport === "swim" ? "vasche da 25 e 50 m, virate o una gestione da rendere più regolare" : sport === "bike" ? "salite, vento, incroci o una gestione da rendere più regolare" : "salite, semafori o una gestione da rendere più regolare"}.`);
  }

  if (full.length >= 5) {
    const last2 = mean(paces.slice(-2));
    if (last2 - avg >= T.last && trend !== "progressione") findings.push(`Negli ultimi 2 ${sport === "bike" ? "parziali" : unit === "km" ? "km" : "tratti"} sei calato di ${gap(last2, avg)} rispetto alla media.`);
  }

  if (isIntervals) {
    const median = [...paces].sort((a, b) => a - b)[Math.floor(paces.length / 2)];
    const fast = paces.filter((p) => p <= median - T.fast);
    if (fast.length >= 2) {
      const spread = Math.max(...fast) - Math.min(...fast);
      findings.push(spread <= T.even ? `Frazioni veloci uniformi (scarto massimo ${sec(spread)} secondi): ben dosate.` : `Frazioni veloci disuguali (scarto ${sec(spread)} secondi): prova a partire un po' più piano nelle prime.`);
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

  const partial = splits.find((s) => s.km < minKm);
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
  const complete = splits.every((s) => s.paceSec && s.km > 0);
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
