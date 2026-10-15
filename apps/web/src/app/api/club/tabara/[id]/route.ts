import { NextResponse, type NextRequest } from "next/server";
import { can, formatDate, formatDateTime } from "@club/shared";
import { getSession } from "@/lib/auth";
import { fileResponse, plain } from "@/components/reports/http";
import { Report } from "@/components/reports/pdf";
import { getT } from "@/messages";

export const dynamic = "force-dynamic";

/** Lista participanților confirmați, pentru organizatori (doar biroul). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/autentificare", request.nextUrl.origin), 303);
  if (!can(session.ctx.role, "manageCamps")) return plain("Acces interzis.", 403);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return plain("Tabără necunoscută.", 404);
  const { db, ctx } = session;
  const t = getT().club.camps;
  const { data: c } = await db.from("camps").select("title, starts_on, ends_on, location").eq("id", id).maybeSingle();
  if (!c) return plain("Tabără necunoscută.", 404);
  const { data: regs } = await db.from("camp_registrations").select("child_name, birth_date, parent_name, parent_phone, parent_email, notes, player_id, players(group_id)")
    .eq("camp_id", id).eq("status", "confirmed").order("child_name");
  const pids = (regs ?? []).map((r) => r.player_id).filter(Boolean) as string[];
  const { data: gps } = pids.length ? await db.from("guardian_players").select("player_id, is_billing, guardians(full_name, phone, email)").in("player_id", pids) : { data: [] };
  const family = (pid: string | null) => {
    const g = (gps ?? []).filter((x) => x.player_id === pid).sort((a, b) => Number(b.is_billing) - Number(a.is_billing))[0]?.guardians as { full_name: string; phone: string | null; email: string | null } | null | undefined;
    return g ? [g.full_name, g.phone, g.email] : [];
  };
  const doc = await Report.create({
    club: ctx.club.name, title: t.pdf.title(c.title),
    subtitle: [t.dates(formatDate(c.starts_on), formatDate(c.ends_on)), c.location].filter(Boolean).join(" · "),
    generated: formatDateTime(new Date().toISOString(), ctx.settings.timezone), footer: t.pdf.title(c.title), pageLabel: (n, total) => `${n} / ${total}`, landscape: true,
  });
  const team = (gid: string | null | undefined) => ctx.groups.find((g) => g.id === gid)?.name ?? "";
  doc.table(
    [{ header: t.pdf.cols.n, width: 0.05, align: "right" }, { header: t.pdf.cols.child, width: 0.25 }, { header: t.pdf.cols.born, width: 0.1 },
     { header: t.pdf.cols.contact, width: 0.28 }, { header: t.pdf.cols.notes, width: 0.32 }],
    (regs ?? []).map((r, i) => [
      i + 1,
      { text: `${r.child_name}${r.player_id ? ` (${team((r.players as { group_id: string | null } | null)?.group_id)})` : ""}`, bold: true },
      r.birth_date?.slice(0, 4) ?? "",
      (r.player_id ? family(r.player_id) : [r.parent_name, r.parent_phone, r.parent_email]).filter(Boolean).join(" · "),
      r.notes ?? "",
    ]),
    { empty: "—" },
  );
  const safe = c.title.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").slice(0, 60);
  return fileResponse(await doc.bytes(), `Participanti-${safe}.pdf`, "pdf");
}
