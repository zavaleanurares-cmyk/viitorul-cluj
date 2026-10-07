"use server";
import { z } from "zod";
import { run, fail } from "@/lib/actions";
import { deleteFiles } from "@/lib/storage";
import { getT } from "@/messages";
import { DOCUMENT_KIND_CODES, mustSeePlayer, removeDocument, verifyUploadedDocument } from "@/components/players/server";
import { valid } from "@/components/players/validation";

const t = getT().players;
const e = t.errors;

const SaveInput = z.object({
  playerId: z.uuid(),
  /** calea din depozit la care browserul a încărcat deja fișierul: <player_id>/<uuid>-<nume-sigur> */
  path: z.string().min(40).max(200),
  title: z.string().trim().min(1, e.docTitleRequired).max(200, e.tooLong(200)),
  kind: z.enum(DOCUMENT_KIND_CODES),
  injuryId: z.union([z.uuid(), z.literal("")]).nullish().transform((v) => v || null),
});

/**
 * Pasul 2 al încărcării: fișierul este deja în depozit (dreptul de scriere l-a verificat ruta de
 * încărcare); aici se scrie rândul din `medical_documents`, fără de care fișierul nu poate fi citit.
 */
export async function saveDocument(input: z.input<typeof SaveInput>) {
  return run({ roles: ["physio"], message: t.docs.saved }, async ({ db, ctx }) => {
    const v = valid(SaveInput, input);
    await mustSeePlayer(db, v.playerId);
    const file = await verifyUploadedDocument(v.playerId, v.path);
    try {
      if (v.injuryId) {
        const { data: injury } = await db.from("injuries").select("id, player_id").eq("id", v.injuryId).maybeSingle();
        if (!injury || injury.player_id !== v.playerId) fail(e.injuryNotFound);
      }
      const { data, error } = await db.from("medical_documents").insert({
        player_id: v.playerId,
        injury_id: v.injuryId,
        title: v.title,
        kind: v.kind,
        storage_path: v.path,
        mime_type: file.mimeType,
        size_bytes: file.size,
        uploaded_by: ctx.userId,
      }).select("id").single();
      if (error) throw error;
      return { id: data.id };
    } catch (err) {
      // rândul nu s-a scris: nu lăsăm fișierul fără stăpân (dacă rândul există deja — 23505 — fișierul este al lui)
      if ((err as { code?: string })?.code !== "23505") await deleteFiles(db, "medical", [v.path]).catch(() => 0);
      throw err;
    }
  });
}

const IdInput = z.object({ documentId: z.uuid() });

/** Șterge fișierul, apoi rândul. Partenerul medical poate șterge doar documentele încărcate de el (RLS). */
export async function deleteDocument(input: z.input<typeof IdInput>) {
  return run({ roles: ["physio", "medical_partner"], message: t.docs.deleted }, async ({ db }) => {
    const v = valid(IdInput, input);
    await removeDocument(db, v.documentId);
    return { id: v.documentId };
  });
}
