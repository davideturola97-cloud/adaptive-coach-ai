/**
 * Cuore e passo: come risponde la frequenza cardiaca alla velocità, in questa seduta e nel tempo.
 * Regole e formule descritte in docs/FORMULE.md ("Cuore e passo"). Tutto ciò che è un confronto o una tendenza è una stima.
 *
 * - Efficienza (corsa): metri al minuto ÷ FC media = metri percorsi per battito. Più alta = più economico.
 *   Bici: con il misuratore di potenza watt ÷ FC, altrimenti km/h ÷ FC.
 * - Deriva cardiaca (decoupling, Friel): efficienza della prima metà rispetto alla seconda, sui parziali a ritmo regolare.
 *   Sotto il 5% buona resistenza aerobica; 5–10% da migliorare; oltre il 10% caldo, poca idratazione o ritmo troppo alto.
 * - FC a passo fisso: regressione lineare FC ~ velocità sui parziali al km delle corse di un periodo, letta a un passo
 *   di riferimento (il tuo passo facile). Confronto ultime 4 settimane contro le 6 precedenti: se a parità di passo il cuore
 *   batte meno, la forma aerobica sta crescendo.
 */
import { addDays } from "@/lib/dates";
import type { CompletedActivity, Split, Sport } from "@/lib/domain/types";

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const pace = (s: number) => `${Math.floor(Math.round(s) / 60)}:${String(Math.round(s) % 60).padStart(2, "0")}`;
const it = (n: number, d = 1) => n.toFixed(d).replace(".", ",");

/** Efficienza della seduta; undefined se mancano FC o distanza. */
export function efficiency(a: Pick<CompletedActivity, "sport" | "durationMin" | "distanceKm" | "avgHr" | "avgPowerW">): number | undefined {
  if (!a.avgHr || a.avgHr < 60) return undefined;
  if (a.sport === "bike" && a.avgPowerW) return a.avgPowerW / a.avgHr;
  if (!a.distanceKm || a.durationMin <= 0) return undefined;
  if (a.sport === "run") return (a.distanceKm * 1000) / a.durationMin / a.avgHr;
  if (a.sport === "bike") return a.distanceKm / (a.durationMin / 60) / a.avgHr;
  return undefined;
}
export const efficiencyLabel = (sport: Sport, withPower: boolean) =>
  sport === "run" ? "metri per battito" : withPower ? "watt per battito" : "km/h per battito";

/** Parziali completi (~1 km per la corsa) con passo e FC. */
function hrSplits(splits: Split[] | undefined, sport: Sport): Split[] {
  const s = (splits ?? []).filter((x) => x.paceSec && x.hr && x.hr >= 60);
  if (sport === "run") return s.filter((x) => x.km >= 0.9 && x.km <= 1.1);
  if (sport === "bike") {
    const max = Math.max(0, ...s.map((x) => x.km));
    return s.filter((x) => x.km >= max * 0.9);
  }
  return [];
}

/** Deriva cardiaca in percentuale (positiva = il cuore sale a parità di passo). Servono almeno 6 parziali. */
export function decoupling(splits: Split[] | undefined, sport: Sport): number | undefined {
  const s = hrSplits(splits, sport);
  if (s.length < 6) return undefined;
  const ef = (xs: Split[]) => mean(xs.map((x) => 1000 / x.paceSec!)) / mean(xs.map((x) => x.hr!));
  const h = Math.floor(s.length / 2);
  const first = ef(s.slice(0, h));
  const second = ef(s.slice(s.length - h));
  return ((first - second) / first) * 100;
}

/** Retta FC = a + b × velocità (m/s) sui punti dati; null se i punti sono pochi o la retta non ha senso. */
function fit(points: { v: number; hr: number }[]): { a: number; b: number } | null {
  if (points.length < 8) return null;
  const mv = mean(points.map((p) => p.v));
  const mh = mean(points.map((p) => p.hr));
  const sxx = points.reduce((t, p) => t + (p.v - mv) ** 2, 0);
  if (sxx < 1e-6) return null;
  const b = points.reduce((t, p) => t + (p.v - mv) * (p.hr - mh), 0) / sxx;
  if (b <= 0) return null; // più veloce dovrebbe voler dire cuore più alto
  return { a: mh - b * mv, b };
}

