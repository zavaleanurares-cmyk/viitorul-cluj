import { unwrap, type AppContext, type Db } from "@club/shared";
import { isTemplateMapping } from "./prepare";
import type { ImportContext, ImportKind, ImportRecord, ImportTemplate, KnownFile, ReportRow } from "./types";

/** Tot ce are nevoie asistentul: jucătorii clubului, potrivirile memorate, testele, șabloanele și fișierele deja importate. */
export async function loadImportContext(db: Db, ctx: AppContext): Promise<ImportContext> {
  const [players, remembered, tests, templates, known] = await Promise.all([
    db.from("players").select("id, display_name, full_name, group_id").eq("is_active", true).is("anonymized_at", null).order("display_name"),
    db.from("name_matches").select("source_name, group_id, player_id"),
    db.from("fitness_tests").select("id, code, name, unit").eq("is_active", true).order("sort"),
    db.from("import_templates").select("id, name, mapping").eq("kind", "physical").order("name"),
    db.from("imports").select("file_hash, kind, filename, created_at").not("file_hash", "is", null).order("created_at", { ascending: false }).limit(500),
  ]);
  return {
    today: ctx.today,
    timezone: ctx.settings.timezone,
    groups: ctx.groups.filter((g) => g.is_active).map((g) => ({ id: g.id, name: g.name, sort: g.sort })),
    statuses: ctx.statuses.map((s) => ({ code: s.code, label: s.label, short_label: s.short_label, tone: s.tone, icon: s.icon })),
    players: unwrap(players),
    remembered: unwrap(remembered),
    tests: unwrap(tests),
    templates: unwrap(templates).filter((t): t is typeof t & ImportTemplate => isTemplateMapping(t.mapping)),
    knownFiles: unwrap(known) as KnownFile[],
  };
}

const IMPORT_COLUMNS = "id, kind, filename, created_at, rows_imported, rows_skipped, rows_flagged, profiles(full_name)";

export type ImportListItem = Omit<ImportRecord, "report">;

type ImportRowBase = {
  id: string; kind: string; filename: string | null; created_at: string;
  rows_imported: number; rows_skipped: number; rows_flagged: number; profiles: { full_name: string } | null;
};

function toItem(r: ImportRowBase): ImportListItem {
  return {
    id: r.id, kind: r.kind as ImportKind, filename: r.filename, created_at: r.created_at,
    rows_imported: r.rows_imported, rows_skipped: r.rows_skipped, rows_flagged: r.rows_flagged,
    created_by_name: r.profiles?.full_name ?? null,
  };
}

/** Istoricul importurilor, cele mai noi primele. */
export async function listImports(db: Db, limit = 50): Promise<ImportListItem[]> {
  const rows = unwrap(await db.from("imports").select(IMPORT_COLUMNS).order("created_at", { ascending: false }).limit(limit));
  return (rows as unknown as ImportRowBase[]).map(toItem);
}

/** Un import cu raportul lui detaliat. */
export async function getImport(db: Db, id: string): Promise<ImportRecord | null> {
  const { data, error } = await db.from("imports").select(`${IMPORT_COLUMNS}, report`).eq("id", id).maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as ImportRowBase & { report: unknown };
  const report = (row.report && typeof row.report === "object" ? row.report : {}) as Record<string, unknown>;
  return { ...toItem(row), report: { ...report, rows: Array.isArray(report.rows) ? (report.rows as ReportRow[]) : [] } };
}
