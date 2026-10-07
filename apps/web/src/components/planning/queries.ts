import "server-only";
import { DataError, friendlyError, listPlayers, unwrap, type Db, type Tables } from "@club/shared";
import {
  EXERCISE_OPTION_COLUMNS, toExerciseOption,
  type ExerciseOption, type ItemCompletion, type ItemRow, type PlayerOption, type ProgramTemplate,
} from "./types";
import type { CompletionRow } from "./adherence";

type Res<T> = { data: T[] | null; error: { message: string; code?: string } | null };

/** Citește toate rândurile unei interogări, pe pagini (API-ul limitează un răspuns la 1000 de rânduri). */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<Res<T>>, size = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new DataError(friendlyError(error), error.code);
    out.push(...(data ?? []));
    if (!data || data.length < size) return out;
  }
}

const bySort = <T extends { sort: number }>(rows: T[]): T[] => [...rows].sort((a, b) => a.sort - b.sort);

// ---------------------------------------------------------------------------
// Exerciții
// ---------------------------------------------------------------------------
export async function listExerciseOptions(db: Db): Promise<ExerciseOption[]> {
  const rows = unwrap(await db.from("exercises").select(EXERCISE_OPTION_COLUMNS).order("name"));
  return rows.map(toExerciseOption).sort((a, b) => a.name.localeCompare(b.name, "ro"));
}

export type ExerciseUsage = { programs: Array<{ id: string; name: string; is_active: boolean }>; planCount: number };

/** Unde este folosit un exercițiu: programele (distincte) și numărul de planuri zilnice. */
export async function getExerciseUsage(db: Db, exerciseId: string): Promise<ExerciseUsage> {
  const [inPrograms, inPlans] = await Promise.all([
    db.from("program_exercises").select("program_id, programs!inner ( id, name, is_active )").eq("exercise_id", exerciseId),
    fetchAll<{ plan_id: string }>((from, to) =>
      db.from("daily_plan_items").select("plan_id").eq("exercise_id", exerciseId).order("id").range(from, to)),
  ]);
  if (inPrograms.error) throw new DataError(friendlyError(inPrograms.error), inPrograms.error.code);
  const programs = new Map<string, { id: string; name: string; is_active: boolean }>();
  for (const r of inPrograms.data ?? []) programs.set(r.programs.id, r.programs);
  return {
    programs: [...programs.values()].sort((a, b) => a.name.localeCompare(b.name, "ro")),
    planCount: new Set(inPlans.map((r) => r.plan_id)).size,
  };
}

// ---------------------------------------------------------------------------
// Programe
// ---------------------------------------------------------------------------
export type ProgramSummary = Pick<Tables<"programs">, "id" | "name" | "description" | "kind" | "is_template" | "is_active"> & {
  exerciseCount: number;
  activeAssignments: number;
  totalAssignments: number;
};

export async function listProgramSummaries(db: Db, today: string): Promise<ProgramSummary[]> {
  const rows = unwrap(
    await db.from("programs")
      .select("id, name, description, kind, is_template, is_active, program_exercises ( id ), program_assignments ( id, is_active, end_date )")
      .order("name"),
  );
  return rows.map((p) => ({
    id: p.id, name: p.name, description: p.description, kind: p.kind, is_template: p.is_template, is_active: p.is_active,
    exerciseCount: p.program_exercises.length,
    activeAssignments: p.program_assignments.filter((a) => a.is_active && (!a.end_date || a.end_date >= today)).length,
    totalAssignments: p.program_assignments.length,
  })).sort((a, b) => a.name.localeCompare(b.name, "ro"));
}

export type ProgramWithItems = Tables<"programs"> & { items: ItemRow[] };

export async function getProgram(db: Db, id: string): Promise<ProgramWithItems | null> {
  const { data, error } = await db.from("programs").select("*, program_exercises ( * )").eq("id", id).maybeSingle();
  if (error) throw new DataError(friendlyError(error), error.code);
  if (!data) return null;
  const { program_exercises, ...program } = data;
  return { ...program, items: bySort(program_exercises) };
}

