import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { BUCKETS, canAccess, isBucket, isSafePath, presignedReadUrl, putFile, readFile, storageMode } from "@/lib/files";

type Params = { params: Promise<{ bucket: string; path: string[] }> };

const deny = (status: number, message: string) => NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store" } });

/**
 * Servește un fișier privat. Verificarea se face aici, la fiecare cerere:
 * sesiune validă + dreptul de citire dat de funcția SQL `file_access` (sub RLS).
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { bucket, path: segments } = await params;
  const path = segments.map(decodeURIComponent).join("/");
  if (!isBucket(bucket) || !isSafePath(path)) return deny(404, "Fișier inexistent.");
  const session = await getSession();
  if (!session) return deny(401, "Autentificare necesară.");
  if (!(await canAccess(session.db, bucket, path, "read"))) return deny(404, "Fișier inexistent.");

  if (bucket === "medical") {
    await session.db.rpc("log_event", { p_action: "DOWNLOAD", p_entity: "medical_documents", p_details: { player_id: path.split("/")[0], path } });
  }
  const download = request.nextUrl.searchParams.get("download") === "1";

  // clipurile: adresă semnată, valabilă 5 minute (browserul poate derula în clip)
  if (bucket === "exercise-media" && !download) {
    const url = await presignedReadUrl(bucket, path, 300);
    if (url) return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "private, no-store" } });
  }
  const file = await readFile(bucket, path);
  if (!file) return deny(404, "Fișier inexistent.");
  const name = path.split("/").pop()!;
  const headers: Record<string, string> = {
    "Content-Type": file.contentType,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
  };
  // PDF-urile se deschid în vizualizatorul browserului, care nu pornește sub `sandbox`;
  // restul tipurilor (imagini etc.) rămân izolate.
  if (file.contentType !== "application/pdf") headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
  if (file.size !== null) headers["Content-Length"] = String(file.size);
  return new NextResponse(file.stream, { headers });
}

/**
 * Încărcare directă prin server (corpul cererii = fișierul). Folosită în dezvoltare și,
 * în producție, doar pentru fișiere mici; cele mari urcă direct în depozit (vezi /api/files/upload).
 */
export async function PUT(request: NextRequest, { params }: Params) {
  const { bucket, path: segments } = await params;
  const path = segments.map(decodeURIComponent).join("/");
  if (!isBucket(bucket) || !isSafePath(path)) return deny(400, "Cale invalidă.");
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) return deny(403, "Origine nepermisă.");
  const session = await getSession();
  if (!session) return deny(401, "Autentificare necesară.");
  if (storageMode() === "none") return deny(503, "Depozitul de fișiere nu este configurat.");
  if (!(await canAccess(session.db, bucket, path, "write"))) return deny(403, "Nu ai dreptul să încarci acest fișier.");

  const rules = BUCKETS[bucket];
  const type = (request.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!(rules.types as readonly string[]).includes(type)) return deny(415, "Tip de fișier nepermis.");
  const body = Buffer.from(await request.arrayBuffer());
  if (!body.length) return deny(400, "Fișier gol.");
  if (body.length > rules.maxBytes) return deny(413, "Fișierul este prea mare.");
  await putFile(bucket, path, body, type);
  return NextResponse.json({ ok: true, path });
}
