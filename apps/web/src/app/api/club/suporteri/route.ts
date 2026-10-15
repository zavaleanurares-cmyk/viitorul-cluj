import { NextResponse, type NextRequest } from "next/server";
import { can } from "@club/shared";
import { getSession } from "@/lib/auth";
import { plain } from "@/components/reports/http";
import { getT } from "@/messages";

export const dynamic = "force-dynamic";

/** Lista formularelor 230 ale campaniei active (CSV, pentru borderoul de depunere). Fără CNP: nu îl avem. */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/autentificare", request.nextUrl.origin), 303);
  if (!can(session.ctx.role, "manageSupporters")) return plain("Acces interzis.", 403);
  const t = getT().club.supporters.pledges;
  const { data: c } = await session.db.from("support_campaigns").select("id, income_year").eq("is_active", true).maybeSingle();
  if (!c) return plain("Nicio campanie activă.", 404);
  const { data } = await session.db.from("support_pledges").select("full_name, email, phone, two_years, source, status, created_at, notes").eq("campaign_id", c.id).order("full_name");
  const esc = (x: unknown) => `"${String(x ?? "").replace(/"/g, '""')}"`;
  const lines = [["Nume", "E-mail", "Telefon", "2 ani", "Sursa", "Stare", "Data", "Note"].map(esc).join(";"),
    ...(data ?? []).map((r) => [r.full_name, r.email, r.phone, r.two_years ? "da" : "nu", t.source[r.source as "public"], t.status[r.status as "started"], r.created_at.slice(0, 10), r.notes].map(esc).join(";"))];
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="formulare-230-${c.income_year}.csv"`, "Cache-Control": "private, no-store" },
  });
}
