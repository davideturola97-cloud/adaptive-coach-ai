/**
 * Analisi di una seduta per ogni sport, con regole fisse: riepilogo (durata, distanza, passo o velocità,
 * FC, potenza, dislivello), confronto con la seduta prevista, con i test e con le uscite precedenti.
 * Gli intertempi hanno la loro analisi (splits.ts). Ogni valore che dipende da un test è una stima.
 */
import type { AthleteProfile, CompletedActivity, PlannedWorkout, WorkoutType } from "@/lib/domain/types";
import { formatPace, formatSwimPace, powerZones, sessionLoad } from "./formulas";

export type ActivityData = Pick<CompletedActivity, "date" | "sport" | "durationMin" | "distanceKm" | "avgHr" | "avgPowerW" | "elevationM" | "feedback"> & { id?: string };
export type PlannedData = Pick<PlannedWorkout, "sport" | "type" | "durationMin" | "structure">;
export type AthleteData = Pick<AthleteProfile, "ftpW" | "thresholdPaceSecPerKm" | "cssPaceSecPer100m" | "weightKg">;

export interface ActivityAnalysis {
  /** Titolo breve della seduta, es. "Uscita in bici di 2h 05', percorso collinare". */
  headline: string;
  findings: string[];
}

const EASY: WorkoutType[] = ["corsa_facile", "lungo", "recupero_corsa", "endurance", "recupero_bici", "aerobico_nuoto", "recupero_nuoto", "tecnica_nuoto"];
const RECOVERY: WorkoutType[] = ["recupero_corsa", "recupero_bici", "recupero_nuoto"];
const QUALITY: WorkoutType[] = ["ripetute", "tempo_run", "tempo_bici", "sweet_spot", "soglia", "vo2max", "css_nuoto", "ripetute_nuoto"];

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const dur = (m: number) => {
  const r = Math.round(m);
  return r >= 60 ? `${Math.floor(r / 60)}h ${String(r % 60).padStart(2, "0")}'` : `${r}'`;
};
const it = (n: number, d = 1) => n.toFixed(d).replace(".", ",");

/** Secondi per km (corsa), per 100 m (nuoto), km/h (bici). */
function speedOf(a: ActivityData): number | undefined {
  if (!a.distanceKm || a.distanceKm <= 0 || a.durationMin <= 0) return undefined;
  if (a.sport === "bike") return a.distanceKm / (a.durationMin / 60);
  if (a.sport === "swim") return (a.durationMin * 60) / (a.distanceKm * 10);
  if (a.sport === "run") return (a.durationMin * 60) / a.distanceKm;
  return undefined;
}

function terrain(a: ActivityData): { label: string; mPerKm: number } | undefined {
  if (!a.distanceKm || a.elevationM === undefined || a.sport === "swim" || a.sport === "gym") return undefined;
  const mPerKm = a.elevationM / a.distanceKm;
  const label = mPerKm < 5 ? "pianeggiante" : mPerKm < 10 ? "ondulato" : mPerKm < 20 ? "collinare" : "di montagna";
  return { label, mPerKm };
}

