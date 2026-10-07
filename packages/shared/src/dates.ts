/** Lucrăm cu date calendaristice ca text AAAA-LL-ZZ, în fusul orar al clubului. */

export const WEEKDAYS_RO = ["luni", "marți", "miercuri", "joi", "vineri", "sâmbătă", "duminică"] as const;
export const WEEKDAYS_SHORT_RO = ["Lu", "Ma", "Mi", "Jo", "Vi", "Sâ", "Du"] as const;
export const MONTHS_RO = [
  "ianuarie", "februarie", "martie", "aprilie", "mai", "iunie",
  "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie",
] as const;

export function todayIn(timezone = "Europe/Bucharest", now: Date = new Date()): string {
  // en-CA dă formatul AAAA-LL-ZZ
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function hourIn(timezone = "Europe/Bucharest", now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", hour12: false }).format(now)) % 24;
}

function toUtc(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`);
}

export function addDays(iso: string, days: number): string {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function diffDays(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86400000);
}

/** 1 = luni … 7 = duminică (cum sunt stocate zilele în program_assignments.weekdays). */
export function isoWeekday(iso: string): number {
  const d = toUtc(iso).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Lunea săptămânii în care cade data. */
export function weekStart(iso: string): string {
  return addDays(iso, 1 - isoWeekday(iso));
}

export function weekDates(mondayIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(mondayIso, i));
}

export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** „7 octombrie 2026" */
export function formatDate(iso: string | null | undefined, opts: { year?: boolean; weekday?: boolean } = {}): string {
  if (!iso) return "—";
  const d = toUtc(iso);
  const base = `${d.getUTCDate()} ${MONTHS_RO[d.getUTCMonth()]}${opts.year === false ? "" : ` ${d.getUTCFullYear()}`}`;
  return opts.weekday ? `${WEEKDAYS_RO[isoWeekday(iso) - 1]}, ${base}` : base;
}

/** „07.10.2026" */
export function formatDateShort(iso: string | null | undefined, withYear = true): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return withYear ? `${d}.${m}.${y}` : `${d}.${m}`;
}

/** „07.10.2026, 14:05" în fusul clubului */
export function formatDateTime(isoTimestamp: string | null | undefined, timezone = "Europe/Bucharest"): string {
  if (!isoTimestamp) return "—";
  const d = new Date(isoTimestamp);
  const date = new Intl.DateTimeFormat("ro-RO", { timeZone: timezone, day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
  const time = new Intl.DateTimeFormat("ro-RO", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  return `${date}, ${time}`;
}

export function ageOn(birthDate: string | null | undefined, onIso: string): number | null {
  if (!birthDate) return null;
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [y, m, d] = onIso.split("-").map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age--;
  return age;
}

export function isMinor(birthDate: string | null | undefined, onIso: string): boolean | null {
  const age = ageOn(birthDate, onIso);
  return age === null ? null : age < 18;
}

/** „în 3 zile", „azi", „acum 2 zile" */
export function relativeDay(iso: string, todayIso: string): string {
  const n = diffDays(todayIso, iso);
  if (n === 0) return "azi";
  if (n === 1) return "mâine";
  if (n === -1) return "ieri";
  if (n > 1) return n < 20 ? `în ${n} zile` : `în ${n} de zile`;
  const a = -n;
  return a < 20 ? `acum ${a} zile` : `acum ${a} de zile`;
}

/** Numeral + substantiv, cu „de" după 20 (DOOM): „3 zile", „21 de zile", „1 zi". */
export function plural(n: number, one: string, few: string): string {
  const abs = Math.abs(n);
  if (abs === 1) return `${n} ${one}`;
  const last2 = abs % 100;
  if (abs === 0 || (last2 >= 1 && last2 <= 19)) return `${n} ${few}`;
  return `${n} de ${few}`;
}

/** Începutul sezonului curent: 1 iulie, dacă clubul nu a setat altă dată. */
export function seasonStart(todayIso: string, configured?: string | null): string {
  if (configured) return configured;
  const [y, m] = todayIso.split("-").map(Number);
  return `${m < 7 ? y - 1 : y}-07-01`;
}
