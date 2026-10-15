import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { fileResponse, plain } from "@/components/reports/http";
import { purchaseRequestPdf } from "@/components/money/documents";

export const dynamic = "force-dynamic";

/** Referatul în PDF: autorul, aprobatorii și biroul (RLS pe purchase_requests). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/autentificare", request.nextUrl.origin), 303);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return plain("Referat necunoscut.", 404);
  const doc = await purchaseRequestPdf(session.db, id);
  if (!doc) return plain("Referat necunoscut.", 404);
  return fileResponse(doc.bytes, doc.name, "pdf");
}
