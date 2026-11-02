/**
 * Riprogrammazione degli imprevisti con regole fisse. Non applica nulla: propone opzioni
 * con motivo e compromessi, che l'atleta conferma. Lo stesso motore sarà usato dalla chat AI.
 *
 * Regole di sicurezza, valide per ogni proposta:
 * - nessuna seduta nei giorni dell'imprevisto, nel giorno di una gara o il giorno prima (salvo attivazione);
 * - mai due sedute dure in giorni consecutivi;
 * - il carico non aumenta mai: si sposta, si accorcia o si toglie, non si aggiunge;
 * - le sedute facili non si recuperano a tutti i costi;
 * - con dolore o malattia si toglie l'intensità e non la si recupera dopo.
 */
import { addDays, daysBetween, formatDayMonth, mondayOf, weekdayName } from "@/lib/dates";
import { SPORTS, WORKOUT_TYPE_LABEL } from "@/lib/domain/sports";
import type { AthleteProfile, PlannedWorkout, RaceEvent, Sport, WorkoutType } from "@/lib/domain/types";
import { formatDuration } from "@/lib/training/formulas";
import { easyType, isHard, sized } from "./engine";
import { applyTargets } from "./targets";

export type DisruptionKind = "nessun_allenamento" | "poco_tempo" | "stanco" | "dolore" | "malato" | "viaggio" | "saltata";

export const DISRUPTION_LABEL: Record<DisruptionKind, string> = {
  nessun_allenamento: "Non posso allenarmi",
  poco_tempo: "Ho poco tempo",
  stanco: "Sono stanco",
  dolore: "Ho un dolore",
  malato: "Sono malato",
  viaggio: "Sono in viaggio",
  saltata: "Ho saltato una seduta",
};

export interface Disruption {
  kind: DisruptionKind;
  /** Primo giorno interessato. */
  from: string;
  /** Ultimo giorno interessato (viaggio, malattia). Default = from. */
  to?: string;
  /** Minuti disponibili (poco tempo). */
  availableMin?: number;
  /** Sport che fa male (dolore). */
  painSport?: Sport;
  painSevere?: boolean;
  /** Seduta saltata (saltata). */
  workoutId?: string;
  /** Giorno in cui l'atleta vorrebbe spostare la seduta (es. "spostala al 18"). */
  preferredDate?: string;
}

export interface Brief {
  date: string;
  sport: Sport;
  type: WorkoutType;
  title: string;
  durationMin: number;
}

/** Valori della seduta dopo la modifica: si scrivono così come sono nella tabella planned_workouts. */
export interface WorkoutPatch {
  date: string;
  sport: Sport;
  type: WorkoutType;
  title: string;
  objective: string;
  durationMin: number;
  intensity: string;
  structure: PlannedWorkout["structure"];
  technicalTips: string[];
  safetyNotes: string[];
  status: "programmato";
}

export type Change =
  | { op: "sposta" | "modifica"; id: string; before: Brief; after: Brief; patch: WorkoutPatch; note: string }
  | { op: "elimina"; id: string; before: Brief; note: string };

export interface Proposal {
  id: string;
  title: string;
  summary: string;
  changes: Change[];
  reasons: string[];
  tradeoffs: string[];
}

export interface RescheduleInput {
  today: string;
  athlete: AthleteProfile;
  plan: PlannedWorkout[];
  events: RaceEvent[];
  disruption: Disruption;
}

export interface RescheduleResult {
  /** Messaggio del coach prima delle proposte. */
  intro: string;
  proposals: Proposal[];
  /** Avvisi di salute da mostrare sempre (dolore forte, malattia). */
  care?: string;
}

/* ---------- Utilità ---------- */

const brief = (w: PlannedWorkout | WorkoutPatch): Brief => ({ date: w.date, sport: w.sport, type: w.type, title: w.title, durationMin: w.durationMin });
const dayLabel = (d: string) => `${weekdayName(d).toLowerCase()} ${formatDayMonth(d, false)}`;
const isKey = (w: { type: WorkoutType }) => isHard(w.type);
const isLong = (t: WorkoutType) => t === "lungo" || t === "brick" || t === "endurance";

