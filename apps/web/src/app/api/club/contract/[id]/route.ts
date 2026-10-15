import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { fileResponse, plain } from "@/components/reports/http";
import { contractPdf } from "@/components/club/contract-pdf";

export const dynamic = "force-dynamic";

/** Contractul în PDF: biroul sau semnatarul (RLS pe contracts). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/autentificare", request.nextUrl.origin), 303);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return plain("Document necunoscut.", 404);
  const doc = await contractPdf(session.db, id, session.ctx.settings.timezone);
  if (!doc) return plain("Document necunoscut.", 404);
  return fileResponse(doc.bytes, doc.name, "pdf");
}
