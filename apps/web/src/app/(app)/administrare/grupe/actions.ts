"use server";
import { z } from "zod";
import { fail, run } from "@/lib/actions";
import type { Session } from "@/lib/auth";
import { getT } from "@/messages";

const t = getT().admin;
// grupele apar în aproape toate ecranele: reîmprospătăm tot
const PATHS = ["/", "/administrare/grupe"];
const Name = z.string().trim().min(1, t.errors.nameNeeded).max(40);

async function groupOf({ db, ctx }: Session, id: string) {
  const { data, error } = await db.from("groups").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data || data.club_id !== ctx.club.id) fail(t.errors.groupNotFound);
  return data;
}

async function playerCounts({ db }: Session, groupId: string) {
  const { data, error } = await db.from("players").select("id, is_active").eq("group_id", groupId);
  if (error) throw error;
  return { total: data.length, active: data.filter((p) => p.is_active).length };
}

export async function createGroup(input: { name: string }) {
  return run({ roles: ["physio", "admin"], revalidate: PATHS, message: t.groups.created }, async ({ db, ctx }) => {
    const name = Name.parse(input.name);
    if (ctx.groups.some((g) => g.name.toLowerCase() === name.toLowerCase())) fail(t.errors.groupExists);
    const sort = Math.max(0, ...ctx.groups.map((g) => g.sort)) + 1;
    const { error } = await db.from("groups").insert({ club_id: ctx.club.id, name, sort });
    if (error) throw error;
  });
}

const Update = z.object({
  id: z.uuid(),
  name: Name,
  reminderHour: z.number().int().min(0).max(23).nullable(),
  wellness: z.object({ sleep: z.boolean(), stress: z.boolean(), mood: z.boolean() }),
  coachIds: z.array(z.uuid()).max(50),
  isActive: z.boolean(),
});

export async function updateGroup(input: z.infer<typeof Update>) {
  return run({ roles: ["physio", "admin"], revalidate: PATHS, message: t.groups.saved }, async (session) => {
    const { db, ctx } = session;
    const v = Update.parse(input);
    const group = await groupOf(session, v.id);
    if (ctx.groups.some((g) => g.id !== group.id && g.name.toLowerCase() === v.name.toLowerCase())) fail(t.errors.groupExists);
    if (group.is_active && !v.isActive && (await playerCounts(session, group.id)).active > 0) fail(t.errors.groupHasPlayers);

    const { error } = await db.from("groups").update({
      name: v.name, reminder_hour: v.reminderHour, wellness_config: v.wellness, is_active: v.isActive,
    }).eq("id", group.id);
    if (error) throw error;

    // antrenorii grupei: doar conturi de antrenor ale clubului (RLS verifică și ea clubul)
    const { data: coaches, error: coachError } = await db.from("profiles").select("id").eq("role", "coach");
    if (coachError) throw coachError;
    const allowed = new Set(coaches.map((c) => c.id));
    const wanted = [...new Set(v.coachIds)].filter((id) => allowed.has(id));
    const { data: current, error: currentError } = await db.from("staff_groups").select("user_id").eq("group_id", group.id);
    if (currentError) throw currentError;
    const have = new Set(current.map((c) => c.user_id));
    const remove = [...have].filter((id) => !wanted.includes(id));
    const add = wanted.filter((id) => !have.has(id));
    if (remove.length) {
      const { error: e } = await db.from("staff_groups").delete().eq("group_id", group.id).in("user_id", remove);
      if (e) throw e;
    }
    if (add.length) {
      const { error: e } = await db.from("staff_groups").insert(add.map((user_id) => ({ user_id, group_id: group.id })));
      if (e) throw e;
    }
  });
}

/** Mută grupa cu o poziție și renumerotează ordinea tuturor grupelor. */
export async function moveGroup(input: { id: string; direction: "up" | "down" }) {
  return run({ roles: ["physio", "admin"], revalidate: PATHS }, async ({ db, ctx }) => {
    const v = z.object({ id: z.uuid(), direction: z.enum(["up", "down"]) }).parse(input);
    const order = [...ctx.groups].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "ro"));
    const i = order.findIndex((g) => g.id === v.id);
    const j = v.direction === "up" ? i - 1 : i + 1;
    if (i < 0) fail(t.errors.groupNotFound);
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    for (const [index, g] of order.entries()) {
      if (g.sort === index + 1) continue;
      const { error } = await db.from("groups").update({ sort: index + 1 }).eq("id", g.id);
      if (error) throw error;
    }
  });
}

/** Ștergerea este posibilă doar pentru o grupă în care nu a fost niciodată trecut un jucător aflat în evidență. */
export async function deleteGroup(input: { id: string }) {
  return run({ roles: ["physio", "admin"], revalidate: PATHS, message: t.groups.deleted }, async (session) => {
    const v = z.object({ id: z.uuid() }).parse(input);
    const group = await groupOf(session, v.id);
    if ((await playerCounts(session, group.id)).total > 0) fail(t.errors.groupNotEmpty);
    const { error } = await session.db.from("groups").delete().eq("id", group.id);
    if (error) throw error;
  });
}
