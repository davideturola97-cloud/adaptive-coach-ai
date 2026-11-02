/**
 * Motore di programmazione deterministico. Nessuna AI: stesse informazioni -> stesso programma.
 *
 * Passi, settimana per settimana:
 * 1. fase (base, costruzione, rifinitura, scarico, gara, recupero) in base alla prossima gara A o B,
 *    con una settimana di scarico ogni quattro;
 * 2. minuti totali della settimana, entro le ore disponibili e senza salti di carico;
 * 3. ripartizione tra gli sport in base alla gara obiettivo (corsa, bici, nuoto, triathlon);
 * 4. ruoli delle sedute (lungo, qualità, facile, palestra) e loro posizione nei giorni disponibili,
 *    mai due sedute dure in giorni consecutivi, lunghi nei giorni scelti dall'atleta;
 * 5. intensità in RPE, con ritmi o watt stimati solo se esistono parametri da test.
 */
import { addDays, daysBetween, formatDayMonth, mondayOf, weekdayName } from "@/lib/dates";
import { SPORTS } from "@/lib/domain/sports";
import type { AthleteProfile, PlannedTest, PlannedWorkout, RaceEvent, Sport, TestKind, WorkoutType } from "@/lib/domain/types";
import { template } from "@/lib/training/templates";
import { applyTargets } from "./targets";

export type Phase = "base" | "costruzione" | "rifinitura" | "scarico" | "gara" | "recupero";

export const PHASE_LABEL: Record<Phase, string> = {
  base: "Base",
  costruzione: "Costruzione",
  rifinitura: "Rifinitura",
  scarico: "Scarico",
  gara: "Settimana di gara",
  recupero: "Recupero",
};

export type DraftWorkout = Omit<PlannedWorkout, "id" | "status" | "completedActivityId">;

export interface PlanWeek {
  weekStart: string;
  phase: Phase;
  targetMin: number;
  plannedMin: number;
  focus: string;
  race?: RaceEvent;
  bySport: Partial<Record<Sport, number>>;
}

export interface PlanDraft {
  startDate: string;
  endDate: string;
  weeks: PlanWeek[];
  workouts: DraftWorkout[];
  warnings: string[];
}

export interface PlanInput {
  today: string;
  athlete: AthleteProfile;
  events: RaceEvent[];
  tests?: PlannedTest[];
  /** Primo giorno del programma (di default domani). */
  startDate?: string;
  /** Numero di settimane da generare (default 12, massimo 20). */
  weeks?: number;
}

const ALL_DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const ENDURANCE: Sport[] = ["swim", "bike", "run"];
const HARD_TYPES = new Set<WorkoutType>([
  "ripetute", "tempo_run", "progressivo", "test_corsa", "lungo",
  "tempo_bici", "sweet_spot", "soglia", "vo2max", "test_ftp", "brick",
  "css_nuoto", "ripetute_nuoto", "test_css",
]);
/** Sedute di durata variabile e loro durata di riferimento nei modelli (scala 1). */
const BASE_MIN: Partial<Record<WorkoutType, number>> = {
  corsa_facile: 45, lungo: 90, progressivo: 50, endurance: 75, sweet_spot: 90, tecnica_nuoto: 45, aerobico_nuoto: 50, brick: 90,
};
const TYPICAL_MIN: Record<Sport, number> = { run: 50, bike: 80, swim: 45, gym: 40 };
const TEST_TYPE: Record<TestKind, WorkoutType | null> = {
  "5km": "test_corsa", cooper: "test_corsa", recente_corsa: null, ftp20: "test_ftp", ramp: "test_ftp", ftp_nota: null, css: "test_css", recente_nuoto: null,
};

export const isHard = (t: WorkoutType) => HARD_TYPES.has(t);

/* ---------- 1. Fasi ---------- */

function raceFocus(e: RaceEvent | undefined): "run" | "bike" | "swim" | "tri" | "generale" {
  if (!e) return "generale";
  if (e.kind === "triathlon") return "tri";
  return (e.sport as "run" | "bike" | "swim") ?? "generale";
}

