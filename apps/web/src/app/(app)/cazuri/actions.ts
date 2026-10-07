"use server";
import { z } from "zod";
import { DOCUMENT_KINDS } from "@club/shared";
import { run, fail } from "@/lib/actions";
import { getT } from "@/messages";
import { getMyCase } from "@/components/players/queries";
import { newMedicalPath } from "@/components/players/server";
import { valid } from "@/components/players/validation";

const t = getT().partner;
const e = getT().players.errors;

const NoteInput = z.object({
  referralId: z.uuid(),
  note: z.string().trim().min(2, t.errNoteRequired).max(4000, e.tooLong(4000)),
});

export async function addCaseNote(input: z.input<typeof NoteInput>) {
  return run({ roles: ["medical_partner"], message: t.noteSaved }, async ({ db, ctx }) => {
    const v = valid(NoteInput, input);
    const referral = await getMyCase(db, ctx.userId, v.referralId);
    if (!referral) fail(t.errCaseNotFound);
    const { error } = await db.from("partner_notes").insert({ referral_id: referral.id, author_id: ctx.userId, note: v.note });
    if (error) throw error;
    return { id: referral.id };
  });
}

const IdInput = z.object({ id: z.uuid() });

export async function deleteCaseNote(input: z.input<typeof IdInput>) {
  return run({ roles: ["medical_partner"], message: t.noteDeleted }, async ({ db, ctx }) => {
    const v = valid(IdInput, input);
    const { data, error } = await db.from("partner_notes").delete().eq("id", v.id).eq("author_id", ctx.userId).select("id");
    if (error) throw error;
    if (!data?.length) fail(e.notSaved);
    return { id: v.id };
  });
}

const KINDS = Object.keys(DOCUMENT_KINDS) as [string, ...string[]];
const RegisterInput = z.object({
  referralId: z.uuid(),
  fileName: z.string().min(1).max(300),
  size: z.number().int().nonnegative(),
  title: z.string().trim().min(1, e.docTitleRequired).max(200, e.tooLong(200)),
  kind: z.enum(KINDS),
});

/**
 * Document încărcat de partener pe un caz: jucătorul și accidentarea vin din trimitere, nu din formular.
 * Vezi `registerDocument` din fișa jucătorului pentru ordinea rând → fișier.
 */
export async function registerCaseDocument(input: z.input<typeof RegisterInput>) {
  return run({ roles: ["medical_partner"] }, async ({ db, ctx }) => {
    const v = valid(RegisterInput, input);
    const referral = await getMyCase(db, ctx.userId, v.referralId);
    if (!referral) fail(t.errCaseNotFound);
    const { path, mimeType } = newMedicalPath(referral.player_id, v.fileName, v.size);
    const { data, error } = await db.from("medical_documents").insert({
      player_id: referral.player_id,
      injury_id: referral.injury_id,
      title: v.title,
      kind: v.kind,
      storage_path: path,
      mime_type: mimeType,
      size_bytes: v.size,
      uploaded_by: ctx.userId,
    }).select("id").single();
    if (error) throw error;
    return { id: data.id, path, mimeType };
  });
}
