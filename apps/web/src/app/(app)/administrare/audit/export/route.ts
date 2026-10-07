import { NextResponse, type NextRequest } from "next/server";
import { ROLE_LABELS, formatDateTime, label } from "@club/shared";
import { getSession } from "@/lib/auth";
import { AUDIT_EXPORT_LIMIT, auditActions, auditEntities, describeDetails, fetchAudit, lineText, loadAuditLookups, parseAuditFilters } from "@/components/admin/audit";
import { getT } from "@/messages";

const cell = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Exportul CSV al jurnalului, cu aceleași filtre ca pagina. Doar preparatorul; exportul însuși se jurnalizează. */
export async function GET(request: NextRequest) {
  const t = getT().admin.audit;
  const session = await getSession();
  if (!session) return NextResponse.json({ eroare: getT().admin.errors.sessionExpired }, { status: 401 });
  const { db, ctx } = session;
  if (ctx.role !== "physio") return NextResponse.json({ eroare: getT().admin.errors.forbidden }, { status: 403 });

  const f = parseAuditFilters(Object.fromEntries(request.nextUrl.searchParams));
  const lookups = await loadAuditLookups(db, ctx);
  const actions = auditActions();
  const entities = auditEntities();
  const lines: string[][] = [[t.colWhen, t.colWho, t.csvRole, t.action, t.entity, t.player, t.colDetails]];
  for (let from = 0; from < AUDIT_EXPORT_LIMIT; from += 1000) {
    const { rows } = await fetchAudit(db, f, ctx.settings.timezone, from, from + 999);
    for (const r of rows) {
      const actor = r.actor_id ? lookups.profiles.get(r.actor_id) : null;
      const role = actor?.role ?? r.actor_role;
      lines.push([
        formatDateTime(r.created_at, ctx.settings.timezone),
        actor?.name ?? (r.actor_id ? t.deletedAccount : t.system),
        role && role !== "system" ? label(ROLE_LABELS, role) : "",
        actions[r.action] ?? r.action,
        entities[r.entity] ?? r.entity,
        r.player_id ? lookups.players.get(r.player_id) ?? t.deletedPlayer : "",
        describeDetails(r, lookups).map(lineText).join(" | "),
      ]);
    }
    if (rows.length < 1000) break;
  }
  await db.rpc("log_event", { p_action: "EXPORT", p_entity: "audit_log", p_details: { rows: lines.length - 1 } });

  // BOM + separator „;": se deschide corect în Excel cu setări regionale românești
  const csv = "﻿" + lines.map((l) => l.map(cell).join(";")).join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="jurnal-audit-${ctx.today}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