function patchFrom(w: PlannedWorkout, over: Partial<WorkoutPatch> = {}): WorkoutPatch {
  return {
    date: w.date, sport: w.sport, type: w.type, title: w.title, objective: w.objective, durationMin: w.durationMin,
    intensity: w.intensity, structure: w.structure, technicalTips: w.technicalTips, safetyNotes: w.safetyNotes, status: "programmato", ...over,
  };
}

/** Nuova seduta di tipo `type` e durata `minutes`, con i ritmi stimati se esistono parametri. */
function rebuilt(type: WorkoutType, minutes: number, date: string, a: AthleteProfile): WorkoutPatch {
  const d = sized(type, minutes);
  d.date = date;
  // Il modello ha una durata minima: se supera i minuti voluti, si accorcia la parte centrale.
  if (d.durationMin > minutes) {
    const fixed = [...d.structure.warmup, ...d.structure.cooldown].reduce((t, s) => t + (s.durationMin ?? 0), 0);
    const room = Math.max(5, minutes - fixed);
    const mainTotal = d.structure.main.reduce((t, s) => t + (s.durationMin ?? 0) * (s.repeat ?? 1), 0) || 1;
    d.structure = { ...d.structure, main: d.structure.main.map((s) => ({ ...s, durationMin: Math.max(1, Math.floor(((s.durationMin ?? 0) * room) / mainTotal)) })) };
    d.durationMin = Math.min(minutes, fixed + room);
  }
  applyTargets(d, a);
  return { ...d, status: "programmato" };
}

/** Seduta accorciata. Le sedute a intervalli perdono ripetizioni, mai intensità. */
function shortened(w: PlannedWorkout, minutes: number, a: AthleteProfile): WorkoutPatch {
  if (minutes >= w.durationMin) return patchFrom(w);
  const main = w.structure.main;
  const interval = main.some((s) => (s.repeat ?? 1) > 1);
  if (interval) {
    const ratio = minutes / w.durationMin;
    const structure = {
      ...w.structure,
      main: main.map((s) => (s.repeat && s.repeat > 1 ? { ...s, repeat: Math.max(2, Math.floor(s.repeat * ratio)) } : s)),
      warmup: w.structure.warmup.map((s) => ({ ...s, durationMin: Math.min(s.durationMin ?? 10, 12) })),
    };
    const total = [...structure.warmup, ...structure.main, ...structure.cooldown].reduce((t, s) => t + (s.durationMin ?? 0) * (s.repeat ?? 1), 0);
    return patchFrom(w, { structure, durationMin: Math.min(w.durationMin, Math.round(total * 1.25)), title: `${w.title} (ridotta)` });
  }
  const p = rebuilt(w.type, minutes, w.date, a);
  return { ...p, title: p.title === w.title ? `${w.title} (ridotta)` : p.title };
}

function raceBlocked(date: string, events: RaceEvent[]): boolean {
  return events.some((e) => {
    if (e.priority === "C") return e.date === date;
    const diff = daysBetween(date, e.date);
    return diff === 0 || diff === 1 || (e.priority === "A" && (diff === -1 || diff === -2));
  });
}

/** Stato del programma dopo un insieme di modifiche, per controllare le regole. */
function applyChanges(plan: PlannedWorkout[], changes: Change[]): PlannedWorkout[] {
  const removed = new Set(changes.filter((c) => c.op === "elimina").map((c) => c.id));
  const patched = new Map(changes.flatMap((c) => (c.op === "elimina" ? [] : [[c.id, c.patch] as const])));
  return plan
    .filter((w) => !removed.has(w.id))
    .map((w) => (patched.has(w.id) ? { ...w, ...patched.get(w.id)!, status: "programmato" as const } : w));
}

const active = (plan: PlannedWorkout[]) => plan.filter((w) => w.status === "programmato");

