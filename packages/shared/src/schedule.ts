/**
 * Program: evenimente, prezență, meci. Etichete în română și calcule de oră în fusul clubului
 * (fără biblioteci de date: Intl face conversia, inclusiv la schimbarea orei de vară).
 */
import { MONTHS_RO, WEEKDAYS_RO, isoWeekday } from "./dates";

export const EVENT_KINDS = ["training", "match", "booking", "meeting", "other"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];
export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  training: "Antrenament",
  match: "Meci",
  booking: "Rezervare teren",
  meeting: "Ședință",
  other: "Altceva",
};

export const ATTENDANCE_STATUSES = ["present", "late", "absent", "injured"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "Prezent",
  late: "Întârziat",
  absent: "Absent",
  injured: "Accidentat",
};

export const ABSENCE_REASONS = ["sick", "injured", "school", "family", "unexcused", "other"] as const;
export type AbsenceReason = (typeof ABSENCE_REASONS)[number];
export const ABSENCE_REASON_LABELS: Record<AbsenceReason, string> = {
  sick: "Bolnav",
  injured: "Accidentat",
  school: "Școală",
  family: "Motive familiale",
  unexcused: "Nemotivat",
  other: "Altul",
};

export const MATCH_EVENT_KINDS = ["goal", "goal_against", "own_goal", "yellow", "red", "sub"] as const;
export type MatchEventKind = (typeof MATCH_EVENT_KINDS)[number];
export const MATCH_EVENT_LABELS: Record<MatchEventKind, string> = {
  goal: "Gol marcat",
  goal_against: "Gol primit",
  own_goal: "Autogol (în poarta noastră)",
  yellow: "Cartonaș galben",
  red: "Cartonaș roșu",
  sub: "Schimbare",
};

export const ELIGIBILITY_LABELS: Record<string, string> = {
  injured: "Accidentat",
  visa: "Fără viză valabilă",
  suspended: "Suspendat",
};

/** Formații uzuale; pozițiile (x, y în procente, atacul sus) sunt în ordinea posturilor 0…n-1. */
export const FORMATIONS: Record<string, Array<[number, number]>> = {
  "4-3-3": [[50, 90], [14, 68], [37, 73], [63, 73], [86, 68], [24, 47], [50, 51], [76, 47], [17, 22], [50, 16], [83, 22]],
  "4-4-2": [[50, 90], [14, 68], [37, 73], [63, 73], [86, 68], [12, 45], [37, 49], [63, 49], [88, 45], [35, 18], [65, 18]],
  "4-2-3-1": [[50, 90], [14, 70], [37, 74], [63, 74], [86, 70], [36, 54], [64, 54], [18, 33], [50, 35], [82, 33], [50, 15]],
  "3-5-2": [[50, 90], [25, 71], [50, 74], [75, 71], [10, 46], [30, 51], [50, 42], [70, 51], [90, 46], [35, 18], [65, 18]],
  "3-2-3 (9)": [[50, 90], [22, 70], [50, 73], [78, 70], [35, 50], [65, 50], [18, 26], [50, 22], [82, 26]],
  "3-3-2 (9)": [[50, 90], [22, 70], [50, 73], [78, 70], [20, 46], [50, 48], [80, 46], [35, 20], [65, 20]],
  "2-3-1 (7)": [[50, 90], [30, 70], [70, 70], [18, 45], [50, 48], [82, 45], [50, 20]],
  "3-2-1 (7)": [[50, 90], [22, 70], [50, 72], [78, 70], [35, 46], [65, 46], [50, 20]],
  "2-1-1 (5)": [[50, 90], [28, 64], [72, 64], [50, 42], [50, 18]],
};

export function formationsFor(playersOnPitch: number | null | undefined): string[] {
  const n = playersOnPitch ?? 11;
  return Object.keys(FORMATIONS).filter((k) => FORMATIONS[k].length === n);
}

// ---------------------------------------------------------------------------
// Ore în fusul clubului
// ---------------------------------------------------------------------------
function parts(t: Date, timezone: string) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(t);
  const get = (k: string) => f.find((p) => p.type === k)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

/** „2026-10-15" — ziua în fusul clubului a unui moment. */
export function localDate(ts: string | Date, timezone = "Europe/Bucharest"): string {
  return parts(new Date(ts), timezone).date;
}

/** „17:30" în fusul clubului. */
export function localTime(ts: string | Date, timezone = "Europe/Bucharest"): string {
  return parts(new Date(ts), timezone).time;
}

/** Momentul (ISO UTC) pentru o zi și o oră locale ale clubului. */
export function zonedToUtc(date: string, time: string, timezone = "Europe/Bucharest"): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wanted = Date.UTC(y, m - 1, d, hh, mm);
  let guess = wanted;
  for (let i = 0; i < 2; i++) {
    const p = parts(new Date(guess), timezone);
    const [py, pm, pd] = p.date.split("-").map(Number);
    const [ph, pmin] = p.time.split(":").map(Number);
    const shown = Date.UTC(py, pm - 1, pd, ph, pmin);
    guess += wanted - shown;
  }
  return new Date(guess).toISOString();
}

/** „joi, 15 octombrie · 17:30–19:00" */
export function formatEventWhen(startsAt: string, endsAt: string | null, timezone = "Europe/Bucharest", opts: { weekday?: boolean } = {}): string {
  const day = localDate(startsAt, timezone);
  const d = Number(day.slice(8, 10));
  const m = Number(day.slice(5, 7));
  const head = `${opts.weekday === false ? "" : WEEKDAYS_RO[isoWeekday(day) - 1] + ", "}${d} ${MONTHS_RO[m - 1]}`;
  const time = localTime(startsAt, timezone) + (endsAt ? "–" + localTime(endsAt, timezone) : "");
  return `${head} · ${time}`;
}

/** Minutele dintre două momente. */
export function minutesBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 60000);
}
