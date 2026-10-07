import { type NextRequest } from "next/server";
import { listPlayers } from "@club/shared";
import { exportSession, fileName, fileResponse, plain } from "@/components/reports/http";
import { buildRosterXlsx } from "@/components/reports/roster";
import { getT } from "@/messages";

/** Lista de jucători cu starea curentă (Excel): toate grupele sau `?grupa=<id>`. Doar preparatorul. */
export async function GET(request: NextRequest) {
  const t = getT().reports;
  const session = await exportSession(request);
  if (session instanceof Response) return session;
  const { db, ctx } = session;
  const groupId = request.nextUrl.searchParams.get("grupa");
  const group = groupId && groupId !== "toate" ? ctx.groups.find((g) => g.id === groupId) : null;
  if (groupId && groupId !== "toate" && !group) return plain(t.errors.notFound, 404);
  try {
    const players = await listPlayers(db, { groupId: group?.id ?? null });
    const xlsx = await buildRosterXlsx(players, ctx);
    await db.rpc("log_event", {
      p_action: "EXPORT", p_entity: "lista_jucatori",
      p_details: { group_id: group?.id ?? null, group: group?.name ?? null, players: players.length, format: "xlsx" },
    });
    return fileResponse(xlsx, fileName([t.list.fileName, group?.name, ctx.today], "xlsx"), "xlsx");
  } catch (e) {
    console.error("[rapoarte] lista de jucători:", (e as Error).message);
    return plain(t.errors.failed, 500);
  }
}
