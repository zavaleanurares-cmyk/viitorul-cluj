import "server-only";
import { unwrap, type Db, type Tables } from "@club/shared";
import { METRIC_KEYS, isUuid, num, type MetricValues } from "./domain";

/**
 * Interogările modulului „date fizice". Toate rulează cu clientul utilizatorului (RLS activ):
 * antrenorul primește doar sesiunile și indicatorii grupelor lui.
 */

export type PhysicalSession = Tables<"physical_sessions">;
export type FitnessTest = Tables<"fitness_tests">;
export type TestResult = Tables<"fitness_test_results">;

export type SessionListItem = PhysicalSession & { playerCount: number };

type MetricRowDb = Tables<"physical_metrics">;

export function metricValues(row: Record<string, unknown>): MetricValues {
  return Object.fromEntries(METRIC_KEYS.map((k) => [k, num(row[k])])) as MetricValues;
}

/**
 * Sesiunile unei grupe într-un interval, cu numărul de jucători care au date.
 * Sesiunile importate fără grupă apar la grupa ai cărei jucători au valori în ele.
 */
export async function listSessions(db: Db, groupId: string, playerIds: string[], from: string, to: string): Promise<SessionListItem[]> {
  const rows = unwrap(
    await db.from("physical_sessions")
      .select("*, physical_metrics ( player_id )")
      .or(`group_id.eq.${groupId},group_id.is.null`)
      .gte("session_date", from).lte("session_date", to)
      .order("session_date", { ascending: false }).order("name"),
  ) as unknown as Array<PhysicalSession & { physical_metrics: Array<{ player_id: string }> | null }>;
  const inGroup = new Set(playerIds);
  return rows
    .map(({ physical_metrics, ...s }) => {
      const metrics = physical_metrics ?? [];
      return { ...s, playerCount: s.group_id ? metrics.length : metrics.filter((m) => inGroup.has(m.player_id)).length };
    })
    .filter((s) => s.group_id === groupId || s.playerCount > 0);
}

export type GroupMetricRow = { session_id: string; session_date: string; session_type: string; player_id: string; values: MetricValues };

/** Toți indicatorii jucătorilor dați, într-un interval (pentru sinteze). */
export async function listMetricsFor(db: Db, playerIds: string[], from: string, to: string): Promise<GroupMetricRow[]> {
  if (!playerIds.length) return [];
  const rows = unwrap(
    await db.from("physical_metrics")
      .select(`player_id, ${METRIC_KEYS.join(", ")}, physical_sessions!inner ( id, session_date, session_type, name )`)
      .in("player_id", playerIds)
      .gte("physical_sessions.session_date", from).lte("physical_sessions.session_date", to),
  ) as unknown as Array<Record<string, unknown> & { player_id: string; physical_sessions: { id: string; session_date: string; session_type: string } }>;
  return rows.map((r) => ({
    session_id: r.physical_sessions.id, session_date: r.physical_sessions.session_date, session_type: r.physical_sessions.session_type,
    player_id: r.player_id, values: metricValues(r),
  }));
}

export type SessionMetricRow = {
  player_id: string; name: string; group_id: string | null; values: MetricValues; extra: Record<string, string | number>;
};
export type SessionDetail = { session: PhysicalSession; rows: SessionMetricRow[] };

export async function getSessionDetail(db: Db, id: string): Promise<SessionDetail | null> {
  if (!isUuid(id)) return null;
  const { data: session } = await db.from("physical_sessions").select("*").eq("id", id).maybeSingle();
  if (!session) return null;
  const metrics = unwrap(
    await db.from("physical_metrics").select("*, players!inner ( id, display_name, group_id )").eq("session_id", id),
  ) as unknown as Array<MetricRowDb & { players: { id: string; display_name: string; group_id: string | null } }>;
  const rows = metrics.map((m) => {
    const extra: Record<string, string | number> = {};
    if (m.extra && typeof m.extra === "object" && !Array.isArray(m.extra)) {
      for (const [k, v] of Object.entries(m.extra)) if (typeof v === "number" || (typeof v === "string" && v.trim())) extra[k] = v;
    }
    return { player_id: m.player_id, name: m.players.display_name, group_id: m.players.group_id, values: metricValues(m as unknown as Record<string, unknown>), extra };
  });
  rows.sort((a, b) => a.name.localeCompare(b.name, "ro"));
  return { session, rows };
}

export type PlayerSessionRow = { session: Pick<PhysicalSession, "id" | "session_date" | "session_type" | "name" | "source">; values: MetricValues };

export async function listPlayerSessions(db: Db, playerId: string, from: string, to: string): Promise<PlayerSessionRow[]> {
  const rows = unwrap(
    await db.from("physical_metrics")
      .select(`${METRIC_KEYS.join(", ")}, physical_sessions!inner ( id, session_date, session_type, name, source )`)
      .eq("player_id", playerId)
      .gte("physical_sessions.session_date", from).lte("physical_sessions.session_date", to),
  ) as unknown as Array<Record<string, unknown> & { physical_sessions: PlayerSessionRow["session"] }>;
  return rows
    .map((r) => ({ session: r.physical_sessions, values: metricValues(r) }))
    .sort((a, b) => b.session.session_date.localeCompare(a.session.session_date) || a.session.name.localeCompare(b.session.name, "ro"));
}

// ---------------------------------------------------------------------------
// Teste fizice
// ---------------------------------------------------------------------------
export async function listTests(db: Db, opts: { includeInactive?: boolean } = {}): Promise<FitnessTest[]> {
  let q = db.from("fitness_tests").select("*").order("sort").order("name");
  if (!opts.includeInactive) q = q.eq("is_active", true);
  return unwrap(await q);
}

export type ResultRow = Pick<TestResult, "id" | "test_id" | "player_id" | "tested_on" | "notes"> & { value: number };

/** Rezultatele unor jucători (la un test sau la toate), cele mai noi primele. */
export async function listResults(db: Db, playerIds: string[], testId?: string): Promise<ResultRow[]> {
  if (!playerIds.length) return [];
  let q = db.from("fitness_test_results").select("id, test_id, player_id, tested_on, value, notes").in("player_id", playerIds);
  if (testId) q = q.eq("test_id", testId);
  const rows = unwrap(await q.order("tested_on", { ascending: false }).order("created_at", { ascending: false }));
  return rows.map((r) => ({ ...r, value: Number(r.value) }));
}

export type GroupAverage = { test_id: string; average: number; best: number; players: number };

/** Media grupei pe teste (RPC: întoarce un test doar dacă cel puțin 3 jucători au rezultat). Lipsa nu este o eroare. */
export async function groupAverages(db: Db, groupId: string | null): Promise<Map<string, GroupAverage>> {
  if (!groupId) return new Map();
  const { data, error } = await db.rpc("group_test_averages", { p_group: groupId });
  if (error || !data) return new Map();
  return new Map(data.map((a) => [a.test_id, { test_id: a.test_id, average: Number(a.average), best: Number(a.best), players: Number(a.players) }]));
}
