"use server";
import { z } from "zod";
import { formatEventWhen, zonedToUtc } from "@club/shared";
import { fail, run } from "@/lib/actions";
import { venueConflicts } from "@/components/schedule/queries";
import { getT } from "@/messages";

const t = getT().schedule;
const RUNNERS = ["admin", "secretary", "sporting_director", "physio", "coach"] as const;
const OFFICE = ["admin", "secretary", "sporting_director", "physio"] as const;
const PATHS = ["/program", "/azi"];

const Time = z.string().regex(/^\d{2}:\d{2}$/);
const EventInput = z.object({
  id: z.uuid().optional(),
  kind: z.enum(["training", "match", "booking", "meeting", "other"]),
  title: z.string().trim().max(120).optional(),
  date: z.iso.date(),
  start: Time,
  end: Time,
  venueId: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
  groupIds: z.array(z.uuid()).max(20),
  notes: z.string().trim().max(2000).optional(),
  repeat: z.object({ weekdays: z.array(z.number().int().min(1).max(7)).min(1), until: z.iso.date() }).nullable().optional(),
  match: z.object({
    opponentName: z.string().trim().max(120),
    competitionId: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
    round: z.string().trim().max(20).optional(),
    isHome: z.boolean(),
  }).nullable().optional(),
});
export type EventInput = z.input<typeof EventInput>;

function times(v: z.infer<typeof EventInput>, tz: string) {
  const startsAt = zonedToUtc(v.date, v.start, tz);
  let endsAt = zonedToUtc(v.date, v.end, tz);
  if (Date.parse(endsAt) <= Date.parse(startsAt)) fail(t.form.endBeforeStart);
  if (Date.parse(endsAt) - Date.parse(startsAt) > 10 * 3600000) endsAt = new Date(Date.parse(startsAt) + 10 * 3600000).toISOString();
  return { startsAt, endsAt };
}

/** Suprapunerile pe teren pentru formularul de eveniment (nu blochează salvarea). */
export async function checkVenue(input: { venueId: string; date: string; start: string; end: string; excludeId?: string | null }) {
  return run({ roles: [...RUNNERS] }, async ({ db, ctx }) => {
    if (!input.venueId) return [];
    const tz = ctx.settings.timezone;
    const startsAt = zonedToUtc(input.date, input.start, tz);
    const endsAt = zonedToUtc(input.date, input.end, tz);
    if (Date.parse(endsAt) <= Date.parse(startsAt)) return [];
    const rows = await venueConflicts(db, z.uuid().parse(input.venueId), startsAt, endsAt, input.excludeId ?? null);
    return rows.map((r) => t.form.conflict(r.title, formatEventWhen(r.starts_at, r.ends_at, tz, { weekday: false })));
  });
}

export async function saveEvent(input: EventInput) {
  const repeating = !input.id && !!input.repeat;
  return run<{ id: string }>({ roles: [...RUNNERS], revalidate: PATHS, message: input.id ? t.form.saved : repeating ? t.form.createdMany : t.form.created }, async ({ db, ctx }) => {
    const v = EventInput.parse(input);
    if (!v.groupIds.length && v.kind !== "booking" && v.kind !== "other") fail(t.form.needTeam);
    if (v.kind === "match" && !v.match?.opponentName) fail(t.form.needOpponent);
    const { startsAt, endsAt } = times(v, ctx.settings.timezone);
    const { data, error } = await db.rpc("save_event", {
      p: {
        id: v.id ?? null, kind: v.kind, title: v.title || null, starts_at: startsAt, ends_at: endsAt,
        venue_id: v.venueId, group_ids: v.groupIds, notes: v.notes || null,
        repeat: !v.id && v.repeat ? { weekdays: v.repeat.weekdays, until: v.repeat.until } : null,
        match: v.kind === "match" && v.match ? {
          opponent_name: v.match.opponentName, competition_id: v.match.competitionId, round: v.match.round || null, is_home: v.match.isHome,
        } : null,
      },
    });
    if (error) fail(error.message);
    return { id: data as string };
  });
}

const State = z.object({ id: z.uuid(), state: z.enum(["cancelled", "scheduled", "deleted", "restored"]), scope: z.enum(["one", "following"]) });

export async function setEventState(input: z.input<typeof State>) {
  return run<number>({ roles: [...RUNNERS], revalidate: PATHS }, async ({ db }) => {
    const v = State.parse(input);
    const { data, error } = await db.rpc("set_event_state", { p_event: v.id, p_state: v.state, p_scope: v.scope });
    if (error) fail(error.message);
    return (data as number) ?? 0;
  });
}

