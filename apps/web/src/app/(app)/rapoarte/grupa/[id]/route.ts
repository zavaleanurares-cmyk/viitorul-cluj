import { type NextRequest } from "next/server";
import { weekStart } from "@club/shared";
import { exportSession, fileName, fileResponse, plain } from "@/components/reports/http";
import { getWeeklyReport, parseWeek } from "@/components/reports/data";
import { buildWeeklyPdf, buildWeeklyXlsx } from "@/components/reports/weekly";
import { getT } from "@/messages";

/**
 * Raportul săptămânal al unei grupe: `?saptamana=AAAA-LL-ZZ` (orice zi din săptămână; implicit cea curentă)
 * și `?format=pdf|xlsx` (implicit PDF). Doar preparatorul.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const t = getT().reports;
  const session = await exportSession(request);
  if (session instanceof Response) return session;
  const { db, ctx } = session;
  const { id } = await params;
  const sp = request.nextUrl.searchParams;
  const format = sp.get("format") === "xlsx" ? "xlsx" : "pdf";
  const monday = parseWeek(sp.get("saptamana"), ctx.today, weekStart);
  if (!monday) return plain(t.errors.badWeek, 400);
  try {
    const report = await getWeeklyReport(db, ctx, id, monday);
    if (!report) return plain(t.errors.notFound, 404);
    const bytes = format === "xlsx" ? await buildWeeklyXlsx(report, ctx) : await buildWeeklyPdf(report, ctx);
    await db.rpc("log_event", {
      p_action: "EXPORT", p_entity: "raport_saptamanal",
      p_details: { group_id: report.group.id, group: report.group.name, week: monday, format, players: report.players.length },
    });
    return fileResponse(bytes, fileName([t.week.fileName, report.group.name, monday], format), format);
  } catch (e) {
    console.error("[rapoarte] raport săptămânal:", (e as Error).message);
    return plain(t.errors.failed, 500);
  }
}
