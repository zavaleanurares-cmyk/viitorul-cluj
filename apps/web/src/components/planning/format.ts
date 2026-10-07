import { EXERCISE_CATEGORIES, WEEKDAYS_SHORT_RO, formatDateShort, label, zoneLabel } from "@club/shared";

/** „Activare · Fesier, Lombar" */
export function exerciseMeta(e: { category: string; zones: string[] }, maxZones = 3): string {
  const zones = e.zones.slice(0, maxZones).map((z) => zoneLabel(z, null, true));
  if (e.zones.length > maxZones) zones.push(`+${e.zones.length - maxZones}`);
  return [label(EXERCISE_CATEGORIES, e.category), zones.join(", ")].filter(Boolean).join(" · ");
}

/** „Lu, Mi, Vi" sau textul pentru „în fiecare zi". */
export function weekdaysLabel(weekdays: number[], everyDay: string): string {
  const days = [...new Set(weekdays)].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b);
  if (days.length === 7) return everyDay;
  return days.map((d) => WEEKDAYS_SHORT_RO[d - 1]).join(", ");
}

/** „07.10 – 21.10.2026" sau „din 07.10.2026" */
export function periodLabel(start: string, end: string | null, t: (from: string, to: string | null) => string): string {
  if (!end) return t(formatDateShort(start), null);
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  return t(formatDateShort(start, !sameYear), formatDateShort(end));
}

/** Amprentă scurtă a unor date: componentele de editare se reinițializează când datele de pe server se schimbă. */
export function stamp(value: unknown): string {
  const s = JSON.stringify(value);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${s.length}.${h >>> 0}`;
}