/** Programele din care se poate porni un plan (șabloanele primele). */
export async function listProgramTemplates(db: Db): Promise<ProgramTemplate[]> {
  const rows = unwrap(
    await db.from("programs").select("id, name, kind, is_template, program_exercises ( * )").eq("is_active", true).order("name"),
  );
  return rows
    .map((p) => ({ id: p.id, name: p.name, kind: p.kind, is_template: p.is_template, items: bySort(p.program_exercises) }))
    .filter((p) => p.items.length > 0)
    .sort((a, b) => Number(b.is_template) - Number(a.is_template) || a.name.localeCompare(b.name, "ro"));
}

export type AssignmentRow = Tables<"program_assignments"> & { playerIds: string[] };

export async function listAssignments(db: Db, programId: string): Promise<AssignmentRow[]> {
  const rows = unwrap(
    await db.from("program_assignments").select("*, program_assignment_players ( player_id )")
      .eq("program_id", programId).order("created_at", { ascending: false }),
  );
  return rows.map(({ program_assignment_players, ...a }) => ({ ...a, playerIds: program_assignment_players.map((p) => p.player_id) }));
}

const COMPLETION_COLUMNS = "player_id, done_on, assignment_id, program_exercise_id, done, comment, pain, pain_intensity";

/** Toate bifele unei alocări (pot fi multe: jucători × zile × exerciții). */
export async function listAssignmentCompletions(db: Db, assignmentId: string): Promise<CompletionRow[]> {
  return fetchAll<CompletionRow>((from, to) =>
    db.from("exercise_completions").select(COMPLETION_COLUMNS).eq("assignment_id", assignmentId).order("id").range(from, to));
}

/** Bifele tuturor alocărilor unui program. */
export async function listCompletionsForAssignments(db: Db, assignmentIds: string[]): Promise<CompletionRow[]> {
  if (!assignmentIds.length) return [];
  return fetchAll<CompletionRow>((from, to) =>
    db.from("exercise_completions").select(COMPLETION_COLUMNS).in("assignment_id", assignmentIds).order("id").range(from, to));
}

/** Bifele unui jucător pe exercițiile de program. */
export async function listPlayerProgramCompletions(db: Db, playerId: string): Promise<CompletionRow[]> {
  return fetchAll<CompletionRow>((from, to) =>
    db.from("exercise_completions").select(COMPLETION_COLUMNS).eq("player_id", playerId).not("assignment_id", "is", null).order("id").range(from, to));
}

export type PlayerAssignment = Tables<"program_assignments"> & {
  program: { id: string; name: string; kind: string; exerciseIds: string[] };
};

/** Alocările care îl includ pe jucător, cu programul și exercițiile lui. */
export async function listPlayerAssignments(db: Db, playerId: string): Promise<PlayerAssignment[]> {
  const rows = unwrap(
    await db.from("program_assignment_players")
      .select("assignment_id, program_assignments!inner ( *, programs!inner ( id, name, kind, program_exercises ( id ) ) )")
      .eq("player_id", playerId),
  );
  return rows.map((r) => {
    const { programs, ...a } = r.program_assignments;
    return { ...a, program: { id: programs.id, name: programs.name, kind: programs.kind, exerciseIds: programs.program_exercises.map((e) => e.id) } };
  }).sort((a, b) => (a.start_date < b.start_date ? 1 : -1));
}

// ---------------------------------------------------------------------------
// Jucători
// ---------------------------------------------------------------------------
export async function listPlayerOptions(db: Db): Promise<PlayerOption[]> {
  const players = await listPlayers(db);
  return players.map((p) => ({ id: p.id, name: p.display_name, group_id: p.group_id, position: p.position }));
}

