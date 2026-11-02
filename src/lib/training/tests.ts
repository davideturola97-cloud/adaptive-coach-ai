import { addDays, parseISODate, weekdayName } from "@/lib/dates";
import type { AthleteSport, Level, RaceEvent, Sport, TestKind, ValueOrigin } from "@/lib/domain/types";
import {
  cooperVo2max,
  cssFrom400200,
  cssFromRecentSwim,
  formatPace,
  formatSwimPace,
  formatTime,
  ftpFrom20Min,
  ftpFromRamp,
  powerZones,
  thresholdPaceFromCooper,
  thresholdPaceFromRun,
} from "./formulas";

/** Valori inseriti dall'atleta per un test. I tempi sono in secondi, le distanze in metri. */
export type TestInput =
  | { kind: "5km"; timeSec: number }
  | { kind: "cooper"; meters: number }
  | { kind: "recente_corsa"; distanceM: number; timeSec: number }
  | { kind: "ftp20"; avgPowerW: number }
  | { kind: "ramp"; best1MinW: number }
  | { kind: "ftp_nota"; ftpW: number }
  | { kind: "css"; t400Sec: number; t200Sec: number }
  | { kind: "recente_nuoto"; distanceM: number; timeSec: number };

export interface TestInfo {
  sport: Sport;
  label: string;
  maximal: boolean;
  durationMin: number;
  summary: string;
  instructions: string[];
}

export const TEST_CATALOG: Record<TestKind, TestInfo> = {
  "5km": {
    sport: "run", label: "Test dei 5 km", maximal: true, durationMin: 50,
    summary: "5 km al massimo ritmo che riesci a tenere, su percorso piatto.",
    instructions: ["Riscaldamento 15' facili + 3 allunghi.", "5 km a ritmo regolare e sostenuto: parti un po' prudente.", "Defaticamento 10'. Registra il tempo finale."],
  },
  cooper: {
    sport: "run", label: "Test di Cooper (12 minuti)", maximal: true, durationMin: 35,
    summary: "La distanza massima che percorri in 12 minuti.",
    instructions: ["Riscaldamento 15' facili.", "12 minuti alla massima distanza possibile, ritmo regolare. Meglio su pista.", "Defaticamento 10'. Registra i metri percorsi."],
  },
  recente_corsa: {
    sport: "run", label: "Risultato recente", maximal: false, durationMin: 0,
    summary: "Una gara o un test a tutta degli ultimi 2 mesi, da 3 km alla maratona.",
    instructions: ["Inserisci distanza e tempo di una prova fatta al massimo, non di un allenamento."],
  },
  ftp20: {
    sport: "bike", label: "Test FTP 20 minuti", maximal: true, durationMin: 60,
    summary: "20 minuti alla massima potenza costante. Serve un misuratore di potenza o un rullo smart.",
    instructions: ["Riscaldamento 20' con 2-3 brevi accelerazioni.", "20' alla massima potenza che riesci a tenere costante.", "Defaticamento 15'. Registra la potenza media dei 20'."],
  },
  ramp: {
    sport: "bike", label: "Ramp test", maximal: true, durationMin: 30,
    summary: "Potenza che sale ogni minuto fino allo sfinimento. Più breve e semplice da dosare.",
    instructions: ["Su rullo smart o app: la potenza sale ogni minuto.", "Continua finché non riesci più a tenere la potenza richiesta.", "Registra la miglior potenza media di 1 minuto."],
  },
  ftp_nota: {
    sport: "bike", label: "FTP già conosciuta", maximal: false, durationMin: 0,
    summary: "Se conosci la tua FTP da un test degli ultimi 2 mesi.",
    instructions: ["Inserisci il valore in watt."],
  },
  css: {
    sport: "swim", label: "Test CSS (400 + 200 m)", maximal: true, durationMin: 50,
    summary: "400 m e 200 m a tutta: da qui si ricava il ritmo di soglia in acqua.",
    instructions: ["Riscaldamento 300-400 m con qualche esercizio tecnico.", "400 m a tutta con partenza in acqua.", "5-10' di nuotata facile.", "200 m a tutta. Registra i due tempi."],
  },
  recente_nuoto: {
    sport: "swim", label: "Risultato recente", maximal: false, durationMin: 0,
    summary: "Una prova a tutta recente, da 200 a 3800 m (per esempio 1500 m in vasca).",
    instructions: ["Inserisci distanza e tempo di una prova fatta al massimo."],
  },
};

