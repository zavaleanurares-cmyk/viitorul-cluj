import "server-only";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { del, get, issueSignedToken, presignUrl, put } from "@vercel/blob";
import type { Db } from "@club/shared";

/**
 * Depozitul de fișiere. În producție: Vercel Blob privat (fără adrese publice).
 * În dezvoltare, fără Blob configurat: un director local.
 * Calea unui fișier în depozit este `<bucket>/<cale>`; cine are voie să-l citească / scrie
 * hotărăște funcția SQL `file_access`, apelată cu identitatea utilizatorului.
 */
export const BUCKETS = {
  medical: {
    maxBytes: 25 * 1024 * 1024,
    types: ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "application/zip", "application/dicom"],
  },
  "exercise-media": {
    maxBytes: 100 * 1024 * 1024,
    types: ["video/mp4", "video/webm", "video/quicktime", "image/jpeg", "image/png", "image/webp", "image/gif"],
  },
  avatars: { maxBytes: 5 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp"] },
  branding: { maxBytes: 2 * 1024 * 1024, types: ["image/png", "image/webp", "image/jpeg"] },
  finance: { maxBytes: 10 * 1024 * 1024, types: ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"] },
  /** avizele medicale sportive: <jucător>/<fișier> */
  visas: { maxBytes: 10 * 1024 * 1024, types: ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"] },
  /** înregistrări video ale meciurilor și antrenamentelor: <club>/<fișier> */
  videos: { maxBytes: 4 * 1024 * 1024 * 1024, types: ["video/mp4", "video/webm", "video/quicktime"] },
} as const;

export type Bucket = keyof typeof BUCKETS;

export function isBucket(value: string): value is Bucket {
  return value in BUCKETS;
}

/** Căi sigure: segmente simple, fără „..", fără caractere de control. */
export function isSafePath(p: string): boolean {
  return p.length > 0 && p.length < 300 && p.split("/").every((s) => /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(s));
}

export function storageMode(): "blob" | "local" | "none" {
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) return "blob";
  return process.env.NODE_ENV === "production" && process.env.VERCEL ? "none" : "local";
}

const localRoot = () => process.env.LOCAL_FILES_DIR ?? path.resolve(process.cwd(), "../../tools/local-stack/.data/files");
const localFile = (bucket: Bucket, p: string) => path.join(localRoot(), bucket, ...p.split("/"));

export async function canAccess(db: Db, bucket: Bucket, p: string, action: "read" | "write" | "delete"): Promise<boolean> {
  if (!isSafePath(p)) return false;
  const { data } = await db.rpc("file_access", { p_bucket: bucket, p_path: p, p_action: action });
  return data === true;
}

export async function putFile(bucket: Bucket, p: string, body: Buffer | Blob | ReadableStream, contentType: string): Promise<void> {
  const mode = storageMode();
  if (mode === "blob") {
    await put(`${bucket}/${p}`, body as Blob, { access: "private", contentType, allowOverwrite: true, addRandomSuffix: false });
    return;
  }
  if (mode === "none") throw new Error("Depozitul de fișiere nu este configurat (Vercel Blob).");
  const file = localFile(bucket, p);
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(await new Response(body as Blob).arrayBuffer());
  await fs.promises.writeFile(file, buf);
  await fs.promises.writeFile(file + ".type", contentType);
}

export type StoredFile = { stream: ReadableStream; contentType: string; size: number | null };

export async function readFile(bucket: Bucket, p: string): Promise<StoredFile | null> {
  const mode = storageMode();
  if (mode === "blob") {
    const res = await get(`${bucket}/${p}`, { access: "private" });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    return { stream: res.stream as ReadableStream, contentType: res.blob.contentType ?? "application/octet-stream", size: res.blob.size ?? null };
  }
  if (mode === "none") return null;
  const file = localFile(bucket, p);
  try {
    const stat = await fs.promises.stat(file);
    const type = await fs.promises.readFile(file + ".type", "utf8").catch(() => "application/octet-stream");
    return { stream: Readable.toWeb(fs.createReadStream(file)) as ReadableStream, contentType: type, size: stat.size };
  } catch {
    return null;
  }
}

/** Adresă directă, semnată și cu expirare scurtă (doar Blob). Potrivită pentru clipuri: suportă derularea. */
export async function presignedReadUrl(bucket: Bucket, p: string, seconds = 300): Promise<string | null> {
  if (storageMode() !== "blob") return null;
  try {
    const pathname = `${bucket}/${p}`;
    const validUntil = Date.now() + seconds * 1000;
    const token = await issueSignedToken({ pathname, operations: ["get"], validUntil });
    const { presignedUrl } = await presignUrl(token, { operation: "get", pathname, access: "private", validUntil });
    return presignedUrl;
  } catch (e) {
    console.error("[fișiere] presemnare eșuată:", (e as Error).message);
    return null;
  }
}

export async function removeFiles(bucket: Bucket, paths: string[]): Promise<void> {
  const list = paths.filter(isSafePath);
  if (!list.length) return;
  if (storageMode() === "blob") {
    await del(list.map((p) => `${bucket}/${p}`));
    return;
  }
  for (const p of list) {
    await fs.promises.rm(localFile(bucket, p), { force: true });
    await fs.promises.rm(localFile(bucket, p) + ".type", { force: true });
  }
}
