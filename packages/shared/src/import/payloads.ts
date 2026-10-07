import { norm } from "../text";
import type { ParsedHealthSheet } from "./health";
import type { WellnessImportEntry } from "./fatigue";
import { isSummaryRow, parseSessionType, type ColumnMapping, type TabularRecord } from "./tabular";

/** Decizia preparatorului pentru un nume din fișier. */
export type NameDecision =
  | { action: "match"; player_id: string }
  | { action: "create" }
  | { action: "skip" };

export type ImportMeta = { filename: string | null; file_hash: string | null; mapping?: unknown };

/** Cheia unei decizii: numele normalizat + grupa (același nume poate exista în mai multe grupe). */
export function decisionKey(name: string, groupId: string | null): string {
  return `${groupId ?? "-"}|${norm(name)}`;
}

// ---------------------------------------------------------------------------
// Stare de sănătate
// ---------------------------------------------------------------------------
export function buildHealthPayload(args: {
  parsed: ParsedHealthSheet;
  /** grupa aleasă pentru fiecare bloc; null = blocul se sare */
  blockGroupIds: Array<string | null>;
  decisions: Record<string, NameDecision>;
  meta: ImportMeta;
}) {
  const rows = args.parsed.blocks.flatMap((block, b) => {
    const groupId = args.blockGroupIds[b] ?? null;
    return block.rows.map((r) => {
      const decision = groupId ? args.decisions[decisionKey(r.name, groupId)] ?? { action: "create" as const } : { action: "skip" as const };
      return {
        row: r.row,
        source_name: r.name,
        match_key: norm(r.name),
        group_id: groupId,
        action: decision.action === "match" ? "update" : decision.action,
        player_id: decision.action === "match" ? decision.player_id : null,
        display_name: r.name.trim(),
        status_code: r.status.code,
        status_note: r.note,
        zone: r.zone.zone,
        side: r.zone.side,
        zone_detail: r.zone.detail,
        zone_uncertain: r.zone.uncertain,
        needs_review: r.flagged,
        review_note: groupId ? r.reasons.join("; ") || null : "Bloc fără grupă aleasă",
      };
    });
  });
  return { filename: args.meta.filename, file_hash: args.meta.file_hash, mapping: args.meta.mapping ?? args.parsed.columns, rows };
}

// ---------------------------------------------------------------------------
// Chestionare (grila săptămânală)
// ---------------------------------------------------------------------------
export function buildWellnessPayload(args: {
  entries: WellnessImportEntry[];
  namesWithoutData: Array<{ row: number; name: string }>;
  groupId: string | null;
  decisions: Record<string, NameDecision>;
  meta: ImportMeta;
}) {
  const decide = (name: string) => args.decisions[decisionKey(name, args.groupId)] ?? { action: "skip" as const };
  const base = (row: number, name: string) => {
    const d = decide(name);
    return {
      row,
      source_name: name,
      match_key: norm(name),
      group_id: args.groupId,
      action: d.action === "match" ? "update" : d.action,
      player_id: d.action === "match" ? d.player_id : null,
    };
  };
  const rows = [
    ...args.entries.map((e) => ({
      ...base(e.row, e.name),
      entry_date: e.entry_date,
      fatigue: e.fatigue,
      muscle_load: e.muscle_load,
      pain_zone: e.pain_zone,
      pain_side: e.pain_side,
      pain_intensity: null,
      pain_note: e.pain_note,
      needs_review: e.flagged,
      review_note: e.reasons.join("; ") || null,
      raw: e.raw,
    })),
    // jucători fără nicio valoare: se ține minte doar potrivirea numelui
    ...args.namesWithoutData
      .map((n) => ({ ...base(n.row, n.name), entry_date: null }))
      .filter((r) => r.action === "update"),
  ];
  return { filename: args.meta.filename, file_hash: args.meta.file_hash, mapping: args.meta.mapping ?? null, rows };
}

// ---------------------------------------------------------------------------
// Date fizice
// ---------------------------------------------------------------------------
export type PhysicalDefaults = {
  session_date: string | null;
  session_name: string;
  session_type: "training" | "match" | "test" | "other";
  group_id: string | null;
  source: "ksport" | "import";
};

export const PHYSICAL_METRIC_KEYS = [
  "duration_min", "total_distance_m", "hsr_distance_m", "sprint_distance_m", "sprint_count",
  "max_speed_kmh", "accelerations", "decelerations", "player_load", "hr_avg", "hr_max",
] as const;