function points(activities: CompletedActivity[], from: string, to: string, refPace: number) {
  return activities
    .filter((a) => a.sport === "run" && a.date >= from && a.date <= to)
    .flatMap((a) => hrSplits(a.splits, "run"))
    // Solo parziali non troppo lontani dal passo di riferimento: la relazione è lineare solo in un intervallo ragionevole.
    .filter((s) => Math.abs(s.paceSec! - refPace) <= 75)
    .map((s) => ({ v: 1000 / s.paceSec!, hr: s.hr! }));
}

export interface HrAtPace {
  refPaceSec: number;
  now: number;
  before?: number;
  /** Battiti in meno (negativo = cuore più basso = meglio). */
  delta?: number;
  text: string;
}

/** FC stimata a un passo fisso: ultime 4 settimane contro le 6 precedenti. */
export function hrAtPace(activities: CompletedActivity[], today: string, refPaceSec: number): HrAtPace | null {
  const at = (from: string, to: string) => {
    const f = fit(points(activities, from, to, refPaceSec));
    return f ? f.a + f.b * (1000 / refPaceSec) : undefined;
  };
  const now = at(addDays(today, -28), today);
  if (now === undefined || now < 80 || now > 210) return null;
  const before = at(addDays(today, -70), addDays(today, -29));
  const delta = before !== undefined ? now - before : undefined;
  const p = pace(refPaceSec);
  const text =
    delta === undefined ? `A ${p} /km il tuo cuore batte circa ${Math.round(now)} bpm (stima dalle ultime 4 settimane).`
    : Math.abs(delta) < 2 ? `A ${p} /km il cuore batte circa ${Math.round(now)} bpm, come un mese fa: forma aerobica stabile.`
    : delta < 0 ? `A ${p} /km il cuore batte circa ${Math.round(now)} bpm, ${Math.round(-delta)} in meno di un mese fa: la forma aerobica sta crescendo.`
    : `A ${p} /km il cuore batte circa ${Math.round(now)} bpm, ${Math.round(delta)} in più di un mese fa: stanchezza, caldo o un periodo con meno allenamento.`;
  return { refPaceSec, now, before, delta, text };
}

/** Passo di riferimento: il passo facile dalla soglia, altrimenti la mediana dei parziali delle ultime 6 settimane. */
export function referencePace(activities: CompletedActivity[], today: string, thresholdSec?: number): number | undefined {
  if (thresholdSec) return Math.round((thresholdSec * 1.25) / 5) * 5;
  const all = activities.filter((a) => a.sport === "run" && a.date >= addDays(today, -42)).flatMap((a) => hrSplits(a.splits, "run")).map((s) => s.paceSec!).sort((a, b) => a - b);
  return all.length >= 8 ? Math.round(all[Math.floor(all.length * 0.6)] / 5) * 5 : undefined;
}

export interface SimilarRow {
  id: string;
  date: string;
  distanceKm: number;
  paceSec: number;
  avgHr?: number;
  ef?: number;
  current: boolean;
}

export interface HeartAnalysis {
  findings: string[];
  similar: SimilarRow[];
  ef?: number;
  efUnit: string;
  decouplingPct?: number;
}

