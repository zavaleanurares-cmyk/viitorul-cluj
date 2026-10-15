import { addDays, dateRange, isoWeekday } from "./dates";

/** Încărcare internă: RPE × durată (sRPE, unități arbitrare). */
export function sessionLoad(rpe: number, durationMin: number): number {
  return rpe * durationMin;
}

/**
 * Raport acut:cronic (7 zile / media săptămânală pe 28 de zile).
 * Întoarce null dacă nu există suficient istoric (sub 21 de zile cu date în fereastra cronică).
 */
export function acuteChronicRatio(loadsByDate: Record<string, number>, todayIso: string): {
  acute: number; chronic: number; ratio: number | null;
} {
  const sum = (from: string, to: string) => dateRange(from, to).reduce((s, d) => s + (loadsByDate[d] ?? 0), 0);
  const acute = sum(addDays(todayIso, -6), todayIso);
  const chronicTotal = sum(addDays(todayIso, -27), todayIso);
  const chronic = chronicTotal / 4;
  const first = Object.keys(loadsByDate).sort()[0];
  const enough = !!first && first <= addDays(todayIso, -20);
  return { acute, chronic: Math.round(chronic), ratio: enough && chronic > 0 ? Math.round((acute / chronic) * 100) / 100 : null };
}

/**
 * Zona raportului acut:cronic (Gabbett): sub 0,8 sub-încărcat, 0,8–1,3 optim, 1,3–1,5 atenție, peste 1,5 risc.
 * null = istoric insuficient.
 */
export type AcwrZone = "low" | "optimal" | "caution" | "high" | "unknown";
export function acwrZone(ratio: number | null): AcwrZone {
  if (ratio === null) return "unknown";
  if (ratio < 0.8) return "low";
  if (ratio <= 1.3) return "optimal";
  if (ratio <= 1.5) return "caution";
  return "high";
}

/** Raportul acut:cronic pentru fiecare zi dintr-un interval (pentru grafice). */
export function acwrSeries(loadsByDate: Record<string, number>, from: string, to: string): Array<{ date: string; load: number; ratio: number | null }> {
  return dateRange(from, to).map((d) => {
    const visible = Object.fromEntries(Object.entries(loadsByDate).filter(([k]) => k <= d));
    return { date: d, load: loadsByDate[d] ?? 0, ratio: acuteChronicRatio(visible, d).ratio };
  });
}

export type AdherenceInput = {
  start_date: string;
  end_date: string | null;
  weekdays: number[];
  exerciseCount: number;
};

/** Zilele programate ale unei alocări într-un interval. */
export function scheduledDays(a: Pick<AdherenceInput, "start_date" | "end_date" | "weekdays">, from: string, to: string): string[] {
  const start = a.start_date > from ? a.start_date : from;
  const end = a.end_date && a.end_date < to ? a.end_date : to;
  if (start > end) return [];
  return dateRange(start, end).filter((d) => a.weekdays.includes(isoWeekday(d)));
}

export function isScheduledOn(a: Pick<AdherenceInput, "start_date" | "end_date" | "weekdays">, day: string): boolean {
  return day >= a.start_date && (!a.end_date || day <= a.end_date) && a.weekdays.includes(isoWeekday(day));
}

/** Aderență = exerciții bifate / exerciții programate, până azi inclusiv. */
export function adherence(a: AdherenceInput, doneCount: number, from: string, to: string): {
  expected: number; done: number; percent: number | null; days: number;
} {
  const days = scheduledDays(a, from, to).length;
  const expected = days * a.exerciseCount;
  return { expected, done: doneCount, days, percent: expected ? Math.min(100, Math.round((doneCount / expected) * 100)) : null };
}

export function average(values: Array<number | null | undefined>): number | null {
  const v = values.filter((x): x is number => typeof x === "number");
  return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10 : null;
}

/** Descrie parametrii unui exercițiu: „3 × 10 · pauză 60 s · tempo 3-1-1". */
export function describeDose(x: {
  sets?: number | null; reps?: string | null; duration_sec?: number | null; rest_sec?: number | null; tempo?: string | null;
}): string {
  const parts: string[] = [];
  const amount = x.reps ? x.reps : x.duration_sec ? formatSeconds(x.duration_sec) : null;
  if (x.sets && amount) parts.push(`${x.sets} × ${amount}`);
  else if (x.sets) parts.push(`${x.sets} ${x.sets === 1 ? "serie" : "serii"}`);
  else if (amount) parts.push(amount);
  if (x.rest_sec) parts.push(`pauză ${formatSeconds(x.rest_sec)}`);
  if (x.tempo) parts.push(`tempo ${x.tempo}`);
  return parts.join(", ");
}

export function formatSeconds(sec: number): string {
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m} min ${s} s` : `${m} min`;
}
