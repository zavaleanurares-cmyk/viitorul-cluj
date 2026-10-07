import { type NextRequest } from "next/server";
import { exportSession, fileName, fileResponse, plain } from "@/components/reports/http";
import { getPlayerSheet } from "@/components/reports/data";
import { buildPlayerSheetPdf } from "@/components/reports/player-sheet";
import { getT } from "@/messages";

/** Fișa jucătorului (PDF). Doar preparatorul; un jucător din alt club nu se găsește (RLS) → 404. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const t = getT().reports;
  const session = await exportSession(request);
  if (session instanceof Response) return session;
  const { db, ctx } = session;
  const { id } = await params;
  try {
    const sheet = await getPlayerSheet(db, ctx, id);
    if (!sheet) return plain(t.errors.notFound, 404);
    const pdf = await buildPlayerSheetPdf(sheet, ctx);
    await db.rpc("log_event", { p_action: "EXPORT", p_entity: "fisa", p_details: { player_id: sheet.player.id, format: "pdf" } });
    return fileResponse(pdf, fileName([t.sheet.fileName, sheet.player.display_name, ctx.today], "pdf"), "pdf");
  } catch (e) {
    console.error("[rapoarte] fișa jucătorului:", (e as Error).message);
    return plain(t.errors.failed, 500);
  }
}