export const TESTS_BY_SPORT: Partial<Record<Sport, TestKind[]>> = {
  run: ["5km", "cooper", "recente_corsa"],
  bike: ["ftp20", "ramp", "ftp_nota"],
  swim: ["css", "recente_nuoto"],
};

export interface Proposal {
  sport: Sport;
  kind: TestKind;
  reason: string;
}

/**
 * Test iniziale consigliato per ogni sport, in base al livello.
 * I principianti ricevono il test più breve e facile da dosare; la palestra non ha test.
 * Chi non riesce a nuotare 400 m di fila non riceve il CSS: si parte a sensazione (RPE).
 */
export function proposeInitialTests(sports: AthleteSport[], opts: { canSwim400?: boolean } = {}): Proposal[] {
  const out: Proposal[] = [];
  for (const s of sports) {
    const beginner = s.level === "principiante";
    if (s.sport === "run") {
      out.push(beginner
        ? { sport: "run", kind: "cooper", reason: "12 minuti sono più facili da dosare di un 5 km per chi inizia." }
        : { sport: "run", kind: "5km", reason: "Il 5 km dà ritmi affidabili per tutte le andature." });
    }
    if (s.sport === "bike") {
      out.push(beginner
        ? { sport: "bike", kind: "ramp", reason: "Il ramp test è breve e non richiede di saper gestire lo sforzo per 20 minuti." }
        : { sport: "bike", kind: "ftp20", reason: "Il test di 20 minuti stima bene la FTP di chi sa dosare lo sforzo." });
    }
    if (s.sport === "swim" && opts.canSwim400 !== false) {
      out.push({ sport: "swim", kind: "css", reason: "Il test CSS dà il ritmo di soglia in acqua, usato per tutte le serie." });
    }
  }
  return out;
}

export interface Derived {
  label: string;
  value: string;
  origin: ValueOrigin;
}

/** Parametri che un test aggiorna nel profilo. */
export interface ParameterUpdate {
  thresholdPaceSec?: number;
  ftpW?: number;
  cssPaceSec?: number;
}

/** Valida i valori inseriti e calcola i parametri stimati. Lancia un errore leggibile se i valori sono implausibili. */
export function evaluateTest(input: TestInput): { raw: string; derived: Derived[]; update: ParameterUpdate } {
  switch (input.kind) {
    case "5km":
    case "recente_corsa": {
      const km = input.kind === "5km" ? 5 : input.distanceM / 1000;
      const pace = input.timeSec / km;
      if (pace < 150 || pace > 900) throw new Error("Tempo non plausibile per questa distanza");
      const thr = thresholdPaceFromRun(km, input.timeSec);
      return {
        raw: `${km.toLocaleString("it-IT")} km in ${formatTime(input.timeSec)}`,
        derived: [
          { label: "Ritmo di soglia", value: formatPace(thr), origin: "stimato" },
          { label: "Ritmo corsa facile", value: `${formatPace(thr * 1.2)} – ${formatPace(thr * 1.3)}`, origin: "stimato" },
        ],
        update: { thresholdPaceSec: Math.round(thr) },
      };
    }
    case "cooper": {
      const vo2 = cooperVo2max(input.meters);
      const thr = thresholdPaceFromCooper(input.meters);
      return {
        raw: `${input.meters} m in 12 minuti`,
        derived: [
          { label: "VO₂max", value: `${vo2.toFixed(1).replace(".", ",")} ml/kg/min`, origin: "stimato" },
          { label: "Ritmo di soglia", value: formatPace(thr), origin: "stimato" },
        ],
        update: { thresholdPaceSec: Math.round(thr) },
      };
    }
    case "ftp20":
    case "ramp":
    case "ftp_nota": {
      const watts = input.kind === "ftp20" ? input.avgPowerW : input.kind === "ramp" ? input.best1MinW : input.ftpW;
      if (watts < 50 || watts > 700) throw new Error("Potenza non plausibile");
      const ftp = input.kind === "ftp20" ? ftpFrom20Min(watts) : input.kind === "ramp" ? ftpFromRamp(watts) : Math.round(watts);
      const origin: ValueOrigin = input.kind === "ftp_nota" ? "dichiarato" : "stimato";
      const raw = input.kind === "ftp20" ? `20' a ${watts} W di media` : input.kind === "ramp" ? `Miglior minuto: ${watts} W` : `FTP dichiarata: ${watts} W`;
      return {
        raw,
        derived: [
          { label: "FTP", value: `${ftp} W`, origin },
          ...powerZones(ftp).slice(1, 4).map((z) => ({ label: `Z${z.zone} ${z.name}`, value: `${z.minW}–${z.maxW} W`, origin: "stimato" as const })),
        ],
        update: { ftpW: ftp },
      };
    }
    case "css":
    case "recente_nuoto": {
      const css = input.kind === "css" ? cssFrom400200(input.t400Sec, input.t200Sec) : cssFromRecentSwim(input.distanceM, input.timeSec);
      if (css < 55 || css > 300) throw new Error("Tempi non plausibili per il nuoto");
      const raw = input.kind === "css" ? `400 m in ${formatTime(input.t400Sec)}, 200 m in ${formatTime(input.t200Sec)}` : `${input.distanceM} m in ${formatTime(input.timeSec)}`;
      return {
        raw,
        derived: [
          { label: "Ritmo CSS (soglia)", value: formatSwimPace(css), origin: "stimato" },
          { label: "Ritmo aerobico", value: `${formatSwimPace(css + 8)} – ${formatSwimPace(css + 15)}`, origin: "stimato" },
        ],
        update: { cssPaceSec: Math.round(css) },
      };
    }
  }
}

