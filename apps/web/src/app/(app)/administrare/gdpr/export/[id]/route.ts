import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getT } from "@/messages";

/**
 * „Descarcă datele" unui jucător (dreptul de acces / portabilitate), pentru preparator.
 * RPC-ul `export_player_data` verifică dreptul apelantului asupra jucătorului și scrie exportul în jurnal.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = getT().admin.errors;
  const { id } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ eroare: t.sessionExpired }, { status: 401 });
  if (session.ctx.role !== "physio" || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ eroare: t.forbidden }, { status: 403 });
  const { data, error } = await session.db.rpc("export_player_data", { p_player: id });
  if (error || !data) return NextResponse.json({ eroare: t.exportFailed }, { status: error?.code === "42501" ? 403 : 500 });
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="date-jucator-${id.slice(0, 8)}-${session.ctx.today}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
