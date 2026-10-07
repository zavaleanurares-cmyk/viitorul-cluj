import { adherence, scheduledDays } from "@club/shared";

export type DayState = "full" | "partial" | "none";

export type CompletionRow = {
  player_id: string;
  done_on: string;
  assignment_id: string | null;
  program_exercise_id: string | null;
  done: boolean;
  comment: string | null;
  pain: boolean;
  pain_intensity: number | null;
};

export type AdherenceNote = {
  date: string;
  program_exercise_id: string | null;
  comment: string | null;
  pain: boolean;
  pain_intensity: number | null;
};

export type PlayerAdherence = {
  percent: number | null;
  done: number;
  expected: number;
  /** ultimele zile programate, cea mai veche prima */
  days: Array<{ date: string; done: number; state: DayState }>;
  /** starea din ultima zi programată (până azi inclusiv) */
  last: DayState | null;
  notes: AdherenceNote[];
};

export type Schedule = { start_date: string; end_date: string | null; weekdays: number[] };

export function dayState(done: number, total: number): DayState {
  if (total > 0 && done >= total) return "full";
  return done > 0 ? "partial" : "none";
}

/**
 * Aderența unui jucător la o alocare: exerciții bifate / exerciții programate, de la începutul
 * alocării până azi inclusiv. Se numără doar bifele din zilele programate și doar pentru
 * exercițiile care mai sunt în program.
 */
export function playerAdherence(
  schedule: Schedule, exerciseIds: string[], completions: CompletionRow[], today: string, stripLength = 10,
): PlayerAdherence {
  const days = scheduledDays(schedule, schedule.start_date, today);
  const daySet = new Set(days);
  const exSet = new Set(exerciseIds);
  const perDay = new Map<string, number>();
  let done = 0;
  const notes: AdherenceNote[] = [];
  for (const c of completions) {
    if (c.comment || c.pain) {
      notes.push({ date: c.done_on, program_exercise_id: c.program_exercise_id, comment: c.comment, pain: c.pain, pain_intensity: c.pain_intensity });
    }
    if (!c.done || !daySet.has(c.done_on) || !c.program_exercise_id || !exSet.has(c.program_exercise_id)) continue;
    done++;
    perDay.set(c.done_on, (perDay.get(c.done_on) ?? 0) + 1);
  }
  const a = adherence({ ...schedule, exerciseCount: exerciseIds.length }, done, schedule.start_date, today);
  const strip = days.slice(-stripLength).map((date) => {
    const n = perDay.get(date) ?? 0;
    return { date, done: n, state: dayState(n, exerciseIds.length) };
  });
  notes.sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0));
  return { percent: a.percent, done: a.done, expected: a.expected, days: strip, last: strip.length ? strip[strip.length - 1].state : null, notes };
}

/** O alocare este în desfășurare dacă nu a fost oprită și nu s-a încheiat. */
export function assignmentState(a: { is_active: boolean; start_date: string; end_date: string | null }, today: string): "active" | "upcoming" | "ended" | "stopped" {
  if (!a.is_active) return "stopped";
  if (a.end_date && a.end_date < today) return "ended";
  if (a.start_date > today) return "upcoming";
  return "active";
}
