/**
 * Formule di allenamento. Ogni risultato è una STIMA: va mostrato con origine "stimato".
 * Riferimenti e limiti sono descritti in docs/FORMULE.md.
 */

/** Riegel (1977): T2 = T1 × (D2 / D1)^1.06. Affidabile tra ~3 km e mezza maratona. */
export function riegel(timeSec: number, fromKm: number, toKm: number, exponent = 1.06): number {
  if (timeSec <= 0 || fromKm <= 0 || toKm <= 0) throw new Error("Valori non validi per Riegel");
  return timeSec * Math.pow(toKm / fromKm, exponent);
}

/** Cooper (1968): VO2max ≈ (metri percorsi in 12 minuti − 504,9) / 44,73 [ml/kg/min]. */
export function cooperVo2max(meters: number): number {
  if (meters < 600 || meters > 6000) throw new Error("Distanza Cooper fuori dall'intervallo plausibile");
  return (meters - 504.9) / 44.73;
}

/** FTP dal test di 20 minuti: 95% della potenza media (Allen e Coggan). */
export function ftpFrom20Min(avgPowerW: number): number {
  if (avgPowerW <= 0) throw new Error("Potenza non valida");
  return Math.round(avgPowerW * 0.95);
}

/** FTP dal ramp test: 75% della miglior potenza di 1 minuto (convenzione dei ramp test più diffusi). */
export function ftpFromRamp(best1MinW: number): number {
  if (best1MinW <= 0) throw new Error("Potenza non valida");
  return Math.round(best1MinW * 0.75);
}

export interface PowerZone {
  zone: number;
  name: string;
  minW: number;
  maxW: number | null;
}

/** Zone di potenza di Coggan in percentuale della FTP. */
export function powerZones(ftp: number): PowerZone[] {
  const z: [string, number, number | null][] = [
    ["Recupero attivo", 0, 0.55],
    ["Endurance", 0.56, 0.75],
    ["Tempo", 0.76, 0.9],
    ["Soglia", 0.91, 1.05],
    ["VO₂max", 1.06, 1.2],
    ["Anaerobico", 1.21, null],
  ];
  return z.map(([name, lo, hi], i) => ({
    zone: i + 1,
    name,
    minW: Math.round(ftp * lo),
    maxW: hi === null ? null : Math.round(ftp * hi),
  }));
}

/**
 * Ritmo di soglia stimato da una prova di corsa: tempo equivalente sui 10 km (Riegel) + 4%,
 * approssimazione del ritmo sostenibile per circa un'ora.
 */
export function thresholdPaceFromRun(distanceKm: number, timeSec: number): number {
  if (distanceKm < 1.5 || distanceKm > 43) throw new Error("Distanza fuori dall'intervallo utile (1,5–42,2 km)");
  const tenK = riegel(timeSec, distanceKm, 10);
  return (tenK / 10) * 1.04;
}

export function thresholdPaceFrom5k(timeSec: number): number {
  return thresholdPaceFromRun(5, timeSec);
}

/** Test di Cooper -> ritmo di soglia, trattando i 12 minuti come una prova sulla distanza percorsa. */
export function thresholdPaceFromCooper(meters: number): number {
  cooperVo2max(meters); // valida l'intervallo
  return thresholdPaceFromRun(meters / 1000, 12 * 60);
}

/**
 * Critical Swim Speed (Wakayoshi, 1992): velocità tra un 400 m e un 200 m a tutta.
 * Ritmo per 100 m = (T400 − T200) / 2 secondi.
 */
export function cssFrom400200(t400Sec: number, t200Sec: number): number {
  if (t200Sec <= 0 || t400Sec <= t200Sec * 1.7 || t400Sec >= t200Sec * 3) {
    throw new Error("Tempi non coerenti: il 400 m deve durare poco più del doppio del 200 m");
  }
  return (t400Sec - t200Sec) / 2;
}

/** Ritmo CSS stimato da una prova recente: tempo equivalente sui 1500 m (Riegel), diviso per 15. */
export function cssFromRecentSwim(distanceM: number, timeSec: number): number {
  if (distanceM < 200 || distanceM > 5000) throw new Error("Distanza fuori dall'intervallo utile (200–5000 m)");
  return riegel(timeSec, distanceM / 1000, 1.5) / 15;
}

export function formatSwimPace(secPer100: number): string {
  const s = Math.round(secPer100);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} /100 m`;
}

/** "mm:ss" o "h:mm:ss" -> secondi. Restituisce null se il testo non è un tempo valido. */
export function parseTime(text: string): number | null {
  const parts = text.trim().replace(/[.,]/g, ":").split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d{1,3}$/.test(p))) return null;
  const nums = parts.map(Number);
  const [h, m, s] = parts.length === 3 ? nums : [0, ...nums];
  if (m >= 60 && parts.length === 3) return null;
  if (s >= 60) return null;
  return h * 3600 + m * 60 + s;
}

/** Carico di una seduta col metodo session-RPE di Foster: minuti × RPE. */
export function sessionLoad(durationMin: number, rpe: number): number {
  if (durationMin < 0 || rpe < 0 || rpe > 10) throw new Error("Durata o RPE non validi");
  return Math.round(durationMin * rpe);
}

/**
 * Rapporto carico acuto/cronico: carico degli ultimi 7 giorni diviso la media settimanale
 * degli ultimi 28. È un indicatore grezzo: non predice gli infortuni da solo.
 */
export function acuteChronicRatio(dailyLoads: number[]): number | null {
  if (dailyLoads.length < 28) return null;
  const last28 = dailyLoads.slice(-28);
  const acute = last28.slice(-7).reduce((a, b) => a + b, 0);
  const chronicWeekly = last28.reduce((a, b) => a + b, 0) / 4;
  if (chronicWeekly === 0) return null;
  return acute / chronicWeekly;
}

export function formatDuration(totalMin: number): string {
  const m = Math.round(totalMin);
  const h = Math.floor(m / 60);
  return h ? `${h}h ${String(m % 60).padStart(2, "0")}'` : `${m}'`;
}

export function formatPace(secPerKm: number): string {
  const s = Math.round(secPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} /km`;
}

export function formatTime(totalSec: number): string {
  const s = Math.round(totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}