/** Le regole di sicurezza che ogni proposta deve rispettare (usate anche dai test). */
export function violations(before: PlannedWorkout[], changes: Change[], input: RescheduleInput): string[] {
  const { disruption: d, events } = input;
  const after = active(applyChanges(before, changes));
  const blockedDays = new Set<string>();
  if (d.kind !== "poco_tempo" && d.kind !== "stanco" && d.kind !== "dolore" && d.kind !== "saltata") {
    for (let x = d.from; x <= (d.to ?? d.from); x = addDays(x, 1)) blockedDays.add(x);
  }
  const out: string[] = [];
  const touched = new Set(changes.map((c) => c.id));
  for (const w of after.filter((x) => touched.has(x.id))) {
    if (blockedDays.has(w.date)) out.push(`seduta in un giorno bloccato ${w.date}`);
    if (raceBlocked(w.date, events) && isKey(w)) out.push(`seduta dura vicino a una gara ${w.date}`);
    if (isKey(w)) {
      const near = after.filter((o) => o.id !== w.id && isKey(o) && Math.abs(daysBetween(o.date, w.date)) <= 1 && !(isLong(o.type) && isLong(w.type)));
      if (near.length) out.push(`sedute dure consecutive ${w.date}`);
    }
  }
  const minutes = (ws: PlannedWorkout[]) => ws.reduce((t, w) => t + w.durationMin, 0);
  // Il carico non sale mai: al massimo torna quello previsto (anche recuperando una seduta saltata).
  const planned = before.filter((w) => w.status === "programmato" || (d.kind === "saltata" && w.id === d.workoutId));
  if (minutes(after) > minutes(planned) + 0.5) out.push("carico aumentato");
  return out;
}

/* ---------- Ricerca di un giorno sicuro ---------- */

type DayCheck = { ok: true; displaced?: PlannedWorkout } | { ok: false; reason: string };

/**
 * Il giorno `date` va bene per la seduta `w`? Con `explicit` (giorno chiesto dall'atleta) non si guardano
 * i giorni disponibili e preferiti, perché è lui a dire che può; le regole di sicurezza restano tutte.
 */
function checkDay(w: PlannedWorkout, date: string, plan: PlannedWorkout[], input: RescheduleInput, excluded: Set<string>, explicit = false): DayCheck {
  const { athlete: a, events, today } = input;
  const days = a.availableDays.length ? a.availableDays : ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
  const pref = a.sportDays[w.sport];
  const live = active(plan).filter((o) => o.id !== w.id);
  const name = weekdayName(date, true);
  if (date <= today) return { ok: false, reason: "è già passato o è oggi" };
  if (excluded.has(date)) return { ok: false, reason: "è uno dei giorni in cui non puoi allenarti" };
  if (!explicit && (!days.includes(name) || (pref?.length && !pref.includes(name)))) return { ok: false, reason: "non è tra i tuoi giorni disponibili" };
  if (raceBlocked(date, events) && (isKey(w) || events.some((e) => e.date === date))) return { ok: false, reason: "è troppo vicino a una gara" };
  const same = live.filter((o) => o.date === date && o.sport !== "gym");
  if (same.some((o) => isKey(o))) return { ok: false, reason: `quel giorno c'è già ${same.find(isKey)!.title.toLowerCase()}, un'altra seduta impegnativa` };
  if (isKey(w)) {
    const near = live.find((o) => isKey(o) && Math.abs(daysBetween(o.date, date)) === 1 && !(isLong(o.type) && isLong(w.type)));
    if (near) return { ok: false, reason: `${daysBetween(near.date, date) > 0 ? "il giorno prima" : "il giorno dopo"} c'è ${near.title.toLowerCase()}: due sedute dure di fila aumentano il rischio di infortunio` };
  }
  if (!same.length) return { ok: true };
  // Giorno con una seduta facile: la seduta importante prende il suo posto (la facile salta).
  if (isKey(w) && same.length === 1) return { ok: true, displaced: same[0] };
  if (explicit && !isKey(w) && same.length === 1) return { ok: true, displaced: same[0] };
  return { ok: false, reason: "quel giorno è già occupato" };
}

/** Cerca il giorno sicuro più vicino all'imprevisto, prima o dopo (fino a 4 giorni dopo e 3 prima). */
function findDay(w: PlannedWorkout, plan: PlannedWorkout[], input: RescheduleInput, range: { from: string; to: string }, excluded: Set<string>): { date: string; displaced?: PlannedWorkout } | null {
  const order = [1, -1, 2, -2, 3, -3, 4].map((k) => (k > 0 ? addDays(range.to, k) : addDays(range.from, k)));
  let fallback: { date: string; displaced?: PlannedWorkout } | null = null;
  for (const date of order) {
    const c = checkDay(w, date, plan, input, excluded);
    if (!c.ok) continue;
    if (!c.displaced) return { date };
    fallback ??= { date, displaced: c.displaced };
  }
  return fallback;
}

