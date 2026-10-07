import "server-only";
import { randomUUID } from "node:crypto";
import { getPlayer, type Db, type Player } from "@club/shared";
import { fail } from "@/lib/actions";
import { deleteFiles } from "@/lib/storage";
import { safeFileName, signedUrl } from "@/lib/storage";
import { getT } from "@/messages";
import { MEDICAL_FILE_MAX_BYTES, medicalMimeType } from "./domain";

const e = getT().players.errors;

/** Jucătorul, așa cum îl vede apelantul prin RLS; dacă nu îl vede, operațiunea se oprește. */
export async function mustSeePlayer(db: Db, playerId: string): Promise<Player> {
  const player = await getPlayer(db, playerId);
  if (!player) fail(e.playerNotFound);
  return player;
}

/** Calea din bucketul „medical" pentru un fișier nou: <player_id>/<uuid>-<nume-sigur>. */
export function newMedicalPath(playerId: string, fileName: string, size: number): { path: string; mimeType: string } {
  const mimeType = medicalMimeType(fileName);
  if (!mimeType) fail(e.docType);
  if (size <= 0) fail(e.docEmpty);
  if (size > MEDICAL_FILE_MAX_BYTES) fail(e.docSize);
  return { path: `${playerId}/${randomUUID()}-${safeFileName(fileName)}`, mimeType };
}

/**
 * Șterge un document: întâi obiectul din storage (politica de citire a bucketului depinde de
 * rândul din tabel, deci ordinea inversă ar lăsa fișierul fără stăpân), apoi rândul.
 */
export async function removeDocument(db: Db, documentId: string): Promise<{ playerId: string }> {
  const { data: doc } = await db.from("medical_documents").select("id, player_id, storage_path").eq("id", documentId).maybeSingle();
  if (!doc) fail(e.docNotFound);
  if ((await deleteFiles(db, "medical", [doc.storage_path])) === 0) fail(e.docForbidden);
  const { data: deleted, error } = await db.from("medical_documents").delete().eq("id", documentId).select("id");
  if (error) throw error;
  if (!deleted?.length) fail(e.docForbidden);
  return { playerId: doc.player_id };
}

/** Link semnat (expiră în 2 minute) + intrare în jurnalul de audit. */
export async function signedDocumentUrl(db: Db, documentId: string): Promise<string> {
  const { data: doc } = await db.from("medical_documents").select("id, player_id, storage_path").eq("id", documentId).maybeSingle();
  if (!doc) fail(e.docNotFound);
  const url = await signedUrl(db, "medical", doc.storage_path, 120);
  if (!url) fail(e.docUnavailable);
  await db.rpc("log_event", {
    p_action: "DOWNLOAD",
    p_entity: "medical_documents",
    p_details: { player_id: doc.player_id, document_id: doc.id },
  });
  return url;
}