/** Analisi cuore-passo di una seduta, con il confronto con le uscite simili dei 4 mesi precedenti. */
export function heartAnalysis(a: CompletedActivity, history: CompletedActivity[]): HeartAnalysis | null {
  if (a.sport !== "run" && a.sport !== "bike") return null;
  const findings: string[] = [];
  const ef = efficiency(a);
  const unit = efficiencyLabel(a.sport, Boolean(a.avgPowerW));
  const sp = (x: CompletedActivity) => (x.distanceKm ? (x.durationMin * 60) / x.distanceKm : undefined);

  // Uscite simili: stesso sport, distanza ±25%, ultimi 120 giorni.
  const similar = history
    .filter((h) => h.id !== a.id && h.sport === a.sport && h.distanceKm && a.distanceKm && h.date < a.date && h.date >= addDays(a.date, -120) && Math.abs(h.distanceKm - a.distanceKm) / a.distanceKm <= 0.25)
    .sort((x, y) => y.date.localeCompare(x.date))
    .slice(0, 8);

  if (ef !== undefined) {
    const prev = similar.map(efficiency).filter((x): x is number => x !== undefined);
    const fmt = a.sport === "run" ? it(ef, 2) : it(ef, 2);
    if (prev.length >= 3) {
      const m = mean(prev);
      const d = ((ef - m) / m) * 100;
      findings.push(
        Math.abs(d) < 2 ? `Efficienza ${fmt} ${unit}, in linea con le ultime ${prev.length} uscite simili.`
        : d > 0 ? `Efficienza ${fmt} ${unit}: ${it(d, 0)}% meglio della media delle ultime ${prev.length} uscite simili. A parità di battiti vai più forte.`
        : `Efficienza ${fmt} ${unit}: ${it(-d, 0)}% sotto la media delle ultime ${prev.length} uscite simili (stanchezza, caldo, salite o vento contano).`,
      );
    } else findings.push(`Efficienza ${fmt} ${unit}. Con qualche uscita simile in più potrò dirti se migliora.`);
  }

  // Stesso passo, cuore diverso: confronto con le uscite simili a passo vicino (±10″/km).
  const myPace = sp(a);
  if (a.sport === "run" && myPace && a.avgHr) {
    const near = similar.filter((h) => h.avgHr && sp(h) && Math.abs(sp(h)! - myPace) <= 10);
    if (near.length >= 2) {
      const d = a.avgHr - mean(near.map((h) => h.avgHr!));
      if (Math.abs(d) >= 3) findings.push(`A passo simile (${pace(myPace)} /km) il cuore è stato ${Math.round(Math.abs(d))} battiti ${d < 0 ? "più basso" : "più alto"} rispetto a ${near.length} uscite simili.`);
      else findings.push(`A passo simile (${pace(myPace)} /km) battito uguale alle ultime uscite simili.`);
    }
    const faster = similar.filter((h) => sp(h) && sp(h)! < myPace).length;
    if (similar.length >= 3) findings.push(faster === 0 ? `Il passo più veloce tra le ultime ${similar.length + 1} uscite di questa distanza.` : `${faster + 1}° passo tra le ultime ${similar.length + 1} uscite di questa distanza.`);
  }

  const dec = decoupling(a.splits, a.sport);
  if (dec !== undefined && a.durationMin >= 40) {
    findings.push(
      dec < 5 ? `Deriva cardiaca ${it(Math.max(0, dec))}%: il cuore è rimasto stabile fino alla fine, buona resistenza aerobica.`
      : dec < 10 ? `Deriva cardiaca ${it(dec)}%: nella seconda metà il cuore è salito a parità di passo. Normale nei lunghi o con il caldo; migliora con il fondo.`
      : `Deriva cardiaca ${it(dec)}%: alta. Probabilmente ritmo troppo alto per la durata, caldo o poca idratazione.`,
    );
  }

  const rows: SimilarRow[] = [a, ...similar]
    .filter((x) => x.distanceKm)
    .map((x) => ({ id: x.id, date: x.date, distanceKm: x.distanceKm!, paceSec: (x.durationMin * 60) / x.distanceKm!, avgHr: x.avgHr, ef: efficiency(x), current: x.id === a.id }))
    .sort((x, y) => y.date.localeCompare(x.date));
  if (!findings.length) return null;
  return { findings, similar: rows, ef, efUnit: unit, decouplingPct: dec };
}
