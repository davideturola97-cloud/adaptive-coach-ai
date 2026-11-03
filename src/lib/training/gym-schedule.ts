/**
 * Scheda di palestra a giorni fissi dell'atleta e consigli del coach sugli incastri con il programma.
 * Regole fisse, come le darebbe un preparatore per gli sport di resistenza:
 * - gambe pesanti mai il giorno prima di una seduta chiave di corsa o bici (ripetute, soglia, lungo, test);
 * - meglio gambe lo stesso giorno della seduta di qualità, dopo ("giorni duri duri, giorni facili facili");
 * - niente gambe pesanti nei 4 giorni prima di una gara importante;
 * - spalle e dorsali pesanti il giorno prima di una seduta di qualità in acqua: meglio leggere.
 */
import { addDays, daysBetween, weekdayName } from "@/lib/dates";
import type { AthleteProfile, GymDay, GymExercise, PlannedWorkout, RaceEvent, Sport, WorkoutType } from "@/lib/domain/types";

export const DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"] as const;

type LegLoad = "pesante" | "medio" | "leggero";
export const MUSCLE_GROUPS: { key: string; legs?: LegLoad; upper?: boolean }[] = [
  { key: "petto", upper: true },
  { key: "spalle", upper: true },
  { key: "tricipiti" },
  { key: "schiena", upper: true },
  { key: "bicipiti" },
  { key: "parte alta", upper: true },
  { key: "gambe", legs: "pesante" },
  { key: "glutei e femorali", legs: "pesante" },
  { key: "parte bassa", legs: "pesante" },
  { key: "polpacci", legs: "leggero" },
  { key: "total body", legs: "medio", upper: true },
  { key: "core" },
  { key: "mobilità" },
];

export function legLoad(day: Pick<GymDay, "groups"> & { exercises?: GymExercise[] }): LegLoad | null {
  const order: LegLoad[] = ["pesante", "medio", "leggero"];
  const loads = day.groups.map((g) => MUSCLE_GROUPS.find((m) => m.key === g)?.legs).filter((x): x is LegLoad => Boolean(x));
  // Anche senza il gruppo "gambe", due o più esercizi per le gambe (es. squat e affondi) contano come gambe pesanti.
  const legEx = (day.exercises ?? []).filter((e) => LEG_WORDS.test(e.name)).length;
  if (legEx >= 2) loads.push("pesante");
  else if (legEx === 1) loads.push("medio");
  return order.find((o) => loads.includes(o)) ?? null;
}
export const upperHeavy = (day: Pick<GymDay, "groups">) => day.groups.some((g) => MUSCLE_GROUPS.find((m) => m.key === g)?.upper);

/** Sedute chiave per le gambe: qualità, lunghi e test di corsa e bici. */
const KEY_LEGS: WorkoutType[] = ["ripetute", "tempo_run", "progressivo", "lungo", "test_corsa", "sweet_spot", "soglia", "vo2max", "tempo_bici", "test_ftp", "brick"];
const KEY_SWIM: WorkoutType[] = ["css_nuoto", "ripetute_nuoto", "test_css"];
const isKeyLegs = (w: Pick<PlannedWorkout, "type">) => KEY_LEGS.includes(w.type);

export function gymLabel(d: Pick<GymDay, "groups">): string {
  if (!d.groups.length) return "Palestra";
  const g = [...d.groups];
  const last = g.pop()!;
  return `Palestra: ${g.length ? `${g.join(", ")} e ${last}` : last}`;
}

export interface GymAdvice {
  level: "attenzione" | "consiglio" | "ok";
  date?: string;
  text: string;
}

const dayName = (d: string) => weekdayName(d).toLowerCase();

/** Giorno della settimana alternativo per le gambe: il giorno stesso della seduta di qualità o uno senza seduta chiave il giorno dopo. */
function alternativeDay(weekStartDate: string, plan: PlannedWorkout[], schedule: GymDay[], current: string): string | null {
  const dates = DAYS.map((_, i) => addDays(weekStartDate, i));
  const keyOn = (d: string) => plan.some((w) => w.date === d && isKeyLegs(w));
  const longOn = (d: string) => plan.some((w) => w.date === d && w.type === "lungo");
  const gymOn = (d: string) => schedule.some((g) => g.day === weekdayName(d, true));
  // 1. Lo stesso giorno di una seduta di qualità (non del lungo), se il giorno dopo non c'è un'altra seduta chiave.
  const sameDay = dates.find((d) => d !== current && keyOn(d) && !longOn(d) && !keyOn(addDays(d, 1)) && !gymOn(d));
  if (sameDay) return `${dayName(sameDay)} dopo ${plan.find((w) => w.date === sameDay && isKeyLegs(w))!.title.toLowerCase()}`;
  // 2. Un giorno senza seduta chiave il giorno dopo.
  const free = dates.find((d) => d !== current && !keyOn(addDays(d, 1)) && !gymOn(d) && !longOn(addDays(d, -1)));
  return free ? dayName(free) : null;
}

