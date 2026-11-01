/** Date come stringhe YYYY-MM-DD, calcolate a mezzogiorno UTC per evitare sorprese con l'ora legale. */

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseISODate(s: string): Date {
  return new Date(`${s}T12:00:00Z`);
}

export function todayISO(now = new Date()): string {
  return toISODate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12)));
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

/** Lunedì della settimana che contiene la data. */
export function mondayOf(iso: string): string {
  const d = parseISODate(iso);
  const shift = (d.getUTCDay() + 6) % 7;
  return addDays(iso, -shift);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseISODate(toIso).getTime() - parseISODate(fromIso).getTime()) / 864e5);
}

const WEEKDAYS = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
const WEEKDAYS_SHORT = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const MONTHS_SHORT = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];

export function weekdayName(iso: string, short = false): string {
  const i = parseISODate(iso).getUTCDay();
  return short ? WEEKDAYS_SHORT[i] : WEEKDAYS[i];
}

export function formatDayMonth(iso: string, short = true): string {
  const d = parseISODate(iso);
  return `${d.getUTCDate()} ${(short ? MONTHS_SHORT : MONTHS)[d.getUTCMonth()]}`;
}

export function monthTitle(iso: string): string {
  const d = parseISODate(iso);
  const m = MONTHS[d.getUTCMonth()];
  return `${m.charAt(0).toUpperCase()}${m.slice(1)} ${d.getUTCFullYear()}`;
}
