import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getT } from "@/messages";

/**
 * „Descarcă datele mele" (GDPR, dreptul de acces): fișier JSON cu tot ce ține clubul despre utilizator.
 * RPC-ul `export_player_data` fără argument întoarce doar datele apelantului și scrie exportul în jurnalul de audit.
 */
export async function GET() {
  const t = getT().player.errors;
  const session = await getSession();
  if (!session) return NextResponse.json({ eroare: t.sessionExpired }, { status: 401 });
  const { db, ctx } = session;
  const { data, error } = await db.rpc("export_player_data");
  if (error || !data) return NextResponse.json({ eroare: t.exportFailed }, { status: 500 });
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="datele-mele-${ctx.today}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
