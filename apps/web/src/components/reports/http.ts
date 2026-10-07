import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { norm } from "@club/shared";
import { getSession, type Session } from "@/lib/auth";
import { getT } from "@/messages";

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export function plain(message: string, status: number): NextResponse {
  return new NextResponse(message, { status, headers: { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8" } });
}

/**
 * Verificarea comună a rutelor de export: sesiune validă, cont activat, rol de preparator.
 * Fără sesiune → pagina de autentificare; orice alt rol → 403. Datele se citesc apoi cu clientul
 * utilizatorului, deci RLS rămâne ultima linie de apărare.
 */
export async function exportSession(request: NextRequest): Promise<Session | NextResponse> {
  const session = await getSession();
  if (!session) {
    const url = new URL("/autentificare", request.nextUrl.origin);
    return NextResponse.redirect(url, { status: 303, headers: NO_STORE });
  }
  const pending = session.ctx.profile.must_change_password || !session.hasPassword || !session.ctx.consentAccepted;
  if (pending || session.ctx.role !== "physio") return plain(getT().reports.errors.forbidden, 403);
  return session;
}

/** Nume de fișier fără diacritice și fără spații: „fisa-popescu-a-2026-10-07.pdf". */
export function fileName(parts: Array<string | null | undefined>, ext: "pdf" | "xlsx"): string {
  const slug = parts.filter(Boolean).map((p) => norm(p).toLowerCase().replace(/ +/g, "-")).filter(Boolean).join("-");
  return `${slug || "raport"}.${ext}`;
}

const TYPES = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

export function fileResponse(bytes: Uint8Array, name: string, ext: "pdf" | "xlsx"): NextResponse {
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      ...NO_STORE,
      "Content-Type": TYPES[ext],
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `attachment; filename="${name}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