/**
 * Consigli sulle prossime 2 settimane: incastri tra la scheda di palestra, il programma e le gare.
 * Ogni consiglio nasce da una regola: niente frasi generiche.
 */
export function gymAdvice(
  schedule: GymDay[],
  plan: PlannedWorkout[],
  events: RaceEvent[],
  athlete: Pick<AthleteProfile, "sports">,
  today: string,
): GymAdvice[] {
  if (!schedule.length) return [];
  const out: GymAdvice[] = [];
  const upcoming = plan.filter((w) => w.date >= today && w.date <= addDays(today, 15) && w.status === "programmato");
  const races = events.filter((e) => e.priority !== "C" && e.date >= today);

  for (let i = 0; i < 14; i++) {
    const d = addDays(today, i);
    const g = schedule.find((x) => x.day === weekdayName(d, true));
    if (!g) continue;
    const legs = legLoad(g);
    const label = g.groups.join(" e ");
    const next = upcoming.filter((w) => w.date === addDays(d, 1) && isKeyLegs(w));
    const same = upcoming.filter((w) => w.date === d && isKeyLegs(w) && w.type !== "lungo");
    const prevLong = plan.find((w) => w.date === addDays(d, -1) && (w.type === "lungo" || w.type === "brick"));
    const race = races.find((e) => daysBetween(d, e.date) >= 1 && daysBetween(d, e.date) <= 4);
    const raceTomorrow = races.find((e) => daysBetween(d, e.date) === 1);

    if (race && (legs === "pesante" || legs === "medio")) {
      out.push({ level: "attenzione", date: d, text: `${weekdayName(d)}: ${label} a ${daysBetween(d, race.date)} giorni da ${race.name}. Niente gambe pesanti nei 4 giorni prima della gara: fai solo parte alta o mobilità, oppure salta.` });
      continue;
    }
    if (raceTomorrow) {
      out.push({ level: "attenzione", date: d, text: `${weekdayName(d)}: domani c'è ${raceTomorrow.name}. Salta la palestra o fai solo 15' di mobilità.` });
      continue;
    }
    if ((legs === "pesante" || legs === "medio") && next.length) {
      const alt = alternativeDay(addDays(d, -DAYS.indexOf(weekdayName(d, true) as (typeof DAYS)[number])), upcoming, schedule, d);
      out.push({
        level: "attenzione",
        date: d,
        text: `${weekdayName(d)} ${label} e ${dayName(addDays(d, 1))} ${next[0].title.toLowerCase()}: le gambe arrivano stanche alla seduta chiave.${alt ? ` Sposta le gambe a ${alt}` : " Sposta le gambe in un altro giorno"}, oppure quel giorno alleggerisci${lighterLegs(g.exercises) ? `: ${lighterLegs(g.exercises)}` : " (metà delle serie, carico −20%, niente cedimento)"}.`,
      });
      continue;
    }
    if (legs === "pesante" && same.length) {
      out.push({ level: "ok", date: d, text: `${weekdayName(d)}: ${label} lo stesso giorno di ${same[0].title.toLowerCase()}. Va bene: fai la corsa o la bici prima e la palestra dopo, meglio a distanza di qualche ora.` });
    }
    if (legs === "pesante" && prevLong) {
      out.push({ level: "consiglio", date: d, text: `${weekdayName(d)}: ${label} il giorno dopo ${prevLong.title.toLowerCase()}. Carichi moderati: le gambe stanno ancora recuperando.` });
    }
    if (upperHeavy(g)) {
      const swim = upcoming.find((w) => w.date === addDays(d, 1) && KEY_SWIM.includes(w.type));
      if (swim) out.push({ level: "consiglio", date: d, text: `${weekdayName(d)}: ${label} e ${dayName(addDays(d, 1))} ${swim.title.toLowerCase()} in acqua. Tieni leggeri spalle e dorsali, o la bracciata ne risente.` });
    }
  }

  // Consigli sulla scheda nel suo insieme.
  const heavyLegDays = schedule.filter((g) => legLoad(g) === "pesante").length;
  const practices = (s: Sport) => athlete.sports.some((x) => x.sport === s);
  if (heavyLegDays >= 2) out.push({ level: "consiglio", text: `${heavyLegDays} sedute di gambe pesanti a settimana, insieme a corsa e bici, sono tante: tienine una pesante e trasforma l'altra in richiamo leggero (polpacci, glutei, core).` });
  if (heavyLegDays === 0 && (practices("run") || practices("bike"))) out.push({ level: "consiglio", text: "Nella scheda non ci sono gambe: per corsa e bici serve almeno una seduta a settimana (squat, affondi, stacchi, polpacci). Previene gli infortuni e rende la spinta più efficiente." });
  if (!schedule.some((g) => g.groups.includes("core") || g.groups.includes("total body"))) out.push({ level: "consiglio", text: "Aggiungi 10' di core (plank, dead bug, ponte glutei) a una delle sedute: stabilità per corsa e nuoto." });
  if (schedule.length >= 4) out.push({ level: "consiglio", text: `${schedule.length} giorni di palestra più gli allenamenti di resistenza: nelle settimane di carico tieni le serie lontane dal cedimento (1–2 ripetizioni di margine) per non rubare recupero.` });

  // Senza conflitti: lo diciamo, così l'atleta sa che la scheda è stata controllata.
  if (!out.some((a) => a.level === "attenzione")) out.unshift({ level: "ok", text: "Nelle prossime 2 settimane la scheda non crea conflitti con le sedute chiave del programma." });
  return out;
}

