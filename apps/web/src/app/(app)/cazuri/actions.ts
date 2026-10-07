"use server";
import { z } from "zod";
import { run, fail } from "@/lib/actions";
import { getT } from "@/messages";
import { getMyCase } from "@/components/players/queries";
import { DOCUMENT_KIND_CODES, verifyUploadedDocument } from "@/components/players/server";
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

const SaveInput = z.object({
  referralId: z.uuid(),
  /** calea din depozit la care browserul a încărcat deja fișierul: <player_id>/<uuid>-<nume-sigur> */
  path: z.string().min(40).max(200),
  title: z.string().trim().min(1, e.docTitleRequired).max(200, e.tooLong(200)),
  kind: z.enum(DOCUMENT_KIND_CODES),
});

/**
 * Document încărcat de partener pe un caz: jucătorul și accidentarea vin din trimitere, nu din formular.
 * Fișierul este deja în depozit; aici se scrie rândul care îl face vizibil.
 */
export async function saveCaseDocument(input: z.input<typeof SaveInput>) {
  return run({ roles: ["medical_partner"], message: getT().players.docs.saved }, async ({ db, ctx }) => {
    const v = valid(SaveInput, input);
    const referral = await getMyCase(db, ctx.userId, v.referralId);
    if (!referral) fail(t.errCaseNotFound);
    const file = await verifyUploadedDocument(referral.player_id, v.path);
    const { data, error } = await db.from("medical_documents").insert({
      player_id: referral.player_id,
      injury_id: referral.injury_id,
      title: v.title,
      kind: v.kind,
      storage_path: v.path,
      mime_type: file.mimeType,
      size_bytes: file.size,
      uploaded_by: ctx.userId,
    }).select("id").single();
    if (error) throw error;
    return { id: data.id };
  });
}