export function buildPhysicalPayload(args: {
  records: TabularRecord[];
  defaults: PhysicalDefaults;
  decisions: Record<string, NameDecision>;
  mapping: ColumnMapping;
  meta: ImportMeta;
}) {
  type SessionRow = Record<string, unknown>;
  const sessions = new Map<string, { session_date: string; name: string; session_type: string; group_id: string | null; duration_min: number | null; rows: SessionRow[] }>();
  const problems: Array<{ row: number; name: string; note: string }> = [];

  for (const rec of args.records) {
    const name = String(rec.values.player ?? "").trim();
    if (!name || isSummaryRow(name)) continue;
    const date = (rec.values.session_date as string | undefined) ?? args.defaults.session_date;
    if (!date) {
      problems.push({ row: rec.row, name, note: "Lipsește data sesiunii" });
      continue;
    }
    const sessionName = String(rec.values.session_name ?? args.defaults.session_name ?? "").trim();
    const type = parseSessionType(rec.values.session_type) ?? parseSessionType(sessionName) ?? args.defaults.session_type;
    const key = `${date}|${sessionName}`;
    if (!sessions.has(key)) {
      sessions.set(key, { session_date: date, name: sessionName, session_type: type === "other" ? args.defaults.session_type : type, group_id: args.defaults.group_id, duration_min: null, rows: [] });
    }
    const d = args.decisions[decisionKey(name, null)];
    const row: SessionRow = {
      row: rec.row,
      source_name: name,
      match_key: norm(name),
      player_id: d?.action === "match" ? d.player_id : null,
      note: rec.errors.length ? rec.errors.join("; ") : d?.action === "match" ? null : "Jucător nepotrivit",
      extra: rec.extra,
    };
    for (const k of PHYSICAL_METRIC_KEYS) row[k] = rec.values[k] ?? null;
    sessions.get(key)!.rows.push(row);
  }
  for (const s of sessions.values()) {
    const durations = s.rows.map((r) => r.duration_min).filter((v): v is number => typeof v === "number");
    s.duration_min = durations.length ? Math.round(Math.max(...durations)) : null;
  }
  return {
    payload: {
      filename: args.meta.filename, file_hash: args.meta.file_hash, mapping: args.mapping, source: args.defaults.source,
      sessions: [...sessions.values()],
    },
    problems,
  };
}

// ---------------------------------------------------------------------------
// Liste nominale
// ---------------------------------------------------------------------------
export function normalizeFoot(input: unknown): "left" | "right" | "both" | null {
  const n = norm(input);
  if (!n) return null;
  if (/^(ST|STG|STANG\w*|LEFT|L)$/.test(n)) return "left";
  if (/^(DR|DREPT\w*|RIGHT|R)$/.test(n)) return "right";
  if (/AMBELE|AMBIDEXTRU|BOTH/.test(n)) return "both";
  return null;
}

export function normalizePosition(input: unknown): { code: "GK" | "DEF" | "MID" | "FWD" | null; detail: string | null } {
  const raw = String(input ?? "").trim();
  const n = norm(raw);
  if (!n) return { code: null, detail: null };
  if (/^(GK|P|PORTAR\w*|GOALKEEPER)$/.test(n)) return { code: "GK", detail: null };
  if (/FUNDAS|^(DEF|D|FC|FS|FD|CB|LB|RB)$|DEFENDER|STOPER/.test(n)) return { code: "DEF", detail: raw };
  if (/MIJLOCAS|^(MID|M|MC|MDF|MOF|MS|MD|CM|DM|AM)$|MIDFIELD|INTER|EXTREMA/.test(n)) return { code: "MID", detail: raw };
  if (/ATACANT|^(FWD|A|AC|ST|CF|LW|RW)$|FORWARD|STRIKER|VARF/.test(n)) return { code: "FWD", detail: raw };
  return { code: null, detail: raw };
}

export function buildRosterPayload(args: {
  records: TabularRecord[];
  /** grupa implicită, dacă fișierul nu are coloană de grupă */
  defaultGroupId: string | null;
  groups: Array<{ id: string; name: string }>;
  decisions: Record<string, NameDecision>;
  mapping: ColumnMapping;
  meta: ImportMeta;
}) {
  const rows = args.records
    .map((rec) => {
      const last = String(rec.values.full_name ?? "").trim();
      const first = String(rec.values.first_name ?? "").trim();
      const fullName = [last, first].filter(Boolean).join(" ");
      if (!fullName) return null;
      const groupText = norm(rec.values.group).replace(/ /g, "");
      const group = groupText ? args.groups.find((g) => norm(g.name).replace(/ /g, "") === groupText) : undefined;
      const groupId = group?.id ?? args.defaultGroupId;
      const d = args.decisions[decisionKey(fullName, groupId)] ?? { action: "skip" as const };
      const pos = normalizePosition(rec.values.position);
      return {
        row: rec.row,
        source_name: fullName,
        match_key: norm(fullName),
        group_id: groupId,
        action: d.action === "match" ? "update" : d.action,
        player_id: d.action === "match" ? d.player_id : null,
        full_name: fullName,
        display_name: String(rec.values.display_name ?? "").trim() || null,
        birth_date: rec.values.birth_date ?? null,
        position: pos.code,
        shirt_number: rec.values.shirt_number ?? null,
        dominant_foot: normalizeFoot(rec.values.dominant_foot),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);
  return { filename: args.meta.filename, file_hash: args.meta.file_hash, mapping: args.mapping, rows };
}
