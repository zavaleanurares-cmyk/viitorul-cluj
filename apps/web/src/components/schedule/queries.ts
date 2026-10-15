import "server-only";
import { addDays, type Db } from "@club/shared";

export type CalendarEvent = {
  id: string;
  kind: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: string;
  notes: string | null;
  series_id: string | null;
  attendance_saved_at: string | null;
  venue: { id: string; name: string } | null;
  groupIds: string[];
  match: {
    goals_for: number; goals_against: number; status: string; is_home: boolean; round: string | null;
    opponent: string | null; competition: string | null; competition_id: string | null;
  } | null;
};

const EVENT_COLUMNS =
  "id, kind, title, starts_at, ends_at, status, notes, series_id, attendance_saved_at, venues(id, name), event_teams(group_id), " +
  "matches(goals_for, goals_against, status, is_home, round, competition_id, opponents(name), competitions(name))";

type Raw = {
  id: string; kind: string; title: string; starts_at: string; ends_at: string; status: string; notes: string | null;
  series_id: string | null; attendance_saved_at: string | null;
  venues: { id: string; name: string } | null;
  event_teams: Array<{ group_id: string }>;
  matches: {
    goals_for: number; goals_against: number; status: string; is_home: boolean; round: string | null; competition_id: string | null;
    opponents: { name: string } | null; competitions: { name: string } | null;
  } | null;
};

function shape(r: Raw): CalendarEvent {
  return {
    id: r.id, kind: r.kind, title: r.title, starts_at: r.starts_at, ends_at: r.ends_at, status: r.status, notes: r.notes,
    series_id: r.series_id, attendance_saved_at: r.attendance_saved_at, venue: r.venues,
    groupIds: (r.event_teams ?? []).map((t) => t.group_id),
    match: r.matches ? {
      goals_for: r.matches.goals_for, goals_against: r.matches.goals_against, status: r.matches.status, is_home: r.matches.is_home,
      round: r.matches.round, opponent: r.matches.opponents?.name ?? null, competition: r.matches.competitions?.name ?? null,
      competition_id: r.matches.competition_id,
    } : null,
  };
}

/** Evenimentele dintr-un interval de zile [from, to] (inclusiv), în ordine cronologică. */
export async function listEvents(db: Db, opts: { from: string; to: string; timezone: string; groupIds?: string[] | null; kind?: string | null }): Promise<CalendarEvent[]> {
  // marginile intervalului în UTC, cu o zi în plus de fiecare parte (fusul orar)
  const start = new Date(Date.parse(addDays(opts.from, -1))).toISOString();
  const end = new Date(Date.parse(addDays(opts.to, 2))).toISOString();
  let q = db.from("events").select(EVENT_COLUMNS).is("deleted_at", null).gte("starts_at", start).lt("starts_at", end).order("starts_at");
  if (opts.kind) q = q.eq("kind", opts.kind);
  const { data, error } = await q;
  if (error) throw error;
  const rows = ((data ?? []) as unknown as Raw[]).map(shape);
  const local = (ts: string) => new Intl.DateTimeFormat("en-CA", { timeZone: opts.timezone }).format(new Date(ts));
  return rows.filter((e) => {
    const d = local(e.starts_at);
    if (d < opts.from || d > opts.to) return false;
    if (opts.groupIds && opts.groupIds.length && !e.groupIds.some((g) => opts.groupIds!.includes(g))) return false;
    return true;
  });
}

export async function getEvent(db: Db, id: string): Promise<CalendarEvent | null> {
  const { data, error } = await db.from("events").select(EVENT_COLUMNS).eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  return data ? shape(data as unknown as Raw) : null;
}

/** Evenimentele care ocupă același teren (sau un teren părinte/copil) în același interval. */
export async function venueConflicts(db: Db, venueId: string, startsAt: string, endsAt: string, excludeId?: string | null) {
  const { data: venues } = await db.from("venues").select("id, parent_id");
  const related = new Set<string>([venueId]);
  const me = (venues ?? []).find((v) => v.id === venueId);
  if (me?.parent_id) related.add(me.parent_id);
  for (const v of venues ?? []) if (v.parent_id === venueId) related.add(v.id);
  let q = db.from("events").select("id, title, starts_at, ends_at, venue_id")
    .is("deleted_at", null).neq("status", "cancelled").in("venue_id", [...related]).lt("starts_at", endsAt).gt("ends_at", startsAt);
  if (excludeId) q = q.neq("id", excludeId);
  const { data } = await q.limit(5);
  return data ?? [];
}

/** Lotul unui eveniment: jucătorii activi ai echipelor lui, cu starea și prezența salvată. */
export async function eventRoster(db: Db, eventId: string, groupIds: string[]) {
  if (!groupIds.length) return [];
  const [players, att] = await Promise.all([
    db.from("players").select("id, full_name, display_name, shirt_number, position, status_id, status_note, group_id, medical_visa_expires_on")
      .in("group_id", groupIds).eq("is_active", true).is("anonymized_at", null).order("shirt_number").order("display_name"),
    db.from("attendance").select("player_id, status, reason, note, recorded_at").eq("event_id", eventId),
  ]);
  const byPlayer = new Map((att.data ?? []).map((a) => [a.player_id, a]));
  return (players.data ?? []).map((p) => ({ ...p, attendance: byPlayer.get(p.id) ?? null }));
}

export async function listVenues(db: Db) {
  const { data } = await db.from("venues").select("*").order("sort").order("name");
  return data ?? [];
}

export async function listCompetitions(db: Db) {
  const { data } = await db.from("competitions").select("*, groups(name)").order("name");
  return data ?? [];
}

export async function listOpponents(db: Db) {
  const { data } = await db.from("opponents").select("id, name").order("name");
  return data ?? [];
}
