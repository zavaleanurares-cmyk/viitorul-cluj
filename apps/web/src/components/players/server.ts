import "server-only";
import { DOCUMENT_KINDS, getPlayer, type Db, type Player } from "@club/shared";
import { fail } from "@/lib/actions";
import { readFile } from "@/lib/files";
import { deleteFiles } from "@/lib/storage";
import { getT } from "@/messages";
import { MEDICAL_FILE_MAX_BYTES, medicalMimeType } from "./domain";

const e = getT().players.errors;

/** Jucătorul, așa cum îl vede apelantul prin RLS; dacă nu îl vede, operațiunea se oprește. */
export async function mustSeePlayer(db: Db, playerId: string): Promise<Player> {
  const player = await getPlayer(db, playerId);
  if (!player) fail(e.playerNotFound);
  return player;
}

export const DOCUMENT_KIND_CODES = Object.keys(DOCUMENT_KINDS) as [string, ...string[]];

const UPLOADED_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}-[a-z0-9][a-z0-9.-]*$/;

/**
 * Verifică un fișier abia încărcat în depozitul „medical", înainte să i se scrie rândul în tabel.
 * Calea vine din browser, deci nu avem încredere în ea: trebuie să fie în directorul jucătorului
 * (altfel rândul ar deschide accesul la fișierul altcuiva), cu extensie permisă, iar fișierul
 * trebuie să existe efectiv în depozit.
 */
export async function verifyUploadedDocument(playerId: string, path: string): Promise<{ mimeType: string; size: number | null }> {
  if (!UPLOADED_PATH.test(path) || !path.startsWith(`${playerId}/`)) fail(e.invalid);
  const mimeType = medicalMimeType(path);
  if (!mimeType) fail(e.docType);
  const stored = await readFile("medical", path);
  if (!stored) fail(e.docUnavailable);
  await stored.stream.cancel().catch(() => {});
  if (stored.size !== null) {
    if (stored.size <= 0) fail(e.docEmpty);
    if (stored.size > MEDICAL_FILE_MAX_BYTES) fail(e.docSize);
  }
  return { mimeType, size: stored.size };
}

/**
 * Șterge un document: întâi fișierul din depozit (dreptul de ștergere se verifică pe rândul din
 * tabel, deci ordinea inversă ar lăsa fișierul fără stăpân), apoi rândul.
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