/**
 * Sposta le sedute: importanti in un giorno sicuro (eventualmente al posto di una facile), le facili solo se c'è un giorno libero.
 * Con `swap`, la seduta facile scavalcata non salta ma si scambia: va nel giorno di partenza, entro `swap.maxMin` minuti.
 */
function moveChanges(affected: PlannedWorkout[], input: RescheduleInput, range: { from: string; to: string }, blocked: Set<string>, swap?: { date: string; maxMin: number }): { changes: Change[]; tradeoffs: string[] } {
  const changes: Change[] = [];
  const tradeoffs: string[] = [];
  const order = [...affected].sort((x, y) => Number(isKey(y)) - Number(isKey(x)));
  for (const w of order) {
    const current = applyChanges(input.plan, changes);
    const spot = findDay(w, current, input, range, blocked);
    if (!spot || (!isKey(w) && spot.displaced)) {
      changes.push({ op: "elimina", id: w.id, before: brief(w), note: isKey(w) ? "Nessun giorno sicuro nei prossimi giorni" : "Seduta facile: non serve recuperarla" });
      if (isKey(w)) tradeoffs.push(`${w.title} salta: nei giorni vicini non c'è un giorno che rispetti il recupero.`);
      continue;
    }
    // Se finisce nella settimana dopo, si accorcia un po' per non caricare troppo quella settimana.
    const nextWeek = mondayOf(spot.date) !== mondayOf(w.date);
    let patch = patchFrom(w, { date: spot.date });
    if (nextWeek && isKey(w)) {
      patch = { ...shortened(w, Math.round(w.durationMin * 0.8), input.athlete), date: spot.date };
      tradeoffs.push(`${w.title} passa alla settimana dopo, accorciata a ${formatDuration(patch.durationMin)} per non sovraccaricarla.`);
    }
    if (spot.displaced && swap && swap.maxMin >= 20) {
      const x = spot.displaced;
      const p = { ...shortened(x, Math.min(x.durationMin, swap.maxMin), input.athlete), date: swap.date };
      changes.push({ op: "sposta", id: x.id, before: brief(x), after: brief(p), patch: p, note: `Scambiata: va a ${dayLabel(swap.date)}` });
    } else if (spot.displaced) {
      changes.push({ op: "elimina", id: spot.displaced.id, before: brief(spot.displaced), note: `Lascia il posto a ${w.title}` });
      tradeoffs.push(`Salta ${spot.displaced.title.toLowerCase()} di ${dayLabel(spot.date)}, che era una seduta facile.`);
    }
    changes.push({ op: "sposta", id: w.id, before: brief(w), after: brief(patch), patch, note: `Spostata a ${dayLabel(spot.date)}` });
  }
  return { changes, tradeoffs };
}

/* ---------- Proposte per tipo di imprevisto ---------- */