/** Jucătorii activi (pentru alegere) și numele tuturor, inclusiv ale celor inactivi (pentru afișare). */
export async function listPlayersWithNames(db: Db): Promise<{ options: PlayerOption[]; names: Map<string, string> }> {
  const players = await listPlayers(db, { includeInactive: true });
  return {
    options: players.filter((p) => p.is_active).map((p) => ({ id: p.id, name: p.display_name, group_id: p.group_id, position: p.position })),
    names: new Map(players.map((p) => [p.id, p.display_name])),
  };
}

// ---------------------------------------------------------------------------
// Planuri zilnice
// ---------------------------------------------------------------------------
export type PlanCell = { id: string; title: string | null; total: number; done: number; pain: boolean; comments: number };

/** Planurile unor jucători într-un interval, cu numărul de exerciții și câte au fost bifate. Cheie: `<jucător>:<zi>`. */
export async function getPlanCells(db: Db, playerIds: string[], from: string, to: string): Promise<Map<string, PlanCell>> {
  const out = new Map<string, PlanCell>();
  if (!playerIds.length) return out;
  const rows = await fetchAll((a, b) =>
    db.from("daily_plans")
      .select("id, player_id, plan_date, title, daily_plan_items ( id, exercise_completions ( done, pain, comment ) )")
      .in("player_id", playerIds).gte("plan_date", from).lte("plan_date", to).order("id").range(a, b));
  for (const p of rows) {
    const completions = p.daily_plan_items.flatMap((i) => i.exercise_completions);
    out.set(`${p.player_id}:${p.plan_date}`, {
      id: p.id,
      title: p.title,
      total: p.daily_plan_items.length,
      done: p.daily_plan_items.filter((i) => i.exercise_completions.some((c) => c.done)).length,
      pain: completions.some((c) => c.pain),
      comments: completions.filter((c) => c.comment).length,
    });
  }
  return out;
}

export type PlanForEdit = Tables<"daily_plans"> & { items: ItemRow[]; completions: Record<string, ItemCompletion> };

export async function getPlanForEdit(db: Db, playerId: string, date: string): Promise<PlanForEdit | null> {
  const { data, error } = await db.from("daily_plans")
    .select("*, daily_plan_items ( *, exercise_completions ( done, done_on, comment, pain, pain_intensity ) )")
    .eq("player_id", playerId).eq("plan_date", date).maybeSingle();
  if (error) throw new DataError(friendlyError(error), error.code);
  if (!data) return null;
  const { daily_plan_items, ...plan } = data;
  const completions: Record<string, ItemCompletion> = {};
  const items: ItemRow[] = [];
  for (const { exercise_completions, ...item } of bySort(daily_plan_items)) {
    items.push(item);
    if (exercise_completions[0]) completions[item.id] = exercise_completions[0];
  }
  return { ...plan, items, completions };
}

/** Zilele în care jucătorii au deja plan, într-un interval (pentru avertizarea la copiere). */
export async function listPlanDates(db: Db, from: string, to: string): Promise<Record<string, string[]>> {
  const rows = await fetchAll<{ player_id: string; plan_date: string }>((a, b) =>
    db.from("daily_plans").select("player_id, plan_date").gte("plan_date", from).lte("plan_date", to).order("id").range(a, b));
  const out: Record<string, string[]> = {};
  for (const r of rows) (out[r.player_id] ??= []).push(r.plan_date);
  return out;
}

export type InjuryOption = Pick<Tables<"injuries">, "id" | "zone" | "side" | "zone_detail" | "zone_uncertain" | "diagnosis" | "occurred_on" | "rtp_stage" | "actual_return_on">;

/** Accidentările active ale jucătorului (plus cea deja legată de plan, chiar dacă s-a închis). */
export async function listInjuryOptions(db: Db, playerId: string, alsoId?: string | null): Promise<InjuryOption[]> {
  let q = db.from("injuries")
    .select("id, zone, side, zone_detail, zone_uncertain, diagnosis, occurred_on, rtp_stage, actual_return_on")
    .eq("player_id", playerId).order("occurred_on", { ascending: false });
  q = alsoId ? q.or(`actual_return_on.is.null,id.eq.${alsoId}`) : q.is("actual_return_on", null);
  return unwrap(await q);
}
