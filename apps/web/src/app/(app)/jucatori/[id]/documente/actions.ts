"use server";
import { z } from "zod";
import { DOCUMENT_KINDS } from "@club/shared";
import { run, fail } from "@/lib/actions";
import { getT } from "@/messages";
import { mustSeePlayer, newMedicalPath, removeDocument, signedDocumentUrl } from "@/components/players/server";
import { valid } from "@/components/players/validation";

const t = getT().players;
const e = t.errors;

const KINDS = Object.keys(DOCUMENT_KINDS) as [string, ...string[]];

const RegisterInput = z.object({
  playerId: z.uuid(),
  fileName: z.string().min(1).max(300),
  size: z.number().int().nonnegative(),
  title: z.string().trim().min(1, e.docTitleRequired).max(200, e.tooLong(200)),
  kind: z.enum(KINDS),
  injuryId: z.union([z.uuid(), z.literal("")]).nullish().transform((v) => v || null),
});

/**
 * Pasul 1 al încărcării: scrie rândul din `medical_documents` și întoarce calea la care browserul
 * urcă fișierul în bucketul privat. Dacă încărcarea eșuează, browserul apelează `deleteDocument`.
 * (Rândul întâi, fișierul apoi: un fișier fără rând nu ar mai putea fi nici citit, nici șters.)
 */
export async function registerDocument(input: z.input<typeof RegisterInput>) {
  return run({ roles: ["physio"] }, async ({ db, ctx }) => {
    const v = valid(RegisterInput, input);
    await mustSeePlayer(db, v.playerId);
    if (v.injuryId) {
      const { data: injury } = await db.from("injuries").select("id, player_id").eq("id", v.injuryId).maybeSingle();
      if (!injury || injury.player_id !== v.playerId) fail(e.injuryNotFound);
    }
    const { path, mimeType } = newMedicalPath(v.playerId, v.fileName, v.size);
    const { data, error } = await db.from("medical_documents").insert({
      player_id: v.playerId,
      injury_id: v.injuryId,
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

const IdInput = z.object({ documentId: z.uuid() });

/** Link semnat, valabil 2 minute; descărcarea se scrie în jurnalul de audit. */
export async function openDocument(input: z.input<typeof IdInput>) {
  return run({ roles: ["physio", "coach", "medical_partner"] }, async ({ db }) => {
    const v = valid(IdInput, input);
    return { url: await signedDocumentUrl(db, v.documentId) };
  });
}

export async function deleteDocument(input: z.input<typeof IdInput>) {
  return run({ roles: ["physio", "medical_partner"] }, async ({ db }) => {
    const v = valid(IdInput, input);
    await removeDocument(db, v.documentId);
    return { id: v.documentId };
  });
}