/* ---------- Rinvii e scelta del giorno ---------- */

export function postponeDate(today: string, weeks: 1 | 2): string {
  return addDays(today, weeks * 7);
}

/** Un test rifiutato viene riproposto dopo 4 settimane. */
export function declineDate(today: string): string {
  return addDays(today, 28);
}

/**
 * Sceglie un giorno adatto per un test massimale:
 * - almeno 2 giorni da oggi, in un giorno in cui l'atleta è disponibile;
 * - non nei 7 giorni prima di una gara A o B, né nei 4 giorni dopo;
 * - entro 6 settimane, altrimenti nessuna proposta.
 */
export function pickTestDay(today: string, availableDays: string[], events: RaceEvent[], busy: string[] = []): string | null {
  const days = availableDays.length ? availableDays : ["Mar", "Mer", "Gio", "Sab", "Dom"];
  const races = events.filter((e) => e.priority !== "C").map((e) => e.date);
  for (let i = 2; i <= 42; i++) {
    const d = addDays(today, i);
    if (!days.includes(weekdayName(d, true))) continue;
    if (busy.includes(d)) continue;
    const t = parseISODate(d).getTime();
    const nearRace = races.some((r) => {
      const diff = (parseISODate(r).getTime() - t) / 864e5;
      return diff >= 0 ? diff < 7 : diff > -5;
    });
    if (!nearRace) return d;
  }
  return null;
}

/** Suggerisce un nuovo test quando l'ultimo ha più di 8 settimane. */
export function retestDue(lastTestDate: string | undefined, today: string): boolean {
  if (!lastTestDate) return true;
  return (parseISODate(today).getTime() - parseISODate(lastTestDate).getTime()) / 864e5 > 56;
}

/* ---------- Controllo prima dei test massimali ---------- */

/** Domande ispirate al questionario PAR-Q. Non sostituiscono una visita medica. */
export const READINESS_QUESTIONS = [
  { id: "cuore", text: "Un medico ti ha mai detto che hai un problema al cuore o la pressione alta?" },
  { id: "petto", text: "Hai dolore al petto a riposo, nella vita di tutti i giorni o durante lo sport?" },
  { id: "svenimenti", text: "Negli ultimi 12 mesi hai perso l'equilibrio per un capogiro o hai perso conoscenza?" },
  { id: "malattia", text: "Hai avuto febbre, influenza o COVID nelle ultime 2 settimane?" },
  { id: "dolore", text: "Hai un dolore o un infortunio che peggiora con lo sforzo?" },
  { id: "farmaci", text: "Prendi farmaci per una condizione cronica (cuore, pressione, diabete, asma)?" },
  { id: "altro", text: "C'è un altro motivo per cui non dovresti fare uno sforzo massimale?" },
] as const;

export type ReadinessAnswers = Record<(typeof READINESS_QUESTIONS)[number]["id"], boolean>;

export function evaluateReadiness(answers: Partial<ReadinessAnswers>): { flagged: boolean; reasons: string[] } {
  const reasons = READINESS_QUESTIONS.filter((q) => answers[q.id]).map((q) => q.text);
  return { flagged: reasons.length > 0, reasons };
}

export const levelLabel = (l: Level) => l.charAt(0).toUpperCase() + l.slice(1);
