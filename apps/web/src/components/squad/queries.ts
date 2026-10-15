import "server-only";
import { addDays, diffDays, type Db, type Tables } from "@club/shared";

export type RosterRow = Pick<Tables<"players">,
  "id" | "full_name" | "display_name" | "shirt_number" | "position" | "birth_date" | "group_id" | "status_id" |
  "medical_visa_expires_on" | "is_active" | "status_return_on"> & {
  attendance: { present: number; total: number } | null;
  suspended: boolean;
};

export type VisaState = "ok" | "expiring" | "expired" | "missing";

export function visaState(expires: string | null, today: string, warnDays = 30): { state: VisaState; days: number | null } {
  if (!expires) return { state: "missing", days: null };
  const days = diffDays(today, expires);
  if (days < 0) return { state: "expired", days };
  if (days <= warnDays) return { state: "expiring", days };
  return { state: "ok", days };
}

/** Lotul vizibil utilizatorului (RLS), cu prezența pe 30 de zile și suspendările active. */
export async function listRoster(db: Db, opts: { groupId?: string | null; q?: string; includeInactive?: boolean; today: string }): Promise<RosterRow[]> {
  let query = db.from("players")
    .select("id, full_name, display_name, shirt_number, position, birth_date, group_id, status_id, medical_visa_expires_on, is_active, status_return_on")
    .is("anonymized_at", null)
    .order("display_name");
  if (!opts.includeInactive) query = query.eq("is_active", true);
  if (opts.groupId === "none") query = query.is("group_id", null);
  else if (opts.groupId) query = query.eq("group_id", opts.groupId);
  const { data: players, error } = await query;
  if (error) throw error;
  let rows = players ?? [];
  if (opts.q) {
    const n = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const q = n(opts.q.trim());
    rows = rows.filter((p) => n(p.full_name).includes(q) || n(p.display_name).includes(q));
  }
  const ids = rows.map((p) => p.id);
  const since = new Date(Date.parse(addDays(opts.today, -30))).toISOString();
  const [att, susp] = await Promise.all([
    ids.length
      ? db.from("attendance").select("player_id, status, events!inner(starts_at, kind, deleted_at)")
          .in("player_id", ids).gte("events.starts_at", since).eq("events.kind", "training").is("events.deleted_at", null)
      : Promise.resolve({ data: [], error: null }),
    ids.length ? db.from("suspensions").select("player_id").in("player_id", ids).gt("matches_remaining", 0) : Promise.resolve({ data: [], error: null }),
  ]);
  const stats = new Map<string, { present: number; total: number }>();
  for (const a of att.data ?? []) {
    if (a.status === "injured") continue; // accidentarea nu scade prezența
    const s = stats.get(a.player_id) ?? { present: 0, total: 0 };
    s.total++;
    if (a.status === "present" || a.status === "late") s.present++;
    stats.set(a.player_id, s);
  }
  const suspended = new Set((susp.data ?? []).map((s) => s.player_id));
  return rows.map((p) => ({ ...p, attendance: stats.get(p.id) ?? null, suspended: suspended.has(p.id) }));
}

export async function getSquadPlayer(db: Db, id: string) {
  const { data, error } = await db.from("players").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function playerGuardians(db: Db, playerId: string) {
  const { data } = await db.from("guardian_players")
    .select("relation, is_billing, guardians(id, full_name, phone, email, user_id, deleted_at)")
    .eq("player_id", playerId);
  return (data ?? [])
    .filter((r) => r.guardians && !r.guardians.deleted_at)
    .map((r) => ({ relation: r.relation, isBilling: r.is_billing, ...r.guardians! }));
}

/** Prezența pe ultimele 30 de zile, cu absențele. */
export async function playerAttendance(db: Db, playerId: string, today: string) {
  const since = new Date(Date.parse(addDays(today, -30))).toISOString();
  const { data } = await db.from("attendance")
    .select("status, reason, events!inner(id, title, starts_at, kind, deleted_at)")
    .eq("player_id", playerId).gte("events.starts_at", since).eq("events.kind", "training").is("events.deleted_at", null);
  const rows = (data ?? []).map((r) => ({ status: r.status, reason: r.reason, event: r.events! }))
    .sort((a, b) => b.event.starts_at.localeCompare(a.event.starts_at));
  return {
    total: rows.filter((r) => r.status !== "injured").length,
    present: rows.filter((r) => r.status === "present" || r.status === "late").length,
    absences: rows.filter((r) => r.status === "absent" || r.status === "injured"),
  };
}

/** Meciurile din sezonul curent: apariții, minute, goluri, galbene. */
export async function playerSeasonStats(db: Db, playerId: string, seasonStart: string) {
  const since = new Date(Date.parse(seasonStart)).toISOString();
  const [squad, events, susp] = await Promise.all([
    db.from("match_squad").select("minutes, matches!inner(status, events!inner(starts_at))")
      .eq("player_id", playerId).eq("matches.status", "finished").gte("matches.events.starts_at", since),
    db.from("match_events").select("kind, matches!inner(events!inner(starts_at))")
      .eq("player_id", playerId).in("kind", ["goal", "yellow", "red"]).gte("matches.events.starts_at", since),
    db.from("suspensions").select("reason, matches_remaining").eq("player_id", playerId).gt("matches_remaining", 0),
  ]);
  const played = (squad.data ?? []).filter((s) => (s.minutes ?? 0) > 0);
  return {
    apps: played.length,
    minutes: played.reduce((a, s) => a + (s.minutes ?? 0), 0),
    goals: (events.data ?? []).filter((e) => e.kind === "goal").length,
    yellows: (events.data ?? []).filter((e) => e.kind === "yellow").length,
    suspensions: susp.data ?? [],
  };
}

export async function listTeamsWithCoaches(db: Db, clubId: string) {
  const [groups, staff, counts] = await Promise.all([
    db.from("groups").select("*").eq("club_id", clubId).order("sort").order("name"),
    db.from("staff_groups").select("group_id, profiles(full_name, role, is_active)"),
    db.from("players").select("group_id").eq("is_active", true).is("anonymized_at", null),
  ]);
  const coaches = new Map<string, string[]>();
  for (const s of staff.data ?? []) {
    const p = s.profiles;
    if (!p || !p.is_active || p.role !== "coach") continue;
    coaches.set(s.group_id, [...(coaches.get(s.group_id) ?? []), p.full_name]);
  }
  const n = new Map<string, number>();
  for (const p of counts.data ?? []) if (p.group_id) n.set(p.group_id, (n.get(p.group_id) ?? 0) + 1);
  return (groups.data ?? []).map((g) => ({ ...g, coaches: coaches.get(g.id) ?? [], players: n.get(g.id) ?? 0 }));
}

export async function listGuardians(db: Db, q?: string) {
  const { data, error } = await db.from("guardians")
    .select("id, full_name, phone, email, notes, user_id, guardian_players(player_id, relation, is_billing, players(id, display_name, full_name, group_id))")
    .is("deleted_at", null).order("full_name");
  if (error) throw error;
  let rows = data ?? [];
  if (q) {
    const n = (s: string | null) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, "");
    const needle = n(q);
    rows = rows.filter((g) => n(g.full_name).includes(needle) || n(g.phone).includes(needle) ||
      g.guardian_players.some((gp) => n(gp.players?.full_name ?? "").includes(needle)));
  }
  return rows;
}