export function analyzeActivity(a: ActivityData, opts: { planned?: PlannedData; athlete?: AthleteData; history?: ActivityData[] } = {}): ActivityAnalysis {
  const { planned, athlete, history = [] } = opts;
  const findings: string[] = [];
  const speed = speedOf(a);
  const ter = terrain(a);
  const name = { run: "Corsa", bike: "Uscita in bici", swim: "Nuotata", gym: "Seduta in palestra" }[a.sport];
  const headline = `${name} di ${dur(a.durationMin)}${a.distanceKm ? (a.sport === "swim" ? `, ${Math.round(a.distanceKm * 1000)} m` : `, ${it(a.distanceKm, a.distanceKm < 10 ? 2 : 1)} km`) : ""}${ter ? `, percorso ${ter.label}` : ""}`;

  // --- Riepilogo per sport ---
  if (a.sport === "bike") {
    if (speed) findings.push(`Velocità media ${it(speed)} km/h${ter ? ` su un percorso ${ter.label} (${Math.round(a.elevationM!)} m di dislivello, ${Math.round(ter.mPerKm)} m/km): la velocità va letta insieme alla salita e al vento` : ""}.`);
    const ftp = athlete?.ftpW?.value;
    if (a.avgPowerW && ftp) {
      const pct = a.avgPowerW / ftp;
      const zone = powerZones(ftp).find((z) => z.maxW === null || a.avgPowerW! <= z.maxW)!;
      findings.push(`Potenza media ${a.avgPowerW} W = ${Math.round(pct * 100)}% della tua FTP (${ftp} W, stima dal test): zona ${zone.zone} ${zone.name}.`);
      if (planned && EASY.includes(planned.type) && pct > 0.75) findings.push("Per una seduta di endurance la media è alta: nelle uscite facili resta sotto il 75% della FTP.");
      if (planned && QUALITY.includes(planned.type)) findings.push("La media include riscaldamento e recuperi: le frazioni di lavoro sono state più intense di questo valore.");
      if (athlete?.weightKg) findings.push(`Rapporto peso/potenza medio: ${it(a.avgPowerW / athlete.weightKg, 2)} W/kg.`);
    } else if (a.avgPowerW) {
      findings.push(`Potenza media ${a.avgPowerW} W. Con un test FTP potrò dirti in che zona hai pedalato.`);
    } else {
      findings.push("Senza misuratore di potenza l'intensità si valuta con la FC e con l'RPE.");
    }
    if (a.durationMin >= 120) findings.push("Uscita lunga: oltre le 2 ore conta molto mangiare e bere con regolarità (ogni 30–45 minuti).");
  }

  if (a.sport === "run" && speed) {
    const thr = athlete?.thresholdPaceSecPerKm?.value;
    let line = `Passo medio ${formatPace(speed)}`;
    if (thr) {
      const r = speed / thr;
      const zone = r >= 1.15 ? "ritmo facile" : r >= 1.05 ? "ritmo medio" : r >= 0.97 ? "vicino alla soglia" : "sopra la soglia";
      line += `: ${zone} rispetto alla tua soglia (${formatPace(thr)}, stima dal test)`;
      if (planned && EASY.includes(planned.type) && r < (planned.type === "lungo" ? 1.12 : 1.15)) findings.push(`${line}.`, "Per una seduta facile è un po' veloce: tenere i lenti davvero lenti aiuta a recuperare per le sedute dure.");
      else findings.push(`${line}.`);
    } else findings.push(`${line}. Con un test dei 5 km potrò dirti a che intensità corrispondeva.`);
    if (ter && ter.mPerKm >= 10) findings.push(`Percorso ${ter.label} (${Math.round(a.elevationM!)} m, ${Math.round(ter.mPerKm)} m/km): il passo non è confrontabile con un'uscita in pianura.`);
  }

  if (a.sport === "swim" && speed) {
    const css = athlete?.cssPaceSecPer100m?.value;
    let line = `Passo medio ${formatSwimPace(speed)}`;
    if (css) {
      const d = speed - css;
      const zone = d <= 3 ? "al ritmo CSS o più veloce" : d <= 10 ? "ritmo aerobico sostenuto" : "ritmo aerobico facile";
      line += `, ${Math.round(Math.abs(d))} secondi ${d >= 0 ? "più lento" : "più veloce"} del tuo CSS (${formatSwimPace(css)}, stima dal test): ${zone}`;
    } else line += ". Con un test CSS potrò dirti a che intensità corrispondeva";
    findings.push(`${line}.`);
    findings.push("Il passo medio include le pause a bordo vasca se l'orologio non le esclude.");
  }

  if (a.sport === "gym") findings.push("Per la palestra conta come hai lavorato: carichi e qualità dei movimenti più del tempo totale.");

  // --- Confronto con la seduta prevista ---
  if (planned) {
    if (planned.sport !== a.sport) findings.push("Hai fatto uno sport diverso da quello previsto: va bene, il programma ne terrà conto.");
    const r = a.durationMin / planned.durationMin;
    if (r < 0.8) findings.push(`Più corta del previsto (${dur(a.durationMin)} invece di ${dur(planned.durationMin)}).`);
    else if (r > 1.2) findings.push(`Più lunga del previsto (${dur(a.durationMin)} invece di ${dur(planned.durationMin)}): non allungare troppo spesso, il carico cresce in fretta.`);
    else findings.push(`Durata in linea con il previsto (${dur(planned.durationMin)}).`);
    const target = Math.max(...planned.structure.main.map((s) => s.rpe[1]));
    const low = Math.min(...planned.structure.main.map((s) => s.rpe[0]));
    if (a.feedback && Number.isFinite(target)) {
      if (a.feedback.rpe > target + 1) findings.push(`Sforzo percepito ${a.feedback.rpe}, sopra il previsto (RPE ${low}–${target})${RECOVERY.includes(planned.type) || EASY.includes(planned.type) ? ": per una seduta facile è un segnale di stanchezza o di ritmo troppo alto" : ""}.`);
      else if (a.feedback.rpe < low - 1) findings.push(`Sforzo percepito ${a.feedback.rpe}, sotto il previsto (RPE ${low}–${target}).`);
      else findings.push(`Sforzo percepito in linea con il previsto (RPE ${low}–${target}).`);
    }
  }

  // --- Confronto con le uscite precedenti dello stesso sport ---
  const prev = history
    .filter((h) => h.sport === a.sport && h.date < a.date && (!a.id || h.id !== a.id))
    .sort((x, y) => (x.date < y.date ? 1 : -1))
    .slice(0, 6);
  const prevSpeeds = prev.map(speedOf).filter((x): x is number => x !== undefined);
  if (speed && prevSpeeds.length >= 3) {
    const m = mean(prevSpeeds);
    const unit = a.sport === "bike" ? "km/h" : a.sport === "swim" ? "s/100 m" : "s/km";
    const faster = a.sport === "bike" ? speed - m : m - speed;
    const diff = a.sport === "bike" ? it(Math.abs(faster)) : String(Math.round(Math.abs(faster)));
    const same = a.sport === "bike" ? Math.abs(faster) < 0.5 : Math.abs(faster) < 3;
    if (same) findings.push(`${a.sport === "bike" ? "Velocità" : "Passo"} simile alla media delle ultime ${prevSpeeds.length} uscite.`);
    else findings.push(`${faster > 0 ? "Più veloce" : "Più lento"} di ${diff} ${unit} rispetto alla media delle ultime ${prevSpeeds.length} uscite${ter ? " (conta anche il percorso)" : ""}.`);
  }
  const prevHr = prev.map((h) => h.avgHr).filter((x): x is number => Boolean(x));
  if (a.avgHr && prevHr.length >= 3) {
    const d = a.avgHr - mean(prevHr);
    findings.push(Math.abs(d) < 4 ? `FC media ${a.avgHr} bpm, nella norma delle tue ultime uscite.` : `FC media ${a.avgHr} bpm, ${Math.round(Math.abs(d))} battiti ${d > 0 ? "sopra" : "sotto"} la media delle ultime uscite.`);
  } else if (a.avgHr) {
    findings.push(`FC media ${a.avgHr} bpm. Con qualche uscita in più potrò confrontarla con le precedenti.`);
  }

  if (a.feedback) findings.push(`Carico della seduta: ${sessionLoad(a.durationMin, a.feedback.rpe)} (minuti × RPE).`);
  return { headline, findings };
}
