import { NextResponse } from "next/server";
import { issueSignedToken } from "@vercel/blob";
import { handleUploadPresigned, type HandleUploadPresignedBody } from "@vercel/blob/client";
import { getSession } from "@/lib/auth";
import { BUCKETS, canAccess, isBucket, isSafePath, storageMode } from "@/lib/files";
import { DEMO_MAX_UPLOAD, isDemoClub } from "@/lib/demo";

/**
 * Încărcare directă din browser în Vercel Blob (fișiere mari: documente, clipuri).
 * Serverul nu primește fișierul; el doar verifică sesiunea și dreptul de scriere și eliberează
 * o adresă de încărcare semnată, valabilă 10 minute, limitată la calea, tipul și mărimea permise.
 */
export async function POST(request: Request) {
  if (storageMode() !== "blob") return NextResponse.json({ error: "Încărcarea directă nu este disponibilă în acest mediu." }, { status: 400 });
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) return NextResponse.json({ error: "Origine nepermisă." }, { status: 403 });
  const body = (await request.json()) as HandleUploadPresignedBody;
  try {
    const result = await handleUploadPresigned({
      body,
      request,
      getSignedToken: async (pathname) => {
        const slash = pathname.indexOf("/");
        const bucket = pathname.slice(0, slash);
        const path = pathname.slice(slash + 1);
        if (slash < 0 || !isBucket(bucket) || !isSafePath(path)) throw new Error("Cale invalidă.");
        const session = await getSession();
        if (!session) throw new Error("Autentificare necesară.");
        if (!(await canAccess(session.db, bucket, path, "write"))) throw new Error("Nu ai dreptul să încarci acest fișier.");
        const rules = BUCKETS[bucket];
        const validUntil = Date.now() + 10 * 60 * 1000;
        const token = await issueSignedToken({
          pathname, operations: ["put"], validUntil,
          allowedContentTypes: [...rules.types], maximumSizeInBytes: isDemoClub(session.ctx.club) ? Math.min(rules.maxBytes, DEMO_MAX_UPLOAD) : rules.maxBytes,
        });
        return { token, urlOptions: { allowOverwrite: true, addRandomSuffix: false, validUntil } };
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
