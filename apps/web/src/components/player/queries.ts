import "server-only";
import {
  DataError, addDays, adherence, friendlyError, scheduledDays, unwrap,
  type Db, type Tables,
} from "@club/shared";

/**
 * Interogările modulului „jucător". Toate rulează cu clientul utilizatorului (RLS activ).
 * Ce nu există în `@club/shared` este scris aici (vezi docs/decizii/jucator.md).
 */

export type RpeEntry = Tables<"rpe_entries">;
export type DataRequest = Tables<"data_requests">;
export type PlayerContact = Tables<"player_contacts">;

/** Regula din RLS: jucătorul poate bifa pentru azi și pentru ultimele 2 zile. */
export const TICK_WINDOW_DAYS = 2;

export function canTickOn(date: string, today: string): boolean {
  return date <= today && date >= addDays(today, -TICK_WINDOW_DAYS);
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export async function listRpe(db: Db, playerId: string, from: string, to: string): Promise<RpeEntry[]> {
  return unwrap(
    await db.from("rpe_entries").select("*").eq("player_id", playerId).gte("entry_date", from).lte("entry_date", to).order("entry_date"),
  );
}

export async function getContact(db: Db, playerId: string): Promise<PlayerContact | null> {
  const { data, error } = await db.from("player_contacts").select("*").eq("player_id", playerId).maybeSingle();
  if (error) throw new DataError(friendlyError(error), error.code);
  return data;
}

export async function listMyRequests(db: Db, userId: string): Promise<DataRequest[]> {
  return unwrap(
    await db.from("data_requests").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
  );
}

export type MyConsent = Pick<Tables<"consents">, "id" | "kind" | "accepted_at" | "guardian_name" | "text_version">;

/** Acordul în vigoare: al contului sau, pentru minori, cel dat de părinte pe fișa jucătorului. */
export async function getMyConsent(db: Db, userId: string, playerId: string | null): Promise<MyConsent | null> {
  let q = db.from("consents").select("id, kind, accepted_at, guardian_name, text_version, user_id, player_id")
    .is("withdrawn_at", null).order("accepted_at", { ascending: false }).limit(5);
  q = playerId ? q.or(`user_id.eq.${userId},player_id.eq.${playerId}`) : q.eq("user_id", userId);
  const { data, error } = await q;
  if (error) throw new DataError(friendlyError(error), error.code);
  return data?.[0] ?? null;
}

// ---------------------------------------------------------------------------
// Aderență: exerciții bifate / exerciții programate, pe programe și pe planuri
// ---------------------------------------------------------------------------
export type AdherenceRow = { key: string; name: string; expected: number; done: number; percent: number | null };
export type PlayerAdherence = { rows: AdherenceRow[]; expected: number; done: number; percent: number | null };

export async function getPlayerAdherence(db: Db, playerId: string, from: string, to: string, planLabel: string): Promise<PlayerAdherence> {
  const [assignRes, planRes, compRes] = await Promise.all([
    db.from("program_assignment_players")
      .select("assignment_id, program_assignments!inner ( id, start_date, end_date, weekdays, is_active, programs!inner ( id, name, program_exercises ( id ) ) )")
      .eq("player_id", playerId),
    db.from("daily_plans").select("id, plan_date, daily_plan_items ( id )").eq("player_id", playerId).gte("plan_date", from).lte("plan_date", to),
    db.from("exercise_completions").select("assignment_id, program_exercise_id, plan_item_id, done_on, done")
      .eq("player_id", playerId).eq("done", true),
  ]);
  if (assignRes.error) throw new DataError(friendlyError(assignRes.error), assignRes.error.code);
  if (planRes.error) throw new DataError(friendlyError(planRes.error), planRes.error.code);
  const completions = compRes.data ?? [];

  const rows: AdherenceRow[] = [];
  for (const r of assignRes.data ?? []) {
    const a = r.program_assignments;
    if (!a) continue;
    const exerciseIds = new Set((a.programs.program_exercises ?? []).map((e) => e.id));
    const days = new Set(scheduledDays(a, from, to));
    if (!days.size || !exerciseIds.size) continue;
    if (!a.is_active) continue;
    const done = completions.filter(
      (c) => c.assignment_id === a.id && !!c.program_exercise_id && exerciseIds.has(c.program_exercise_id) && days.has(c.done_on),
    ).length;
    const res = adherence({ ...a, exerciseCount: exerciseIds.size }, done, from, to);
    rows.push({ key: a.id, name: a.programs.name, expected: res.expected, done: Math.min(done, res.expected), percent: res.percent });
  }
  rows.sort((x, y) => x.name.localeCompare(y.name, "ro"));

  const planItemIds = new Set((planRes.data ?? []).flatMap((p) => (p.daily_plan_items ?? []).map((i) => i.id)));
  if (planItemIds.size) {
    const done = completions.filter((c) => !!c.plan_item_id && planItemIds.has(c.plan_item_id)).length;
    rows.unshift({
      key: "plan", name: planLabel, expected: planItemIds.size, done,
      percent: Math.min(100, Math.round((done / planItemIds.size) * 100)),
    });
  }

  const expected = rows.reduce((s, r) => s + r.expected, 0);
  const done = rows.reduce((s, r) => s + r.done, 0);
  return { rows, expected, done, percent: expected ? Math.min(100, Math.round((done / expected) * 100)) : null };
}

// ---------------------------------------------------------------------------
// Teste fizice: ultimul rezultat al jucătorului + media grupei
// ---------------------------------------------------------------------------
export type TestRow = {
  test_id: string; name: string; unit: string; lower_is_better: boolean;
  value: number; tested_on: string; previous: number | null;
  /** null dacă grupa are sub 3 jucători cu rezultate (media ar dezvălui valori individuale) */
  groupAverage: number | null;
  groupPlayers: number | null;
};

export async function getPlayerTests(db: Db, playerId: string, groupId: string | null): Promise<TestRow[]> {
  const [resultsRes, avgRes] = await Promise.all([
    db.from("fitness_test_results")
      .select("test_id, value, tested_on, fitness_tests!inner ( id, name, unit, lower_is_better, sort, is_active )")
      .eq("player_id", playerId).order("tested_on", { ascending: false }),
    groupId ? db.rpc("group_test_averages", { p_group: groupId }) : Promise.resolve({ data: [], error: null }),
  ]);
  if (resultsRes.error) throw new DataError(friendlyError(resultsRes.error), resultsRes.error.code);
  // media grupei este un plus: dacă RPC-ul refuză, arătăm doar rezultatele proprii
  const averages = new Map((avgRes.data ?? []).map((a) => [a.test_id, a]));

  const byTest = new Map<string, TestRow & { sort: number }>();
  for (const r of resultsRes.data ?? []) {
    const t = r.fitness_tests;
    const existing = byTest.get(r.test_id);
    if (existing) {
      if (existing.previous === null) existing.previous = Number(r.value);
      continue;
    }
    const avg = averages.get(r.test_id);
    byTest.set(r.test_id, {
      test_id: r.test_id, name: t.name, unit: t.unit, lower_is_better: t.lower_is_better, sort: t.sort,
      value: Number(r.value), tested_on: r.tested_on, previous: null,
      groupAverage: avg ? Number(avg.average) : null,
      groupPlayers: avg ? avg.players : null,
    });
  }
  return [...byTest.values()].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "ro"));
}