/* ---------- Esercizi ---------- */


/** Esercizi suggeriti nel modulo (si può scrivere qualsiasi nome). */
export const EXERCISE_SUGGESTIONS = [
  "Squat", "Front squat", "Affondi", "Affondi bulgari", "Leg press", "Stacco rumeno", "Stacco da terra", "Hip thrust", "Ponte glutei",
  "Step up", "Leg extension", "Leg curl", "Calf raise", "Calf raise seduto",
  "Panca piana", "Panca inclinata", "Spinte con manubri", "Croci ai cavi", "Piegamenti", "Dip",
  "Trazioni", "Lat machine", "Rematore con bilanciere", "Rematore con manubrio", "Pulley", "Face pull",
  "Military press", "Lento avanti con manubri", "Alzate laterali", "Alzate posteriori",
  "Curl con bilanciere", "Curl con manubri", "Curl a martello", "French press", "Pushdown ai cavi", "Estensioni sopra la testa",
  "Plank", "Plank laterale", "Dead bug", "Bird dog", "Pallof press", "Crunch", "Russian twist",
];

const LEG_WORDS = /squat|affond|leg ?press|stacc|hip thrust|ponte glutei|step ?up|leg extension|leg curl|calf|polpacc|pistol|lunge|deadlift|salti|box jump|glute/i;
/** Esercizi che caricano le gambe (dal nome). */
export const isLegExercise = (e: Pick<GymExercise, "name">) => LEG_WORDS.test(e.name);

export function restText(sec?: number): string {
  if (!sec) return "";
  return sec % 60 ? `${Math.floor(sec / 60) ? `${Math.floor(sec / 60)}'` : ""}${sec % 60}″` : `${sec / 60}'`;
}
const kg = (n: number) => `${String(Math.round(n * 2) / 2).replace(".", ",")} kg`;

/** "4 × 8 · 60 kg · recupero 2'" */
export function exerciseLine(e: GymExercise): string {
  return [`${e.sets} × ${e.reps}`, e.loadKg ? kg(e.loadKg) : "", e.restSec ? `recupero ${restText(e.restSec)}` : "", e.note ?? ""].filter(Boolean).join(" · ");
}

/** Versione ridotta: meno serie (×factor, almeno 1) e carico ridotto (×loadFactor, arrotondato a 2,5 kg). */
export function reduceExercise(e: GymExercise, setFactor: number, loadFactor = 1): GymExercise {
  const sets = Math.max(1, Math.round(e.sets * setFactor));
  const loadKg = e.loadKg ? Math.round((e.loadKg * loadFactor) / 2.5) * 2.5 : undefined;
  return { ...e, sets, ...(loadKg !== undefined && { loadKg }) };
}

/** Durata stimata di un esercizio in minuti: serie × (ripetizioni × 3″ + recupero). */
export function exerciseMinutes(e: GymExercise): number {
  const reps = Number(String(e.reps).match(/\d+/)?.[0] ?? 10);
  const work = /″|"|s$|sec/.test(e.reps) ? reps : reps * 3;
  return Math.max(2, Math.round((e.sets * (work + (e.restSec ?? 90))) / 60));
}

/** Frase con le gambe alleggerite: "squat 2 × 8 a 50 kg invece di 4 × 8 a 60 kg". */
export function lighterLegs(exercises: GymExercise[] | undefined): string {
  const legs = (exercises ?? []).filter(isLegExercise).slice(0, 3);
  if (!legs.length) return "";
  return legs
    .map((e) => {
      const r = reduceExercise(e, 0.5, 0.8);
      return `${e.name.toLowerCase()} ${r.sets} × ${e.reps}${r.loadKg ? ` a ${kg(r.loadKg)}` : ""} invece di ${e.sets} × ${e.reps}${e.loadKg ? ` a ${kg(e.loadKg)}` : ""}`;
    })
    .join(", ");
}
