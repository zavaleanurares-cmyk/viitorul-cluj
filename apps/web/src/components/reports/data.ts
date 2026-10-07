import "server-only";
import {
  addDays, average, getPlayer, listPlayers, listWellness, unwrap, weekDates,
  type AppContext, type ClubStatus, type Db, type Group, type Player, type PlayerListItem, type WellnessEntry,
} from "@club/shared";
import { fetchAll } from "@/components/dashboard/queries";
import { assignmentState, playerAdherence, type CompletionRow, type PlayerAdherence } from "@/components/planning/adherence";
import { listPlayerAssignments, listPlayerProgramCompletions, type PlayerAssignment } from "@/components/planning/queries";
import { availabilityOf } from "@/components/players/domain";
import {
  isUuid, listAnthropometrics, listInjuries, listStatusHistory,
  type Anthropometric, type InjuryRow, type InjuryWithTreatments, type StatusHistoryRow,
} from "@/components/players/queries";

/**
 * Datele rapoartelor. Toate interogările rulează cu clientul utilizatorului (RLS):
 * un jucător din alt club sau o grupă străină pur și simplu nu se găsesc.
 */

// ---------------------------------------------------------------------------
// Fișa jucătorului
// ---------------------------------------------------------------------------
export type TestRow = { name: string; unit: string; testedOn: string; value: number; average: number | null; best: number | null };

export type PlayerSheet = {
  player: Player;
  group: Group | null;
  status: ClubStatus | null;
  injuries: InjuryWithTreatments[];
  statusHistory: StatusHistoryRow[];
  wellness: WellnessEntry[];
  wellnessFrom: string;
  tests: TestRow[];
  anthropometrics: Anthropometric[];
  programs: Array<{ assignment: PlayerAssignment; adherence: PlayerAdherence; state: ReturnType<typeof assignmentState> }>;
};

export const STATUS_HISTORY_LIMIT = 25;

export async function getPlayerSheet(db: Db, ctx: AppContext, playerId: string): Promise<PlayerSheet | null> {
  if (!isUuid(playerId)) return null;
  const player = await getPlayer(db, playerId);
  if (!player || player.club_id !== ctx.club.id) return null;

  const wellnessFrom = addDays(ctx.today, -27);
  const [injuries, statusHistory, wellness, results, anthropometrics, assignments, completions, averages] = await Promise.all([
    listInjuries(db, playerId),
    listStatusHistory(db, playerId, STATUS_HISTORY_LIMIT),
    listWellness(db, [playerId], wellnessFrom, ctx.today),
    db.from("fitness_test_results")
      .select("tested_on, value, test_id, fitness_tests!inner ( name, unit, sort )")
      .eq("player_id", playerId).order("tested_on", { ascending: false }).limit(500),
    listAnthropometrics(db, playerId),
    listPlayerAssignments(db, playerId),
    listPlayerProgramCompletions(db, playerId),
    player.group_id ? db.rpc("group_test_averages", { p_group: player.group_id }) : Promise.resolve({ data: null, error: null }),
  ]);

  // ultimul rezultat la fiecare test
  const avgByTest = new Map((averages.data ?? []).map((a) => [a.test_id, a]));
  const latest = new Map<string, TestRow & { sort: number }>();
  for (const r of unwrap(results)) {
    if (latest.has(r.test_id)) continue;
    const avg = avgByTest.get(r.test_id);
    latest.set(r.test_id, {
      name: r.fitness_tests.name, unit: r.fitness_tests.unit, sort: r.fitness_tests.sort, testedOn: r.tested_on, value: Number(r.value),
      average: avg ? Number(avg.average) : null, best: avg ? Number(avg.best) : null,
    });
  }

  const byAssignment = new Map<string, CompletionRow[]>();
  for (const c of completions) {
    if (!c.assignment_id) continue;
    const list = byAssignment.get(c.assignment_id);
    if (list) list.push(c);
    else byAssignment.set(c.assignment_id, [c]);
  }

  return {
    player,
    group: ctx.groups.find((g) => g.id === player.group_id) ?? null,
    status: ctx.statuses.find((s) => s.id === player.status_id) ?? null,
    injuries,
    statusHistory,
    wellness: [...wellness].sort((a, b) => b.entry_date.localeCompare(a.entry_date)),
    wellnessFrom,
    tests: [...latest.values()].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "ro")),
    anthropometrics: anthropometrics.slice(0, 8),
    programs: assignments.map((assignment) => ({
      assignment,
      state: assignmentState(assignment, ctx.today),
      adherence: playerAdherence(assignment, assignment.program.exerciseIds, byAssignment.get(assignment.id) ?? [], ctx.today),
    })),
  };
}

// ---------------------------------------------------------------------------
// Raportul săptămânal al unei grupe
// ---------------------------------------------------------------------------
export type WeeklyPlayer = {
  player: PlayerListItem;
  status: ClubStatus | null;
  availability: "full" | "limited" | "out";
  /** chestionarul fiecărei zile (luni → duminică); null = necompletat */
  days: Array<WellnessEntry | null>;
  daysDone: number;
  adherence: { programs: string[]; done: number; expected: number; percent: number | null } | null;
};

export type WeeklyInjury = InjuryRow & { playerName: string };

