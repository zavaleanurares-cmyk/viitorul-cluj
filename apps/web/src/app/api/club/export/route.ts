import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { can } from "@club/shared";
import { getSession } from "@/lib/auth";
import { presignedReadUrl, putFile, storageMode } from "@/lib/files";
import { buildClubExport } from "@/components/admin/club-export";
import { getT } from "@/messages";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Un răspuns direct are cel mult ~4 MB pe Vercel; peste, arhiva trece prin depozit și se descarcă printr-o adresă semnată. */
const DIRECT_LIMIT = 4 * 1024 * 1024;

/** Exportul complet al datelor clubului (ZIP cu un CSV pe tabel). Doar administrarea clubului; exportul se jurnalizează. */
export async function GET() {
  const t = getT().admin.errors;
  const session = await getSession();
  if (!session) return NextResponse.json({ eroare: t.sessionExpired }, { status: 401 });
  const { db, ctx } = session;
  if (!can(ctx.role, "administerClub")) return NextResponse.json({ eroare: t.forbidden }, { status: 403 });

  const out = await buildClubExport({ userId: ctx.userId, clubId: ctx.club.id, clubName: ctx.club.name, who: ctx.profile.full_name, today: ctx.today });
  await db.rpc("log_event", { p_action: "EXPORT", p_entity: "clubs", p_details: { entity_id: ctx.club.id, tables: out.tables.length, rows: out.tables.reduce((s, x) => s + x.rows, 0) } });

  const filename = `date-${ctx.club.slug}-${ctx.today}.zip`;
  if (out.zip.length > DIRECT_LIMIT && storageMode() === "blob") {
    const path = `${ctx.club.id}/${ctx.today}-${crypto.randomUUID()}.zip`;
    await putFile("exports", path, Buffer.from(out.zip), "application/zip");
    const url = await presignedReadUrl("exports", path, 15 * 60);
    if (url) return NextResponse.redirect(url, { status: 303, headers: { "Cache-Control": "no-store" } });
  }
  return new NextResponse(Buffer.from(out.zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