function baseProposals(input: RescheduleInput): RescheduleResult {
  const { disruption: d, plan, athlete: a } = input;
  const to = d.to && d.to >= d.from ? d.to : d.from;
  const live = active(plan);
  const inRange = live.filter((w) => w.date >= d.from && w.date <= to);
  const range = d.from === to ? dayLabel(d.from) : `dal ${formatDayMonth(d.from, false)} al ${formatDayMonth(to, false)}`;
  const blocked = new Set<string>();
  for (let x = d.from; x <= to; x = addDays(x, 1)) blocked.add(x);
  const proposals: Proposal[] = [];
  const none = (msg: string): RescheduleResult => ({ intro: msg, proposals: [] });

  switch (d.kind) {
    case "nessun_allenamento":
    case "viaggio": {
      if (!inRange.length) return none(`Nessuna seduta in programma ${range}: non c'è niente da cambiare.`);
      const moved = moveChanges(inRange, input, { from: d.from, to }, blocked);
      const keyCount = inRange.filter(isKey).length;
      if (moved.changes.some((c) => c.op === "sposta")) {
        proposals.push({
          id: "sposta",
          title: "Sposto le sedute importanti",
          summary: keyCount ? "Le sedute chiave vanno in un giorno sicuro nei prossimi giorni; le facili saltano se non c'è posto." : "Le sedute vanno in un giorno libero, se c'è.",
          changes: moved.changes,
          reasons: ["Le sedute dure restano distanziate di almeno un giorno.", "Il carico della settimana non aumenta."],
          tradeoffs: moved.tradeoffs,
        });
      }
      proposals.push({
        id: "elimina",
        title: "Salto e riparto dal programma",
        summary: "Le sedute di quei giorni si tolgono. Il resto della settimana resta com'è.",
        changes: inRange.map((w) => ({ op: "elimina" as const, id: w.id, before: brief(w), note: "Tolta" })),
        reasons: ["Un giorno di riposo in più non fa perdere forma.", "È la scelta più semplice quando la settimana è già piena."],
        tradeoffs: keyCount ? [`Perdi ${keyCount === 1 ? "una seduta importante" : `${keyCount} sedute importanti`} di questa settimana.`] : [],
      });
      return { intro: `Ok, ${range} niente allenamento. Hai ${inRange.length === 1 ? "una seduta" : `${inRange.length} sedute`} in quei giorni. Ecco cosa ti propongo:`, proposals };
    }

    case "poco_tempo": {
      const avail = Math.max(0, d.availableMin ?? 30);
      const today = inRange.filter((w) => w.sport !== "gym" || inRange.length === 1);
      if (!today.length) return none(`Nessuna seduta in programma ${range}.`);
      const tooLong = today.filter((w) => w.durationMin > avail);
      if (!tooLong.length) return none(`Le sedute di ${range} stanno già nei ${avail} minuti che hai: puoi farle così come sono.`);
      if (avail >= 20) {
        proposals.push({
          id: "accorcia",
          title: `Accorcio a ${avail} minuti`,
          summary: "Stesso tipo di allenamento, più corto: le ripetute perdono qualche ripetizione, mai intensità.",
          changes: tooLong.map((w) => {
            const p = shortened(w, avail, a);
            return { op: "modifica" as const, id: w.id, before: brief(w), after: brief(p), patch: p, note: `Da ${formatDuration(w.durationMin)} a ${formatDuration(p.durationMin)}` };
          }),
          reasons: ["Una seduta breve fatta bene vale più di una saltata.", "Il riscaldamento si accorcia ma resta."],
          tradeoffs: tooLong.filter(isKey).map((w) => `${w.title} perde una parte del lavoro principale.`),
        });
      }
      const keys = tooLong.filter(isKey);
      if (keys.length) {
        const moved = moveChanges(keys, input, { from: d.from, to: d.from }, new Set(), { date: d.from, maxMin: avail });
        const swapped = moved.changes.some((c) => c.op === "sposta" && c.patch.date === d.from);
        if (moved.changes.some((c) => c.op === "sposta" && c.patch.date !== d.from)) {
          proposals.push({
            id: "sposta",
            title: swapped ? "Scambio con una seduta facile" : "Sposto la seduta importante",
            summary: swapped ? "La seduta dura va in un giorno con più tempo; la seduta facile di quel giorno la fai oggi, più corta." : "La seduta dura va in un altro giorno; oggi riposo.",
            changes: moved.changes,
            reasons: ["La seduta chiave si fa per intero in un giorno con più tempo."],
            tradeoffs: moved.tradeoffs,
          });
        }
      }
      proposals.push({
        id: "riposo",
        title: "Oggi riposo",
        summary: "Salto le sedute di oggi senza recuperarle.",
        changes: today.map((w) => ({ op: "elimina" as const, id: w.id, before: brief(w), note: "Tolta" })),
        reasons: ["Quando il tempo è poco, un giorno di riposo è una scelta legittima."],
        tradeoffs: [],
      });
      return { intro: `Hai ${avail} minuti ${range}. In programma c'è ${tooLong.map((w) => `${w.title.toLowerCase()} (${formatDuration(w.durationMin)})`).join(" e ")}. Ecco le opzioni:`, proposals };
    }

    case "stanco": {
      const day = inRange.filter((w) => w.sport !== "gym" || inRange.length === 1);
      if (!day.length) return none(`Nessuna seduta ${range}: riposa, è proprio quello che serve.`);
      proposals.push({
        id: "alleggerisci",
        title: "Alleggerisco",
        summary: "Le sedute dure diventano facili e più corte; quelle facili si accorciano.",
        changes: day.map((w) => {
          const p = isKey(w) ? rebuilt(easyType(w.sport, "base", 0), Math.max(30, Math.round(w.durationMin * 0.7)), w.date, a) : shortened(w, Math.max(25, Math.round(w.durationMin * 0.7)), a);
          return { op: "modifica" as const, id: w.id, before: brief(w), after: brief(p), patch: p, note: isKey(w) ? "Da dura a facile" : "Più corta" };
        }),
        reasons: ["Allenarsi stanchi a intensità alta aumenta il rischio e rende poco.", "Muoversi piano aiuta a recuperare."],
        tradeoffs: day.filter(isKey).map((w) => `${w.title} non si fa questa settimana.`),
      });
      const hard = day.filter(isKey);
      if (hard.length) {
        const moved = moveChanges(hard, input, { from: d.from, to: d.from }, new Set(), { date: d.from, maxMin: 40 });
        const swapped = moved.changes.some((c) => c.op === "sposta" && c.patch.date === d.from);
        if (moved.changes.some((c) => c.op === "sposta" && c.patch.date !== d.from)) {
          proposals.push({
            id: "scambia",
            title: "Rimando la seduta dura",
            summary: swapped ? "La seduta dura va in uno dei prossimi giorni; oggi fai la seduta facile di quel giorno, al massimo 40 minuti." : "La seduta dura va in uno dei prossimi giorni, quando sarai più fresco; oggi riposo.",
            changes: moved.changes,
            reasons: ["Fatta da riposati, la seduta dura rende di più."],
            tradeoffs: moved.tradeoffs,
          });
        }
      }
      proposals.push({
        id: "riposo",
        title: "Riposo completo",
        summary: "Oggi niente: domani si riparte dal programma.",
        changes: day.map((w) => ({ op: "elimina" as const, id: w.id, before: brief(w), note: "Tolta" })),
        reasons: ["Se la stanchezza è forte, il riposo è l'allenamento migliore."],
        tradeoffs: [],
      });
      return { intro: `Capito, ${range} sei stanco. Se la stanchezza dura più di qualche giorno, segnalalo nel feedback: il coach ne terrà conto.`, proposals };
    }

    case "dolore": {
      const sport = d.painSport;
      const until = addDays(d.from, 2);
      const affected = live.filter((w) => w.date >= d.from && w.date <= until && (!sport || w.sport === sport || (sport === "run" && w.type === "brick")));
      const care = d.painSevere
        ? "Con un dolore forte, o che cambia il modo in cui ti muovi, fermati e senti un medico o un fisioterapista prima di riprendere."
        : "Se il dolore non passa in qualche giorno o peggiora, senti un medico o un fisioterapista.";
      if (!affected.length) return { intro: `Nessuna seduta${sport ? ` di ${SPORTS[sport].label.toLowerCase()}` : ""} nei prossimi 3 giorni.`, proposals: [], care };
      const others = a.sports.map((s) => s.sport).filter((s): s is Sport => s !== sport && s !== "gym" && SPORTS[s].endurance);
      if (!d.painSevere) {
        proposals.push({
          id: "alleggerisci",
          title: "Tolgo l'intensità",
          summary: "Per 3 giorni solo sedute facili e più corte nello sport che fa male.",
          changes: affected.map((w) => {
            const p = isKey(w) ? rebuilt(easyType(w.sport === "bike" && w.type === "brick" ? "bike" : w.sport, "base", 0), Math.max(25, Math.round(w.durationMin * 0.6)), w.date, a) : shortened(w, Math.max(25, Math.round(w.durationMin * 0.6)), a);
            return { op: "modifica" as const, id: w.id, before: brief(w), after: brief(p), patch: p, note: "Facile e più corta" };
          }),
          reasons: ["Il movimento leggero spesso aiuta, l'intensità no.", "Fermati se il dolore aumenta durante la seduta."],
          tradeoffs: affected.filter(isKey).map((w) => `${w.title} non si recupera.`),
        });
      }
      if (others.length && sport) {
        const alt = others[0];
        proposals.push({
          id: "alternativo",
          title: `Sostituisco con ${SPORTS[alt].label.toLowerCase()}`,
          summary: `Per 3 giorni ${SPORTS[sport].label.toLowerCase()} lascia il posto a ${SPORTS[alt].label.toLowerCase()} facile, se non ti fa male.`,
          changes: affected.map((w) => {
            const p = rebuilt(easyType(alt, "base", 0), Math.max(25, Math.round(w.durationMin * 0.7)), w.date, a);
            return { op: "modifica" as const, id: w.id, before: brief(w), after: brief(p), patch: p, note: `Sostituita con ${SPORTS[alt].label.toLowerCase()}` };
          }),
          reasons: ["Mantieni il motore aerobico senza caricare la parte che fa male."],
          tradeoffs: [`Solo se ${SPORTS[alt].label.toLowerCase()} non provoca dolore: altrimenti scegli il riposo.`],
        });
      }
      proposals.push({
        id: "riposo",
        title: "Riposo per 3 giorni",
        summary: `Tolgo le sedute${sport ? ` di ${SPORTS[sport].label.toLowerCase()}` : ""} dei prossimi 3 giorni.`,
        changes: affected.map((w) => ({ op: "elimina" as const, id: w.id, before: brief(w), note: "Tolta" })),
        reasons: ["Il riposo dà tempo ai tessuti di calmarsi."],
        tradeoffs: [],
      });
      return { intro: `Mi dispiace per il dolore${sport ? ` (${SPORTS[sport].label.toLowerCase()})` : ""}. Non recupereremo le sedute dure: la priorità è che passi.`, proposals, care };
    }

    case "malato": {
      const after = live.filter((w) => w.date > to && w.date <= addDays(to, 3) && isKey(w));
      const care = "Con febbre o sintomi al petto non allenarti. Se i sintomi sono importanti o durano, senti il medico.";
      const remove = inRange.map((w) => ({ op: "elimina" as const, id: w.id, before: brief(w), note: "Tolta" }));
      const soft = (factor: number): Change[] =>
        after.map((w) => {
          const p = rebuilt(easyType(w.sport, "recupero", 0), Math.max(20, Math.round(w.durationMin * factor)), w.date, a);
          return { op: "modifica" as const, id: w.id, before: brief(w), after: brief(p), patch: p, note: "Ritorno graduale" };
        });
      proposals.push({
        id: "rientro",
        title: "Stop e rientro graduale",
        summary: "Tolgo le sedute dei giorni di malattia; nei 3 giorni dopo, solo sedute facili e corte.",
        changes: [...remove, ...soft(0.5)],
        reasons: ["Riprendere troppo forte dopo una malattia è un errore comune.", "Niente recuperi: la forma torna in fretta."],
        tradeoffs: after.length ? [`${after.length === 1 ? "Una seduta dura diventa" : `${after.length} sedute dure diventano`} facile al rientro.`] : [],
      });
      proposals.push({
        id: "elimina",
        title: "Solo stop",
        summary: "Tolgo le sedute dei giorni di malattia; dopo si riprende il programma normale.",
        changes: remove,
        reasons: ["Va bene se è stato un malessere breve e senza febbre."],
        tradeoffs: after.length ? ["Al rientro trovi subito sedute dure: ascolta le sensazioni."] : [],
      });
      if (!inRange.length && !after.length) return { intro: "Nessuna seduta da cambiare in quei giorni.", proposals: [], care };
      return { intro: `Riposati ${range}. Ecco come riorganizzo:`, proposals, care };
    }

    case "saltata": {
      const w = plan.find((x) => x.id === d.workoutId);
      if (!w) return none("Non trovo la seduta saltata.");
      if (!isKey(w)) {
        return {
          intro: `${w.title} era una seduta facile: non serve recuperarla. Si riparte dal programma.`,
          proposals: [{ id: "lascia", title: "Va bene così", summary: "Nessuna modifica.", changes: [], reasons: ["Recuperare le sedute facili aggiunge carico senza un vero vantaggio."], tradeoffs: [] }],
        };
      }
      const start = w.date < input.today ? input.today : w.date;
      const moved = moveChanges([{ ...w, status: "programmato" }], { ...input, plan: plan.map((x) => (x.id === w.id ? { ...x, status: "programmato" as const } : x)) }, { from: start, to: start }, new Set([w.date]));
      if (moved.changes.some((c) => c.op === "sposta")) {
        proposals.push({
          id: "recupera",
          title: "La recupero in un giorno sicuro",
          summary: "La seduta saltata va in uno dei prossimi giorni, senza avvicinarla ad altre sedute dure.",
          changes: moved.changes.filter((c) => !(c.op === "elimina" && c.id === w.id)),
          reasons: ["È una seduta importante e c'è un giorno che rispetta il recupero."],
          tradeoffs: moved.tradeoffs,
        });
      }
      proposals.push({ id: "lascia", title: "La lascio perdere", summary: "Nessuna modifica: si riparte dal programma.", changes: [], reasons: ["Una seduta persa non cambia la preparazione."], tradeoffs: [] });
      return { intro: `Hai saltato ${w.title.toLowerCase()} (${WORKOUT_TYPE_LABEL[w.type].toLowerCase()}).`, proposals };
    }
  }
}

