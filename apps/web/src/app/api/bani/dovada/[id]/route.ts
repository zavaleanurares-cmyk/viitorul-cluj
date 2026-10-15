import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { fileResponse, plain } from "@/components/reports/http";
import { paymentProofPdf } from "@/components/money/documents";

export const dynamic = "force-dynamic";

/** Dovada unei plăți (orice mod de plată), în PDF: biroul financiar sau familia (RLS pe payments). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/autentificare", request.nextUrl.origin), 303);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return plain("Plată necunoscută.", 404);
  const doc = await paymentProofPdf(session.db, id);
  if (!doc) return plain("Plată necunoscută.", 404);
  return fileResponse(doc.bytes, doc.name, "pdf");
}