// ---------------------------------------------------------------------------
// Terenuri
// ---------------------------------------------------------------------------
const VenueInput = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(80),
  address: z.string().trim().max(200).optional(),
  surface: z.enum(["natural", "synthetic", "indoor", "other", ""]).transform((v) => v || null),
  hasLights: z.boolean(),
  isOwn: z.boolean(),
  parentId: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
});
export type VenueInput = z.input<typeof VenueInput>;

export async function saveVenue(input: VenueInput) {
  return run({ roles: [...OFFICE], revalidate: ["/program/terenuri"], message: input.id ? t.venues.saved : t.venues.created }, async ({ db, ctx }) => {
    const v = VenueInput.parse(input);
    if (v.id && v.parentId === v.id) fail("Un teren nu poate face parte din el însuși.");
    const row = { name: v.name, address: v.address || null, surface: v.surface, has_lights: v.hasLights, is_own: v.isOwn, parent_id: v.parentId };
    const res = v.id
      ? await db.from("venues").update(row).eq("id", v.id).select("id")
      : await db.from("venues").insert({ ...row, club_id: ctx.club.id }).select("id");
    if (res.error) throw res.error;
    return null;
  });
}

// ---------------------------------------------------------------------------
// Competiții și import
// ---------------------------------------------------------------------------
const CompetitionInput = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2).max(120),
  groupId: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
  source: z.enum(["frf", "ajf", "amfb", "manual"]),
  ownName: z.string().trim().max(120).optional(),
  halfMinutes: z.union([z.coerce.number().int().min(5).max(60), z.literal("")]).transform((v) => (v === "" ? null : v)).nullable(),
  yellowLimit: z.coerce.number().int().min(1).max(20),
});
export type CompetitionInput = z.input<typeof CompetitionInput>;

export async function saveCompetition(input: CompetitionInput) {
  return run<{ id: string }>({ roles: [...OFFICE], revalidate: ["/program/competitii"], message: input.id ? t.competitions.saved : t.competitions.created }, async ({ db, ctx }) => {
    const v = CompetitionInput.parse(input);
    const { data: season } = await db.from("seasons").select("id").eq("is_current", true).maybeSingle();
    const row = { name: v.name, group_id: v.groupId, source: v.source, own_name: v.ownName || null, half_minutes: v.halfMinutes, yellow_limit: v.yellowLimit };
    if (v.id) {
      const { error } = await db.from("competitions").update(row).eq("id", v.id);
      if (error) throw error;
      return { id: v.id };
    }
    const { data, error } = await db.from("competitions").insert({ ...row, club_id: ctx.club.id, season_id: season?.id ?? null }).select("id").single();
    if (error) throw error;
    return { id: data.id };
  });
}

const FixtureRow = z.object({
  round: z.string().max(20).optional(),
  starts_at: z.string(),
  home: z.string().max(120),
  away: z.string().max(120),
  venue: z.string().max(200).optional(),
  home_goals: z.string().max(3).optional(),
  away_goals: z.string().max(3).optional(),
});

export async function importFixtures(input: { competitionId: string; rows: Array<z.input<typeof FixtureRow>> }) {
  return run<{ created: number; updated: number; skipped: number }>({ roles: [...OFFICE], revalidate: ["/program", "/program/competitii"] }, async ({ db }) => {
    const id = z.uuid().parse(input.competitionId);
    const rows = z.array(FixtureRow).max(400).parse(input.rows);
    const { data, error } = await db.rpc("import_fixtures", { p_competition: id, p_rows: rows, p_duration_min: 120 });
    if (error) fail(error.message);
    return data as { created: number; updated: number; skipped: number };
  });
}

const StandingRow = z.object({
  position: z.coerce.number().int().min(1).max(60), team: z.string().max(120),
  played: z.coerce.number().int().min(0).max(99).optional(), won: z.coerce.number().int().min(0).max(99).optional(),
  drawn: z.coerce.number().int().min(0).max(99).optional(), lost: z.coerce.number().int().min(0).max(99).optional(),
  goals_for: z.coerce.number().int().min(0).max(999).optional(), goals_against: z.coerce.number().int().min(0).max(999).optional(),
  points: z.coerce.number().int().min(-99).max(999).optional(),
});

export async function importStandings(input: { competitionId: string; rows: Array<z.input<typeof StandingRow>> }) {
  return run<number>({ roles: [...OFFICE], revalidate: ["/program/competitii"] }, async ({ db }) => {
    const id = z.uuid().parse(input.competitionId);
    const rows = z.array(StandingRow).max(60).parse(input.rows);
    const { data, error } = await db.rpc("import_standings", { p_competition: id, p_rows: rows });
    if (error) fail(error.message);
    return data as number;
  });
}
