"use client";
import { uploadPresigned } from "@vercel/blob/client";

export type UploadBucket = "medical" | "exercise-media" | "avatars" | "branding" | "finance" | "visas" | "videos" | "contracts" | "shop" | "site" | "messages";

let modePromise: Promise<"blob" | "local" | "none"> | null = null;
function storageMode() {
  modePromise ??= fetch("/api/files/config").then((r) => r.json()).then((j) => j.mode).catch(() => "local");
  return modePromise;
}

const SMALL = 4 * 1024 * 1024; // sub limita de corp a unei funcții Vercel

async function putThroughServer(bucket: UploadBucket, path: string, file: Blob): Promise<string | null> {
  const res = await fetch(`/api/files/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (res.ok) return null;
  const j = await res.json().catch(() => null);
  return j?.error ?? "Încărcarea a eșuat.";
}

/**
 * Încarcă un fișier în depozitul privat, la `<bucket>/<path>`.
 * Dreptul de scriere este verificat pe server (sesiune + regulile din baza de date).
 * După încărcare, o acțiune de server trebuie să scrie rândul corespunzător în tabel.
 *
 *   const res = await uploadFile("medical", `${playerId}/${crypto.randomUUID()}-${safeName}`, file);
 *   if (!res.ok) toast(res.error, "error");
 */
export async function uploadFile(
  bucket: UploadBucket,
  path: string,
  file: Blob,
  opts: { onProgress?: (percent: number) => void } = {},
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  try {
    const mode = await storageMode();
    if (mode === "none") return { ok: false, error: "Depozitul de fișiere nu este configurat." };
    if (mode === "blob") {
      try {
        await uploadPresigned(`${bucket}/${path}`, file, {
          access: "private",
          handleUploadUrl: "/api/files/upload",
          contentType: file.type || undefined,
          multipart: file.size > 20 * 1024 * 1024,
          onUploadProgress: (e) => opts.onProgress?.(Math.round(e.percentage)),
        });
        return { ok: true, path };
      } catch (e) {
        // fișierele mici pot trece și prin server
        if (file.size > SMALL) return { ok: false, error: (e as Error).message || "Încărcarea a eșuat." };
      }
    }
    const error = await putThroughServer(bucket, path, file);
    if (error) return { ok: false, error };
    opts.onProgress?.(100);
    return { ok: true, path };
  } catch {
    return { ok: false, error: "Nu s-a putut contacta serverul. Verifică conexiunea." };
  }
}

/** Nume de fișier sigur pentru o cale din depozit (aceeași regulă ca pe server). */
export function safeFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) : "";
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).toLowerCase() || "fisier";
  return ext ? `${base}.${ext}` : base;
}
