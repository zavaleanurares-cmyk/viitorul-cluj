import "server-only";
import type { Db } from "@club/shared";
import { canAccess, removeFiles, type Bucket } from "./files";

export type { Bucket } from "./files";

/**
 * Adresa de la care browserul poate cere un fișier. Nu este publică: ruta /api/files verifică
 * sesiunea și dreptul de citire la FIECARE cerere, apoi servește fișierul (sau trimite către o
 * adresă semnată, valabilă câteva minute).
 */
export function fileUrl(bucket: Bucket, path: string | null | undefined, opts: { download?: boolean } = {}): string | null {
  if (!path) return null;
  return `/api/files/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}${opts.download ? "?download=1" : ""}`;
}

/** Compatibilitate: aceeași adresă ca `fileUrl`. (Parametrii `db` și durata nu mai sunt necesari.) */
export async function signedUrl(_db: Db, bucket: Bucket, path: string | null | undefined, _expiresInSeconds?: number): Promise<string | null> {
  return fileUrl(bucket, path);
}

export async function signedUrls(_db: Db, bucket: Bucket, paths: Array<string | null | undefined>): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const p of paths) if (p) out[p] = fileUrl(bucket, p)!;
  return out;
}

/** Șterge fișiere din depozit, după ce verifică dreptul utilizatorului pentru fiecare. Întoarce câte a șters. */
export async function deleteFiles(db: Db, bucket: Bucket, paths: Array<string | null | undefined>): Promise<number> {
  const allowed: string[] = [];
  for (const p of paths) if (p && (await canAccess(db, bucket, p, "delete"))) allowed.push(p);
  await removeFiles(bucket, allowed);
  return allowed.length;
}

/** Nume de fișier sigur pentru o cale din depozit. */
export function safeFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) : "";
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).toLowerCase() || "fisier";
  return ext ? `${base}.${ext}` : base;
}