function phaseFor(weekStart: string, events: RaceEvent[]): { phase: Phase; target?: RaceEvent; raceThisWeek?: RaceEvent } {
  const weekEnd = addDays(weekStart, 6);
  const key = events.filter((e) => e.priority !== "C").sort((a, b) => a.date.localeCompare(b.date) || a.priority.localeCompare(b.priority));
  const thisWeek = key.find((e) => e.date >= weekStart && e.date <= weekEnd);
  if (thisWeek) return { phase: "gara", target: thisWeek, raceThisWeek: thisWeek };
  const prevA = key.find((e) => e.priority === "A" && e.date < weekStart && daysBetween(e.date, weekStart) <= 7);
  const next = key.find((e) => e.date > weekEnd);
  if (prevA) return { phase: "recupero", target: next };
  if (!next) return { phase: "base" };
  const w = Math.round(daysBetween(weekStart, mondayOf(next.date)) / 7);
  if (next.priority === "A" && w === 1) return { phase: "scarico", target: next };
  if (next.priority === "A" && w <= 3) return { phase: "rifinitura", target: next };
  if (w <= 8) return { phase: "costruzione", target: next };
  return { phase: "base", target: next };
}

/* ---------- 3. Ripartizione tra gli sport ---------- */

function sportShares(focus: ReturnType<typeof raceFocus>, practiced: Sport[], longTri: boolean): Partial<Record<Sport, number>> {
  const raw: Record<string, Partial<Record<Sport, number>>> = {
    run: { run: 0.65, bike: 0.22, swim: 0.13 },
    bike: { bike: 0.68, run: 0.18, swim: 0.14 },
    swim: { swim: 0.6, bike: 0.22, run: 0.18 },
    tri: longTri ? { swim: 0.18, bike: 0.5, run: 0.32 } : { swim: 0.22, bike: 0.42, run: 0.36 },
    generale: { swim: 1, bike: 1, run: 1 },
  };
  const base = raw[focus];
  const used = ENDURANCE.filter((s) => practiced.includes(s));
  const total = used.reduce((t, s) => t + (base[s] ?? 0), 0) || 1;
  return Object.fromEntries(used.map((s) => [s, (base[s] ?? 0) / total]));
}

/* ---------- 4. Ruoli delle sedute ---------- */

type Role = "lungo" | "qualita" | "facile" | "palestra" | "attivazione" | "test";

interface Slot {
  sport: Sport;
  role: Role;
  type: WorkoutType;
  minutes: number;
  priority: number; // più basso = più importante
}

function qualityType(sport: Sport, phase: Phase, weekIndex: number, conservative: boolean): WorkoutType {
  const alt = weekIndex % 2 === 0;
  if (sport === "run") {
    if (conservative || phase === "base" || phase === "scarico" || phase === "gara") return "progressivo";
    if (phase === "rifinitura") return "tempo_run";
    return alt ? "ripetute" : "tempo_run";
  }
  if (sport === "bike") {
    if (conservative || phase === "base" || phase === "scarico" || phase === "gara") return "tempo_bici";
    if (phase === "rifinitura") return alt ? "soglia" : "vo2max";
    return alt ? "sweet_spot" : "soglia";
  }
  if (sport === "swim") {
    if (conservative || phase === "scarico" || phase === "gara") return "aerobico_nuoto";
    if (phase === "rifinitura") return "ripetute_nuoto";
    return alt || phase === "base" ? "css_nuoto" : "ripetute_nuoto";
  }
  return "core_mobilita";
}

export function easyType(sport: Sport, phase: Phase, n: number): WorkoutType {
  const recovery = phase === "recupero" || phase === "gara";
  if (sport === "run") return recovery ? "recupero_corsa" : "corsa_facile";
  if (sport === "bike") return recovery ? "recupero_bici" : "endurance";
  if (sport === "swim") return recovery ? "recupero_nuoto" : n % 2 === 0 ? "tecnica_nuoto" : "aerobico_nuoto";
  return "core_mobilita";
}

function gymTypes(phase: Phase, level: string): WorkoutType[] {
  if (phase === "base") return level === "principiante" ? ["forza_generale"] : ["forza_generale", "core_mobilita"];
  if (phase === "costruzione") return ["forza_specifica", "prevenzione"].slice(0, level === "principiante" ? 1 : 2) as WorkoutType[];
  if (phase === "rifinitura") return ["prevenzione"];
  if (phase === "recupero") return ["core_mobilita"];
  return [];
}