export type WeeklyReport = {
  group: Group;
  monday: string;
  dates: string[];
  /** zilele săptămânii care au trecut deja (până azi inclusiv) */
  elapsedDays: number;
  players: WeeklyPlayer[];
  counts: { full: number; limited: number; out: number };
  newInjuries: WeeklyInjury[];
  returns: WeeklyInjury[];
  adherence: { percent: number | null; under50: number; any: boolean };
  averages: { fatigue: number | null; load: number | null };
};

export async function getWeeklyReport(db: Db, ctx: AppContext, groupId: string, monday: string): Promise<WeeklyReport | null> {
  const group = ctx.groups.find((g) => g.id === groupId);
  if (!group) return null;
  const dates = weekDates(monday);
  const sunday = dates[6];
  const windowEnd = sunday < ctx.today ? sunday : ctx.today;
  const elapsedDays = dates.filter((d) => d <= ctx.today).length;

  const roster = await listPlayers(db, { groupId });
  const ids = roster.map((p) => p.id);
  const nameOf = new Map(roster.map((p) => [p.id, p.display_name]));
  const statusById = new Map(ctx.statuses.map((s) => [s.id, s]));

  const [wellness, newInj, returned, memberships] = await Promise.all([
    listWellness(db, ids, monday, sunday),
    ids.length
      ? db.from("injuries").select("*").in("player_id", ids).gte("occurred_on", monday).lte("occurred_on", sunday).order("occurred_on")
      : Promise.resolve({ data: [] as InjuryRow[], error: null }),
    ids.length
      ? db.from("injuries").select("*").in("player_id", ids).gte("actual_return_on", monday).lte("actual_return_on", sunday).order("actual_return_on")
      : Promise.resolve({ data: [] as InjuryRow[], error: null }),
    ids.length
      ? db.from("program_assignment_players")
          .select("player_id, program_assignments!inner ( id, start_date, end_date, weekdays, is_active, programs!inner ( name, program_exercises ( id ) ) )")
          .in("player_id", ids)
      : Promise.resolve({ data: [], error: null }),
  ]);

  // alocările care ating săptămâna (cele oprite nu se numără)
  const relevant = unwrap(memberships).filter((m) => {
    const a = m.program_assignments;
    return a.is_active && a.start_date <= sunday && (!a.end_date || a.end_date >= monday);
  });
  const assignmentIds = [...new Set(relevant.map((m) => m.program_assignments.id))];
  const completions = assignmentIds.length && windowEnd >= monday
    ? await fetchAll<CompletionRow>((from, to) =>
        db.from("exercise_completions").select("player_id, done_on, assignment_id, program_exercise_id, done, comment, pain, pain_intensity")
          .in("assignment_id", assignmentIds).in("player_id", ids).gte("done_on", monday).lte("done_on", windowEnd).order("id").range(from, to))
    : [];

  const entryBy = new Map(wellness.map((w) => [`${w.player_id}|${w.entry_date}`, w]));
  let groupDone = 0;
  let groupExpected = 0;
  let under50 = 0;

  const players: WeeklyPlayer[] = roster.map((player) => {
    const status = player.status_id ? statusById.get(player.status_id) ?? null : null;
    const days = dates.map((d) => entryBy.get(`${player.id}|${d}`) ?? null);
    const mine = relevant.filter((m) => m.player_id === player.id);
    let adherence: WeeklyPlayer["adherence"] = null;
    if (mine.length) {
      let done = 0;
      let expected = 0;
      for (const m of mine) {
        const a = m.program_assignments;
        const start = a.start_date > monday ? a.start_date : monday;
        const res = playerAdherence(
          { start_date: start, end_date: a.end_date, weekdays: a.weekdays },
          a.programs.program_exercises.map((e) => e.id),
          completions.filter((c) => c.player_id === player.id && c.assignment_id === a.id),
          windowEnd, 1,
        );
        done += Math.min(res.done, res.expected);
        expected += res.expected;
      }
      const percent = expected ? Math.round((done / expected) * 100) : null;
      adherence = { programs: [...new Set(mine.map((m) => m.program_assignments.programs.name))].sort((a, b) => a.localeCompare(b, "ro")), done, expected, percent };
      groupDone += done;
      groupExpected += expected;
      if (percent !== null && percent < 50) under50++;
    }
    return { player, status, availability: availabilityOf(status), days, daysDone: days.filter(Boolean).length, adherence };
  });

  const counts = { full: 0, limited: 0, out: 0 };
  for (const p of players) counts[p.availability]++;
  const withName = (rows: InjuryRow[]): WeeklyInjury[] => rows.map((i) => ({ ...i, playerName: nameOf.get(i.player_id) ?? "—" }));

  return {
    group, monday, dates, elapsedDays, players, counts,
    newInjuries: withName(unwrap(newInj)),
    returns: withName(unwrap(returned)),
    adherence: { percent: groupExpected ? Math.round((groupDone / groupExpected) * 100) : null, under50, any: players.some((p) => p.adherence) },
    averages: { fatigue: average(wellness.map((w) => w.fatigue)), load: average(wellness.map((w) => w.muscle_load)) },
  };
}

/** Lunea unei săptămâni cerute în URL; null dacă valoarea nu este o dată validă. */
export function parseWeek(value: string | null, today: string, weekStart: (iso: string) => string): string | null {
  if (!value) return weekStart(today);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) return null;
  const monday = weekStart(value);
  // între un an în urmă și săptămâna viitoare
  if (monday < addDays(today, -400) || monday > addDays(today, 7)) return null;
  return monday;
}
