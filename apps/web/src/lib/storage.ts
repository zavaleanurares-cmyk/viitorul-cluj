import "server-only";
import type { Db } from "@club/shared";

export type Bucket = "medical" | "exercise-media" | "avatars" | "branding";

/** Link semnat, cu expirare. Întoarce null dacă utilizatorul nu are drept de citire (RLS pe storage). */
export async function signedUrl(db: Db, bucket: Bucket, path: string | null | undefined, expiresInSeconds = 3600): Promise<string | null> {
  if (!path) return null;
  const { data } = await db.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  return data?.signedUrl ?? null;
}

export async function signedUrls(db: Db, bucket: Bucket, paths: Array<string | null | undefined>, expiresInSeconds = 3600): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  const out: Record<string, string> = {};
  await Promise.all(
    unique.map(async (p) => {
      const url = await signedUrl(db, bucket, p, expiresInSeconds);
      if (url) out[p] = url;
    }),
  );
  return out;
}

/** Nume de fișier sigur pentru o cale din storage. */
export function safeFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) : "";
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).toLowerCase() || "fisier";
  return ext ? `${base}.${ext}` : base;
}
