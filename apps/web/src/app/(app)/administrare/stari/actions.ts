"use server";
import { z } from "zod";
import { DEFAULT_STATUS_CODES, norm } from "@club/shared";
import { fail, run } from "@/lib/actions";
import type { Session } from "@/lib/auth";
import { getT } from "@/messages";

const t = getT().admin;
const PATHS = ["/administrare/stari"];
const DEFAULTS: readonly string[] = DEFAULT_STATUS_CODES;

const Fields = z.object({
  label: z.string().trim().min(2, t.errors.statusLabelNeeded).max(40),
  shortLabel: z.string().trim().min(2, t.errors.statusShortNeeded).max(14, t.errors.statusShortLong),
  tone: z.enum(["green", "yellow", "orange", "red", "gray", "blue"]),
  icon: z.enum(["check", "battery", "activity", "cross", "help", "circle", "alert"]),
  availability: z.enum(["full", "limited", "out"]),
});

async function statusOf({ db, ctx }: Session, id: string) {
  const { data, error } = await db.from("club_statuses").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data || data.club_id !== ctx.club.id) fail(t.errors.statusNotFound);
  return data;
}

async function usage({ db }: Session, id: string) {
  const [now, past] = await Promise.all([
    db.from("players").select("id", { count: "exact", head: true }).eq("status_id", id),
    db.from("status_history").select("id", { count: "exact", head: true }).eq("status_id", id),
  ]);
  if (now.error) throw now.error;
  if (past.error) throw past.error;
  return (now.count ?? 0) + (past.count ?? 0);
}

export async function createStatus(input: z.infer<typeof Fields>) {
  return run({ roles: ["physio", "admin"], revalidate: PATHS, message: t.statuses.created }, async ({ db, ctx }) => {
    const v = Fields.parse(input);
    // codul se generează din etichetă și nu se mai schimbă
    const base = norm(v.label).replace(/ /g, "_").slice(0, 30) || "STARE";
    const taken = new Set(ctx.statuses.map((s) => s.code));
    let code = base;
    for (let n = 2; taken.has(code); n++) code = `${base}_${n}`;
    const sort = Math.max(0, ...ctx.statuses.map((s) => s.sort)) + 1;
    const { error } = await db.from("club_statuses").insert({
      club_id: ctx.club.id, code, label: v.label, short_label: v.shortLabel, tone: v.tone, icon: v.icon, availability: v.availability, sort,
    });
    if (error) throw error;
  });
}

const Update = Fields.extend({ id: z.uuid(), isActive: z.boolean() });

export async function updateStatus(input: z.infer<typeof Update>) {
  return run({ roles: ["physio", "admin"], revalidate: PATHS, message: t.statuses.saved }, async (session) => {
    const v = Update.parse(input);
    const status = await statusOf(session, v.id);
    if (!v.isActive && DEFAULTS.includes(status.code)) fail(t.errors.statusDefaultLocked);
    const { error } = await session.db.from("club_statuses").update({
      label: v.label, short_label: v.shortLabel, tone: v.tone, icon: v.icon, availability: v.availability, is_active: v.isActive,
    }).eq("id", status.id);
    if (error) throw error;
  });
}

export async function moveStatus(input: { id: string; direction: "up" | "down" }) {
  return run({ roles: ["physio", "admin"], revalidate: PATHS }, async ({ db, ctx }) => {
    const v = z.object({ id: z.uuid(), direction: z.enum(["up", "down"]) }).parse(input);
    const order = [...ctx.statuses].sort((a, b) => a.sort - b.sort);
    const i = order.findIndex((s) => s.id === v.id);
    const j = v.direction === "up" ? i - 1 : i + 1;
    if (i < 0) fail(t.errors.statusNotFound);
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    for (const [index, s] of order.entries()) {
      if (s.sort === index + 1) continue;
      const { error } = await db.from("club_statuses").update({ sort: index + 1 }).eq("id", s.id);
      if (error) throw error;
    }
  });
}

/** O stare care a fost dată vreodată unui jucător nu se șterge (istoricul ar rămâne fără ea): se dezactivează. */
export async function deleteStatus(input: { id: string }) {
  return run({ roles: ["physio", "admin"], revalidate: PATHS, message: t.statuses.deleted }, async (session) => {
    const v = z.object({ id: z.uuid() }).parse(input);
    const status = await statusOf(session, v.id);
    if (DEFAULTS.includes(status.code)) fail(t.errors.statusDefaultLocked);
    if ((await usage(session, status.id)) > 0) fail(t.errors.statusInUse);
    const { error } = await session.db.from("club_statuses").delete().eq("id", status.id);
    if (error) throw error;
  });
}
