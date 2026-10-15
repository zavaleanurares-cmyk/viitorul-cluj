"use server";
import { z } from "zod";
import { fail, run } from "@/lib/actions";

const RUNNERS = ["admin", "secretary", "sporting_director", "physio", "coach"] as const;
const paths = (id: string) => [`/program/${id}`, `/program/${id}/meci`, "/program", "/azi"];

const SquadRows = z.array(z.object({
  player_id: z.uuid(),
  role: z.enum(["starter", "sub"]),
  slot: z.number().int().min(0).max(10).nullable(),
  is_captain: z.boolean(),
})).max(40);

export async function saveSquad(input: { eventId: string; formation: string; rows: z.input<typeof SquadRows> }) {
  const id = z.uuid().parse(input.eventId);
  return run({ roles: [...RUNNERS], revalidate: paths(id) }, async ({ db }) => {
    const rows = SquadRows.parse(input.rows);
    const { error } = await db.rpc("save_match_squad", { p_event: id, p_formation: z.string().max(20).parse(input.formation), p_rows: rows });
    if (error) fail(error.message);
    return null;
  });
}

const EventInput = z.object({
  minute: z.number().int().min(0).max(150),
  kind: z.enum(["goal", "goal_against", "own_goal", "yellow", "red", "sub"]),
  player_id: z.uuid().nullable().optional(),
  related_player_id: z.uuid().nullable().optional(),
});

export async function addMatchEvent(input: { eventId: string; event: z.input<typeof EventInput> }) {
  const id = z.uuid().parse(input.eventId);
  return run<string>({ roles: [...RUNNERS], revalidate: paths(id) }, async ({ db }) => {
    const e = EventInput.parse(input.event);
    const { data, error } = await db.rpc("add_match_event", { p_event: id, p: e });
    if (error) fail(error.message);
    return data as string;
  });
}

export async function deleteMatchEvent(input: { eventId: string; id: string }) {
  const eventId = z.uuid().parse(input.eventId);
  return run({ roles: [...RUNNERS], revalidate: paths(eventId) }, async ({ db }) => {
    const { error } = await db.rpc("delete_match_event", { p_id: z.uuid().parse(input.id) });
    if (error) fail(error.message);
    return null;
  });
}

export async function closeMatch(input: { eventId: string; ratings: Record<string, number>; report?: string }) {
  const id = z.uuid().parse(input.eventId);
  return run({ roles: [...RUNNERS], revalidate: paths(id) }, async ({ db }) => {
    const ratings = z.record(z.uuid(), z.number().int().min(1).max(5)).parse(input.ratings);
    const { error } = await db.rpc("close_match", { p_event: id, p_ratings: ratings, p_report: z.string().max(4000).optional().parse(input.report) ?? null });
    if (error) fail(error.message);
    return null;
  });
}

export async function reopenMatch(eventId: string) {
  const id = z.uuid().parse(eventId);
  return run({ roles: ["admin", "secretary", "sporting_director", "physio"], revalidate: paths(id) }, async ({ db }) => {
    const { error } = await db.rpc("reopen_match", { p_event: id });
    if (error) fail(error.message);
    return null;
  });
}