/**
 * Proposte per un imprevisto. Se l'atleta chiede un giorno preciso ("spostala al 18"),
 * quella proposta viene per prima quando rispetta le regole; altrimenti il coach spiega perché no.
 */
export function proposeReschedule(input: RescheduleInput): RescheduleResult {
  const base = baseProposals(input);
  const d = input.disruption;
  const target = d.preferredDate;
  if (!target || d.kind === "dolore" || d.kind === "malato") return base;

  const to = d.to && d.to >= d.from ? d.to : d.from;
  const plan = d.kind === "saltata" ? input.plan.map((x) => (x.id === d.workoutId ? { ...x, status: "programmato" as const } : x)) : input.plan;
  const live = active(plan);
  const affected = d.kind === "saltata" ? live.filter((w) => w.id === d.workoutId) : live.filter((w) => w.date >= d.from && w.date <= to && w.sport !== "gym");
  const main = affected.find(isKey) ?? affected[0];
  if (!main) return base;

  const blocked = new Set<string>();
  if (d.kind === "nessun_allenamento" || d.kind === "viaggio") for (let x = d.from; x <= to; x = addDays(x, 1)) blocked.add(x);
  if (d.kind === "saltata") blocked.add(input.plan.find((x) => x.id === d.workoutId)?.date ?? "");
  const check = checkDay(main, target, plan, { ...input, plan }, blocked, true);
  const label = dayLabel(target);
  if (!check.ok) {
    return { ...base, intro: `Spostare ${main.title.toLowerCase()} a ${label} non è una buona idea: ${check.reason}. ${base.intro}` };
  }

  const changes: Change[] = [];
  const tradeoffs: string[] = [];
  if (check.displaced) {
    changes.push({ op: "elimina", id: check.displaced.id, before: brief(check.displaced), note: `Lascia il posto a ${main.title}` });
    tradeoffs.push(`Salta ${check.displaced.title.toLowerCase()} di ${label}.`);
  }
  let patch = patchFrom(main, { date: target });
  if (mondayOf(target) !== mondayOf(main.date) && isKey(main)) {
    patch = { ...shortened(main, Math.round(main.durationMin * 0.8), input.athlete), date: target };
    tradeoffs.push(`Cambia settimana: la accorcio a ${formatDuration(patch.durationMin)} per non sovraccaricare quella settimana.`);
  }
  changes.push({ op: "sposta", id: main.id, before: brief(main), after: brief(patch), patch, note: `Spostata a ${label}, come hai chiesto` });
  if (d.kind === "nessun_allenamento" || d.kind === "viaggio") {
    for (const w of live.filter((x) => x.date >= d.from && x.date <= to && x.id !== main.id)) {
      changes.push({ op: "elimina", id: w.id, before: brief(w), note: "Nel giorno in cui non puoi allenarti" });
    }
  }
  if (violations(input.plan, changes, input).length) {
    return { ...base, intro: `Spostare ${main.title.toLowerCase()} a ${label} non rispetta le regole di recupero. ${base.intro}` };
  }
  const preferred: Proposal = {
    id: "preferito",
    title: `Sposto a ${label}`,
    summary: `${main.title} va a ${label}, il giorno che hai scelto.`,
    changes,
    reasons: ["È il giorno che hai indicato e rispetta il recupero: nessuna seduta dura il giorno prima o dopo.", "Il carico della settimana non aumenta."],
    tradeoffs,
  };
  return { ...base, intro: `${label.charAt(0).toUpperCase()}${label.slice(1)} va bene per ${main.title.toLowerCase()}. Ecco la proposta, con le alternative:`, proposals: [preferred, ...base.proposals.filter((p) => p.id !== "preferito")] };
}
