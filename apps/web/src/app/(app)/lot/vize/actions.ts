"use server";
import { z } from "zod";
import { run, fail } from "@/lib/actions";
import { getT } from "@/messages";

const t = getT().performance.visas;
const PATHS = ["/lot/vize", "/azi", "/lot", "layout:/lot/jucatori/[id]"];
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const Submit = z.object({
  playerId: z.uuid(),
  path: z.string().min(10).max(300),
  fileName: z.string().max(200),
  mime: z.string().max(100),
  size: z.number().int().nonnegative(),
  issuedOn: date.nullish(),
});

/** Părintele, jucătorul adult sau biroul trimite documentul încărcat spre verificare. */
export async function submitVisaDocument(input: z.input<typeof Submit>) {
  return run({ roles: ["guardian", "player", "admin", "secretary", "physio"], revalidate: PATHS, message: t.uploaded }, async ({ db }) => {
    const v = Submit.parse(input);
    if (!v.path.startsWith(`${v.playerId}/`)) fail(t.errors.badFile);
    const { data, error } = await db.rpc("submit_visa_document", {
      p_player: v.playerId, p_path: v.path, p_file_name: v.fileName, p_mime: v.mime, p_size: v.size, p_issued_on: v.issuedOn ?? undefined,
    });
    if (error) throw error;
    return { id: data as string };
  });
}

const Decide = z.object({
  id: z.uuid(),
  approve: z.boolean(),
  validUntil: date.nullish(),
  issuedOn: date.nullish(),
  reason: z.string().max(500).nullish(),
});

export async function decideVisaDocument(input: z.input<typeof Decide>) {
  return run({ roles: ["admin", "secretary", "physio"], revalidate: PATHS, message: input.approve ? t.approved : t.rejected }, async ({ db }) => {
    const v = Decide.parse(input);
    if (!v.approve && !v.reason?.trim()) fail(t.errors.reasonRequired);
    const { error } = await db.rpc("decide_visa_document", {
      p_id: v.id, p_approve: v.approve, p_valid_until: v.validUntil ?? undefined, p_issued_on: v.issuedOn ?? undefined, p_reason: v.reason ?? undefined,
    });
    if (error) throw error;
    return null;
  });
}

export async function sendVisaReminders(input: { playerIds: string[] }) {
  return run({ roles: ["admin", "secretary", "physio"], revalidate: [] }, async ({ db }) => {
    const ids = z.array(z.uuid()).max(500).parse(input.playerIds);
    const { data, error } = await db.rpc("send_visa_reminders", { p_players: ids });
    if (error) throw error;
    return { sent: (data as number) ?? 0 };
  });
}
