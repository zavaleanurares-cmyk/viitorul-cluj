"use server";
import { z } from "zod";
import { run, fail } from "@/lib/actions";
import { getT } from "@/messages";

const t = getT().club.messages;
const SENDERS = ["admin", "secretary", "sporting_director", "physio", "coach"] as const;
const Audience = z.object({
  audiences: z.array(z.enum(["guardians", "players", "coaches", "staff"])).min(1),
  group_ids: z.array(z.uuid()).max(40),
  exclude_user_ids: z.array(z.uuid()).max(2000),
});

export async function previewAudience(input: z.input<typeof Audience>) {
  return run({ roles: [...SENDERS] }, async ({ db }) => {
    const a = Audience.parse(input);
    const { data, error } = await db.rpc("preview_message_audience", { p_audience: { ...a, exclude_user_ids: [] } });
    if (error) throw error;
    return (data ?? []) as Array<{ user_id: string; full_name: string; role: string; reason: string }>;
  });
}

const Send = z.object({
  title: z.string().trim().min(2).max(140),
  body: z.string().trim().min(1).max(5000),
  audience: Audience,
  scheduledAt: z.string().datetime({ offset: true }).nullish(),
});

export async function sendMessage(input: z.input<typeof Send>) {
  return run({ roles: [...SENDERS], revalidate: ["/club/mesaje"] }, async ({ db }) => {
    const v = Send.safeParse(input);
    if (!v.success) fail(t.errors.invalid);
    if (v.data.scheduledAt && new Date(v.data.scheduledAt) < new Date(Date.now() - 60000)) fail(t.errors.past);
    const { data, error } = await db.rpc("send_message", { p: { title: v.data.title, body: v.data.body, audience: v.data.audience, scheduled_at: v.data.scheduledAt ?? null } });
    if (error) throw error;
    return data as { id: string; recipients: number };
  });
}

export async function cancelMessage(input: { id: string }) {
  return run({ roles: [...SENDERS], revalidate: ["/club/mesaje"], message: t.cancelled }, async ({ db }) => {
    const { error } = await db.rpc("cancel_message", { p_id: z.uuid().parse(input.id) });
    if (error) throw error;
    return null;
  });
}

const Tpl = z.object({ name: z.string().trim().min(2).max(80), title: z.string().trim().min(2).max(140), body: z.string().trim().min(1).max(5000) });

export async function saveTemplate(input: z.input<typeof Tpl>) {
  return run({ roles: ["admin", "secretary", "sporting_director"], revalidate: ["/club/mesaje/nou"], message: t.templateSaved }, async ({ db, ctx }) => {
    const v = Tpl.parse(input);
    const { error } = await db.from("message_templates").insert({ club_id: ctx.club.id, name: v.name, title: v.title, body: v.body, created_by: ctx.userId });
    if (error) throw error;
    return null;
  });
}

export async function markRead(input: { id: string }) {
  return run({ roles: ["admin", "secretary", "sporting_director", "physio", "coach", "accountant", "owner", "guardian", "player", "medical_partner"], revalidate: [] }, async ({ db }) => {
    await db.rpc("mark_message_read", { p_id: z.uuid().parse(input.id) });
    return null;
  });
}