function hardBudget(phase: Phase, beginner: boolean): number {
  switch (phase) {
    case "base": return beginner ? 1 : 2;
    case "costruzione": return beginner ? 2 : 3;
    case "rifinitura": return 2;
    case "scarico": return 1;
    case "gara": return 1;
    case "recupero": return 0;
  }
}

/** Crea la seduta dal modello, dimensionando quelle di durata variabile. */
export function sized(type: WorkoutType, minutes: number): DraftWorkout {
  const base = BASE_MIN[type];
  const t = template(type, base ? Math.max(0.4, minutes / base) : 1);
  if (base) {
    const parts = [...t.structure.warmup, ...t.structure.main, ...t.structure.cooldown];
    t.durationMin = parts.reduce((s, p) => s + (p.durationMin ?? 0) * (p.repeat ?? 1), 0);
  }
  return { ...t, date: "" };
}

/* ---------- Generazione ---------- */

export function generatePlan(input: PlanInput): PlanDraft {
  const { athlete: a, today } = input;
  const startDate = input.startDate ?? addDays(today, 1);
  const nWeeks = Math.min(20, Math.max(1, input.weeks ?? 12));
  const events = input.events.filter((e) => e.date >= addDays(startDate, -14));
  const warnings: string[] = [];

  const practiced = a.sports.map((s) => s.sport);
  const levelOf = (s: Sport) => a.sports.find((x) => x.sport === s)?.level ?? "principiante";
  const available = a.availableDays.length ? a.availableDays : ["Mar", "Gio", "Sab", "Dom"];
  if (!a.availableDays.length) warnings.push("Non hai indicato i giorni disponibili: uso martedì, giovedì, sabato e domenica.");
  const longDays = (a.longDays.length ? a.longDays : ["Sab", "Dom"]).filter((d) => available.includes(d));
  const availMin = (a.weeklyHoursAvailable ?? available.length) * 60;
  const maxSession = a.maxSessionMin ?? 90;
  const maxLong = Math.max(a.longSessionMaxMin ?? maxSession, maxSession);
  const endurance = ENDURANCE.filter((s) => practiced.includes(s));
  const beginnerOverall = endurance.every((s) => levelOf(s) === "principiante");
  const levelFrac = beginnerOverall ? 0.7 : endurance.some((s) => levelOf(s) === "avanzato") ? 0.88 : 0.8;
  const hasParams: Record<Sport, boolean> = { run: Boolean(a.thresholdPaceSecPerKm), bike: Boolean(a.ftpW), swim: Boolean(a.cssPaceSecPer100m), gym: true };

  const weeks: PlanWeek[] = [];
  const workouts: DraftWorkout[] = [];
  let loadCount = 0;
  let prevLoadTarget = 0;
  const prevLong: Partial<Record<Sport, number>> = {};
  /** Giorni con seduta dura in tutto il programma: il lunedì guarda anche la domenica prima. */
  const allHard = new Set<string>();
  /** Settimane in cui uno sport non ha trovato nessun giorno: diventa un solo avviso per sport. */
  const missing = new Map<Sport, string[]>();

  if (!endurance.length && !practiced.includes("gym")) {
    return { startDate, endDate: startDate, weeks, workouts, warnings: ["Scegli almeno uno sport nel profilo."] };
  }

  for (let w = 0; w < nWeeks; w++) {
    const weekStart = addDays(mondayOf(startDate), 7 * w);
    const ph = phaseFor(weekStart, events);
    const { target, raceThisWeek } = ph;
    let phase = ph.phase;

    // Una settimana di scarico ogni quattro nei periodi di carico.
    if (phase === "base" || phase === "costruzione") {
      loadCount += 1;
      if (loadCount === 4) {
        phase = "scarico";
        loadCount = 0;
      }
    } else {
      loadCount = 0;
    }

    // 2. Minuti della settimana
    const phaseMult: Record<Phase, number> = { base: 0.85, costruzione: 1, rifinitura: 0.9, scarico: 0.65, gara: 0.5, recupero: 0.5 };
    const cycle = phase === "base" || phase === "costruzione" ? [0.9, 0.95, 1][Math.max(0, loadCount - 1)] ?? 1 : 1;
    let targetMin = availMin * levelFrac * phaseMult[phase] * cycle;
    const isLoad = phase === "base" || phase === "costruzione" || phase === "rifinitura";
    // Niente salti di carico: al massimo +15% rispetto all'ultima settimana di carico.
    if (isLoad && prevLoadTarget > 0) targetMin = Math.min(targetMin, prevLoadTarget * 1.15);
    if (w === 0 && isLoad) targetMin *= 0.9; // prima settimana prudente
    targetMin = Math.round(Math.min(targetMin, availMin) / 5) * 5;
    if (isLoad) prevLoadTarget = targetMin;

    // 3. Ripartizione
    const focus = raceFocus(target);
    const longTri = target?.kind === "triathlon" && (target.triFormat === "medio" || target.triFormat === "lungo");
    const shares = sportShares(focus, practiced, Boolean(longTri));
    const gymList = practiced.includes("gym") ? gymTypes(phase, levelOf("gym")) : [];
    const gymMin = gymList.length * 40;
    const endMin = Math.max(0, targetMin - gymMin);
    const sportMin: Partial<Record<Sport, number>> = Object.fromEntries(endurance.map((s) => [s, endMin * (shares[s] ?? 0)]));

    // Giorni utilizzabili della settimana
    const days = ALL_DAYS.map((_, i) => addDays(weekStart, i)).filter((d) => d >= startDate);
    const isAvail = (d: string) => available.includes(weekdayName(d, true));
    const blocked = new Set<string>();
    let activationDay: string | undefined;
    if (raceThisWeek) {
      blocked.add(raceThisWeek.date);
      activationDay = addDays(raceThisWeek.date, -1);
      blocked.add(addDays(raceThisWeek.date, 1));
      if (raceThisWeek.priority === "A") blocked.add(addDays(raceThisWeek.date, 2));
    }
    const prevRace = events.find((e) => e.priority !== "C" && e.date < weekStart && daysBetween(e.date, weekStart) <= 2);
    if (prevRace) for (let i = 1; i <= 2; i++) blocked.add(addDays(prevRace.date, i));
    const usable = days.filter((d) => isAvail(d) && !blocked.has(d));
    const sportOk = (s: Sport, d: string) => !a.sportDays[s]?.length || a.sportDays[s]!.includes(weekdayName(d, true));

    // 4. Ruoli
    const slots: Slot[] = [];
    const hardLeft = { n: hardBudget(phase, beginnerOverall) };
    const focusOrder = [...endurance].sort((x, y) => (shares[y] ?? 0) - (shares[x] ?? 0));
    const triBuild = focus === "tri" && (phase === "costruzione" || phase === "rifinitura") && practiced.includes("bike") && practiced.includes("run");

    for (const s of focusOrder) {
      const minutes = sportMin[s] ?? 0;
      if (minutes < 25) continue;
      let count = Math.max(1, Math.round(minutes / TYPICAL_MIN[s]));
      if (phase === "gara" || phase === "recupero") count = Math.min(count, 2);
      const sportSlots: Slot[] = [];
      const longAllowed = (s === "run" || s === "bike") && count >= 2 && phase !== "gara" && phase !== "recupero";
      if (longAllowed) {
        let type: WorkoutType = s === "run" ? "lungo" : "endurance";
        if (s === "bike" && triBuild) type = "brick";
        let longMin = Math.min(maxLong, minutes * (s === "run" ? 0.38 : 0.45));
        if (prevLong[s]) longMin = Math.min(longMin, prevLong[s]! + 15);
        if (phase === "scarico") longMin *= 0.75;
        prevLong[s] = Math.max(prevLong[s] ?? 0, longMin);
        sportSlots.push({ sport: s, role: "lungo", type, minutes: longMin, priority: 1 });
      }
      const conservative = !hasParams[s] && levelOf(s) === "principiante" && w < 3;
      if (hardLeft.n > 0 && (count >= 2 || s === "swim" || phase === "gara")) {
        sportSlots.push({ sport: s, role: "qualita", type: qualityType(s, phase, w, conservative), minutes: 55, priority: 2 });
        hardLeft.n -= 1;
      }
      const fixed = sportSlots.reduce((t, x) => t + x.minutes, 0);
      const nEasy = Math.max(0, count - sportSlots.length);
      const easyMin = nEasy ? Math.min(maxSession, Math.max(30, (minutes - fixed) / nEasy)) : 0;
      for (let i = 0; i < nEasy; i++) sportSlots.push({ sport: s, role: "facile", type: easyType(s, phase, i), minutes: easyMin, priority: 3 + i });
      slots.push(...sportSlots);
    }
    gymList.forEach((t, i) => slots.push({ sport: "gym", role: "palestra", type: t, minutes: 40, priority: 4 + i }));

    // Test programmati in questa settimana: prendono il posto di una seduta di quello sport.
    const weekTests = (input.tests ?? []).filter((t) => t.status === "programmato" && t.dueDate && t.dueDate >= weekStart && t.dueDate <= addDays(weekStart, 6) && t.dueDate >= startDate);

    // Tante sedute di resistenza quanti giorni disponibili: se sono troppe, si uniscono le facili
    // (stesso sport, una seduta più lunga) invece di lasciarne fuori qualcuna.
    const testsHere = weekTests.filter((t) => TEST_TYPE[t.kind] && usable.includes(t.dueDate!));
    const replacedQ = testsHere.filter((t) => slots.some((x) => x.sport === t.sport && x.role === "qualita")).length;
    const reserved = testsHere.length + (activationDay && usable.includes(activationDay) ? 1 : 0);
    const need = () => slots.filter((x) => x.sport !== "gym").length - replacedQ + reserved;
    while (need() > usable.length) {
      const easyBySport = endurance
        .map((sp) => ({ sp, easy: slots.filter((x) => x.sport === sp && x.role === "facile") }))
        .filter((e) => e.easy.length > 0)
        .sort((x, y) => y.easy.length - x.easy.length || (shares[x.sp] ?? 0) - (shares[y.sp] ?? 0));
      const pick = easyBySport[0];
      if (pick) {
        const removed = pick.easy[pick.easy.length - 1];
        slots.splice(slots.indexOf(removed), 1);
        const keep = pick.easy.length > 1 ? pick.easy[0] : slots.find((x) => x.sport === pick.sp && x.role === "lungo");
        if (keep) keep.minutes = Math.min(keep.role === "lungo" ? maxLong : maxSession, keep.minutes + removed.minutes);
        continue;
      }
      // Niente più sedute facili da unire: si toglie la seduta di qualità dello sport meno importante.
      const q = slots.filter((x) => x.role === "qualita").sort((x, y) => (shares[x.sport] ?? 0) - (shares[y.sport] ?? 0))[0];
      if (!q) break;
      slots.splice(slots.indexOf(q), 1);
    }

    // 5. Posizionamento
    const placed: { date: string; slot: Slot }[] = [];
    const hardDays = new Set<string>();
    const used = new Map<string, number>(); // sedute di resistenza per giorno
    const take = (date: string, slot: Slot) => {
      placed.push({ date, slot });
      if (slot.sport !== "gym") used.set(date, (used.get(date) ?? 0) + 1);
      if (isHard(slot.type) || slot.role === "test") {
        hardDays.add(date);
        allHard.add(date);
      }
    };
    const nearHard = (d: string) => [addDays(d, -1), d, addDays(d, 1)].some((x) => allHard.has(x));

    for (const t of weekTests) {
      const type = TEST_TYPE[t.kind];
      if (!type || !usable.includes(t.dueDate!)) continue;
      take(t.dueDate!, { sport: t.sport, role: "test", type, minutes: 50, priority: 0 });
      const replaced = slots.findIndex((x) => x.sport === t.sport && x.role === "qualita");
      if (replaced >= 0) slots.splice(replaced, 1);
    }
    if (activationDay && usable.includes(activationDay) && raceThisWeek) {
      // Attivazione nello sport della gara (o corsa), se quel giorno è tra i giorni preferiti dello sport.
      const pref: Sport[] = [raceThisWeek.sport, "run", ...endurance].filter((x): x is Sport => Boolean(x) && practiced.includes(x as Sport));
      const s = pref.find((x) => sportOk(x, activationDay));
      if (s) take(activationDay, { sport: s, role: "attivazione", type: easyType(s, "gara", 0), minutes: 25, priority: 0 });
    }

    // Lunghi: bici/combinato nel primo giorno dei lunghi, corsa nell'ultimo.
    // Due lunghi nel weekend (sabato bici, domenica corsa) sono la norma; non però accanto a un test.
    const longs = slots.filter((x) => x.role === "lungo").sort((x, y) => (x.sport === "run" ? 1 : 0) - (y.sport === "run" ? 1 : 0));
    const testDays = placed.filter((p) => p.slot.role === "test").map((p) => p.date);
    const freeLongDays = usable.filter((d) => longDays.includes(weekdayName(d, true)));
    for (const l of longs) {
      const ok = (d: string) => !used.has(d) && sportOk(l.sport, d) && !testDays.some((t) => Math.abs(daysBetween(t, d)) <= 1);
      const day = (l.sport === "run" ? [...freeLongDays].reverse() : freeLongDays).find(ok);
      if (day) {
        take(day, l);
        continue;
      }
      // Nessun giorno dei lunghi libero: diventa una seduta facile. Si avvisa solo se lo sport poteva usare i giorni dei lunghi.
      if (freeLongDays.some((d) => sportOk(l.sport, d))) warnings.push(`Settimana del ${formatDayMonth(weekStart, false)}: nessun giorno dei lunghi libero per ${SPORTS[l.sport].label.toLowerCase()}, la seduta lunga diventa facile.`);
      slots.push({ ...l, role: "facile", type: easyType(l.sport, phase, 0), minutes: Math.min(l.minutes, maxSession), priority: 5 });
    }

    // Sedute di qualità: il più lontano possibile dalle altre sedute dure, mai in giorni consecutivi.
    // Gli sport con meno giorni possibili (es. piscina aperta solo due giorni) scelgono per primi.
    const constrained = (sp: Sport) => usable.filter((d) => sportOk(sp, d)).length;
    for (const q of slots.filter((x) => x.role === "qualita").sort((x, y) => constrained(x.sport) - constrained(y.sport))) {
      const candidates = usable.filter((d) => !used.has(d) && !nearHard(d) && sportOk(q.sport, d) && !(raceThisWeek && d > raceThisWeek.date));
      const score = (d: string) => Math.min(...[...allHard].map((h) => Math.abs(daysBetween(h, d))), 9);
      const day = candidates.sort((x, y) => score(y) - score(x) || x.localeCompare(y))[0];
      if (day) take(day, q);
      else slots.push({ ...q, role: "facile", type: easyType(q.sport, phase, 1), minutes: 45, priority: 6 });
    }

    // Sedute facili: un giorno libero ciascuna, alternando gli sport.
    const easy = slots.filter((x) => x.role === "facile").sort((x, y) => constrained(x.sport) - constrained(y.sport) || x.priority - y.priority);
    const dropped: Slot[] = [];
    for (const e of easy) {
      const free = usable.find((d) => !used.has(d) && sportOk(e.sport, d));
      if (free) {
        take(free, e);
        continue;
      }
      // Nessun giorno libero: la seduta si unisce a una seduta facile o lunga dello stesso sport, che si allunga.
      const host = placed
        .filter((p) => p.slot.sport === e.sport && (p.slot.role === "facile" || p.slot.role === "lungo"))
        .map((p) => ({ p, cap: p.slot.role === "lungo" ? maxLong : maxSession }))
        .filter(({ p, cap }) => p.slot.minutes < cap)
        .sort((x, y) => x.p.slot.minutes - y.p.slot.minutes)[0];
      if (host) {
        host.p.slot.minutes = Math.min(host.cap, host.p.slot.minutes + e.minutes);
        continue;
      }
      // Ultima possibilità: doppia seduta in un giorno con una sola seduta, preferendo quelli senza sedute dure.
      const double = usable
        .filter((d) => sportOk(e.sport, d) && (used.get(d) ?? 0) === 1 && !placed.some((p) => p.date === d && p.slot.sport === e.sport))
        .sort((x, y) => Number(hardDays.has(x)) - Number(hardDays.has(y)))[0];
      if (double) take(double, e);
      else dropped.push(e);
    }

    // Palestra: in un giorno senza seduta dura il giorno dopo; se serve, insieme a una seduta facile.
    for (const g of slots.filter((x) => x.role === "palestra")) {
      const free = usable.filter((d) => !placed.some((p) => p.date === d && p.slot.sport === "gym"));
      const day =
        free.find((d) => !used.has(d) && !hardDays.has(addDays(d, 1)) && sportOk("gym", d)) ??
        free.find((d) => !hardDays.has(d) && !hardDays.has(addDays(d, 1)) && sportOk("gym", d)) ??
        free.find((d) => !hardDays.has(d) && sportOk("gym", d)) ??
        free.find((d) => sportOk("gym", d));
      if (day) take(day, g);
      else dropped.push(g);
    }
    // Si avvisa solo se uno sport resta senza nessuna seduta nella settimana: altrimenti la seduta in più
    // si perde in silenzio (i giorni scelti non bastano, ma lo sport è comunque allenato).
    const unplaced = dropped.filter((d) => !placed.some((p) => p.slot.sport === d.sport));
    dropped.length = 0;
    dropped.push(...unplaced);
    // Nelle settimane di gara o recupero, e nella prima settimana parziale, è normale saltare uno sport.
    const partialFirst = w === 0 && startDate !== weekStart;
    if (phase !== "gara" && phase !== "recupero" && !partialFirst) {
      for (const d of dropped) missing.set(d.sport, [...(missing.get(d.sport) ?? []), weekStart]);
    }

    // Creazione delle sedute
    const created: { w: DraftWorkout; slot: Slot }[] = [];
    for (const { date, slot } of placed.sort((x, y) => x.date.localeCompare(y.date))) {
      const minutes = Math.min(slot.role === "lungo" ? maxLong : maxSession, Math.max(20, slot.minutes));
      const wkt = sized(slot.type, minutes);
      wkt.date = date;
      if (slot.role === "attivazione") {
        wkt.title = "Attivazione pre-gara";
        wkt.objective = "Sciogliere le gambe e arrivare fresco alla gara.";
        wkt.structure = { ...wkt.structure, main: [{ label: `${SPORTS[wkt.sport].label} molto facile con 3-4 accelerazioni di 20″`, durationMin: 15, rpe: [2, 3] }] };
        wkt.durationMin = 25;
      }
      created.push({ w: wkt, slot });
    }

    // Tetto della settimana: prima si accorciano le sedute facili, poi si tolgono le meno importanti.
    const cap = Math.min(availMin, Math.round(targetMin * 1.1));
    const total = () => created.reduce((t, c) => t + c.w.durationMin, 0);
    while (total() > cap) {
      const shortenable = created
        .filter((c) => c.slot.role === "facile" && BASE_MIN[c.w.type] && c.w.durationMin > 35)
        .sort((x, y) => y.w.durationMin - x.w.durationMin)[0];
      if (shortenable) {
        const resized = sized(shortenable.w.type, shortenable.w.durationMin - 10);
        resized.date = shortenable.w.date;
        shortenable.w = resized;
        continue;
      }
      const removable = created
        .map((c, i) => ({ c, i }))
        .filter(({ c }) => c.slot.role === "facile" || c.slot.role === "palestra")
        .sort((x, y) => y.c.slot.priority - x.c.slot.priority)[0];
      if (!removable) break;
      created.splice(removable.i, 1);
    }

    let plannedMin = 0;
    const bySport: Partial<Record<Sport, number>> = {};
    for (const { w: wkt } of created) {
      applyTargets(wkt, a);
      workouts.push(wkt);
      plannedMin += wkt.durationMin;
      bySport[wkt.sport] = (bySport[wkt.sport] ?? 0) + wkt.durationMin;
    }

    weeks.push({
      weekStart,
      phase,
      targetMin,
      plannedMin,
      focus: target ? `${target.name}` : "Forma generale",
      race: raceThisWeek,
      bySport,
    });
  }

  for (const [sp, ws] of missing) {
    const label = SPORTS[sp].label;
    warnings.push(
      `${label}: in ${ws.length === 1 ? "una settimana" : `${ws.length} settimane`} (dal ${formatDayMonth(ws[0], false)}) non c'è un giorno libero. ` +
        `Controlla i giorni preferiti di ${label.toLowerCase()} o aggiungi un giorno disponibile.`,
    );
  }

  const endDate = addDays(mondayOf(startDate), 7 * nWeeks - 1);
  return { startDate, endDate, weeks, workouts, warnings: [...new Set(warnings)] };
}
