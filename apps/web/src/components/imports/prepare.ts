import {
  PHYSICAL_FIELDS, ROSTER_FIELDS, TEST_FIELDS, applyMapping, buildHealthPayload, buildPhysicalPayload,
  buildRosterPayload, buildWellnessEntries, buildWellnessPayload, decisionKey, isSummaryRow, norm, parseDate, parseNumber,
  type ColumnMapping, type FatigueColumn, type ImportField, type ImportMeta, type ParsedFatigueGrid,
  type ParsedHealthSheet, type PhysicalDefaults, type TabularPreview, type TabularRecord,
} from "@club/shared";
import { getT } from "@/messages";
import type { Annotation, ImportGroup, ImportTest, NameItem, Prepared, TemplateMapping } from "./types";

/**
 * Legătura dintre pasul de mapare și restul asistentului: din datele citite și maparea aleasă
 * rezultă (1) numele de potrivit și (2) o funcție care, primind deciziile preparatorului,
 * construiește exact ce se trimite la RPC-ul de import, plus rezumatul afișat la confirmare.
 * Interpretarea propriu-zisă a fișierelor este în @club/shared (aceeași ca în importul din linia de comandă).
 */

type NameOptions = Pick<NameItem, "hasData" | "allowCreate" | "autoCreate">;

function collect(names: Map<string, NameItem>, name: string, keyGroupId: string | null, hintGroupId: string | null, opts: NameOptions) {
  const key = decisionKey(name, keyGroupId);
  const existing = names.get(key);
  if (existing) {
    existing.rows += 1;
    existing.hasData ||= opts.hasData;
    existing.allowCreate ||= opts.allowCreate;
  } else {
    names.set(key, { key, name: name.trim(), keyGroupId, hintGroupId, rows: 1, ...opts });
  }
}

// ---------------------------------------------------------------------------
// Stare de sănătate
// ---------------------------------------------------------------------------
export function prepareHealth(args: {
  parsed: ParsedHealthSheet;
  blockGroupIds: Array<string | null>;
  groups: ImportGroup[];
  meta: ImportMeta;
}): Prepared {
  const s = getT().imports.summary;
  const names = new Map<string, NameItem>();
  args.parsed.blocks.forEach((block, i) => {
    const gid = args.blockGroupIds[i];
    if (!gid) return;
    for (const r of block.rows) collect(names, r.name, gid, gid, { hasData: true, allowCreate: true, autoCreate: true });
  });
  const mapping = {
    columns: args.parsed.columns,
    blocks: args.parsed.blocks.map((b, i) => ({
      label: b.label, rows: b.rows.length,
      group: args.groups.find((g) => g.id === args.blockGroupIds[i])?.name ?? null,
    })),
  };
  return {
    names: [...names.values()],
    build(decisions) {
      const payload = buildHealthPayload({ ...args, decisions, meta: { ...args.meta, mapping } });
      const active = payload.rows.filter((r) => r.action !== "skip");
      const flagged = active.filter((r) => r.needs_review);
      return {
        payload,
        annotations: [],
        importable: active.length,
        flagged: flagged.map((r) => ({ row: r.row, name: r.source_name, note: r.review_note ?? "" })),
        stats: [
          { label: s.newPlayers, value: active.filter((r) => r.action === "create").length, tone: "green" },
          { label: s.updatedPlayers, value: active.filter((r) => r.action === "update").length, tone: "green" },
          { label: s.skippedRows, value: payload.rows.length - active.length, tone: "gray" },
          { label: s.flaggedRows, value: flagged.length, tone: "orange" },
        ],
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Chestionar săptămânal (grila)
// ---------------------------------------------------------------------------
export function prepareFatigue(args: {
  grid: ParsedFatigueGrid;
  columns: Array<Pick<FatigueColumn, "index" | "metric" | "day">>;
  weekStart: string;
  groupId: string;
  meta: ImportMeta;
}): Prepared & { entries: ReturnType<typeof buildWellnessEntries>["entries"] } {
  const s = getT().imports.summary;
  const { entries, namesWithoutData } = buildWellnessEntries(args.grid, args.columns, args.weekStart);
  const withData = new Set(entries.map((e) => e.name));
  const names = new Map<string, NameItem>();
  for (const r of args.grid.rows) {
    const hasData = withData.has(r.name);
    collect(names, r.name, args.groupId, args.groupId, { hasData, allowCreate: hasData, autoCreate: false });
  }
  const mapping = { week: args.weekStart, columns: args.columns.filter((c) => c.metric && c.day !== null) };
  return {
    entries,
    names: [...names.values()],
    build(decisions) {
      const payload = buildWellnessPayload({
        entries, namesWithoutData, groupId: args.groupId, decisions, meta: { ...args.meta, mapping },
      });
      const dated = payload.rows.filter((r) => r.entry_date);
      const active = dated.filter((r) => r.action !== "skip");
      const flagged = active.filter((r) => "needs_review" in r && r.needs_review);
      const created = new Set(active.filter((r) => r.action === "create").map((r) => r.match_key));
      return {
        payload,
        annotations: [],
        importable: active.length,
        flagged: flagged.map((r) => ({ row: r.row, name: r.source_name, note: ("review_note" in r && r.review_note) || "" })),
        stats: [
          { label: s.wellnessEntries, value: active.length, tone: "green" },
          { label: s.newPlayers, value: created.size, tone: created.size ? "orange" : "gray" },
          { label: s.skippedRows, value: dated.length - active.length, tone: "gray" },
          { label: s.flaggedRows, value: flagged.length, tone: "orange" },
        ],
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Listă nominală
// ---------------------------------------------------------------------------
export type RosterRow = { rec: TabularRecord; fullName: string; groupId: string | null; groupText: string; groupKnown: boolean };

/** Numele și grupa unui rând, calculate la fel ca în `buildRosterPayload` (aceeași cheie de decizie). */
export function rosterRows(records: TabularRecord[], groups: ImportGroup[], defaultGroupId: string | null): RosterRow[] {
  return records.map((rec) => {
    const fullName = [String(rec.values.full_name ?? "").trim(), String(rec.values.first_name ?? "").trim()].filter(Boolean).join(" ");
    const groupText = String(rec.values.group ?? "").trim();
    const g = norm(groupText).replace(/ /g, "");
    const group = g ? groups.find((x) => norm(x.name).replace(/ /g, "") === g) : undefined;
    return { rec, fullName, groupText, groupKnown: !groupText || !!group, groupId: group?.id ?? defaultGroupId };
  });
}

export function prepareRoster(args: {
  table: TabularPreview;
  mapping: ColumnMapping;
  defaultGroupId: string | null;
  groups: ImportGroup[];
  meta: ImportMeta;
}): Prepared & { rows: RosterRow[] } {
  const t = getT().imports;
  const records = applyMapping(args.table, args.mapping, ROSTER_FIELDS);
  const rows = rosterRows(records, args.groups, args.defaultGroupId);
  const names = new Map<string, NameItem>();
  for (const r of rows) {
    if (r.fullName) collect(names, r.fullName, r.groupId, r.groupId, { hasData: true, allowCreate: true, autoCreate: true });
  }
  const mapping = { headers: args.table.headers, header_row: args.table.headerRow, columns: args.mapping };
  return {
    rows,
    names: [...names.values()],
    build(decisions) {
      const payload = buildRosterPayload({ records, defaultGroupId: args.defaultGroupId, groups: args.groups, decisions, mapping: args.mapping, meta: args.meta });
      const active = payload.rows.filter((r) => r.action !== "skip");
      const activeRows = new Set(active.map((r) => r.row));
      const annotations: Annotation[] = [];
      for (const r of rows) {
        if (!r.fullName) annotations.push({ row: r.rec.row, name: "", result: "error", note: t.notes.noName });
        else {
          const problems = [...r.rec.errors];
          if (!r.groupKnown) problems.push(t.notes.unknownGroup(r.groupText));
          if (problems.length && activeRows.has(r.rec.row)) annotations.push({ row: r.rec.row, name: r.fullName, note: problems.join("; ") });
        }
      }
      const noted = annotations.filter((a) => !a.result);
      return {
        payload: { ...payload, mapping },
        annotations,
        importable: active.length,
        flagged: noted.map((a) => ({ row: a.row, name: a.name, note: a.note })),
        stats: [
          { label: t.summary.newPlayers, value: active.filter((r) => r.action === "create").length, tone: "green" },
          { label: t.summary.updatedPlayers, value: active.filter((r) => r.action === "update").length, tone: "green" },
          { label: t.summary.skippedRows, value: payload.rows.length - active.length, tone: "gray" },
          { label: t.summary.errorRows, value: annotations.length - noted.length, tone: "red" },
          { label: t.summary.flaggedRows, value: noted.length, tone: "orange" },
        ],
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Date fizice
// ---------------------------------------------------------------------------
export function preparePhysical(args: {
  table: TabularPreview;
  mapping: ColumnMapping;
  defaults: PhysicalDefaults;
  meta: ImportMeta;
}): Prepared & { records: TabularRecord[] } {
  const t = getT().imports;
  const records = applyMapping(args.table, args.mapping, PHYSICAL_FIELDS);
  const names = new Map<string, NameItem>();
  for (const rec of records) {
    const name = String(rec.values.player ?? "").trim();
    if (!name || isSummaryRow(name)) continue;
    collect(names, name, null, args.defaults.group_id, { hasData: true, allowCreate: false, autoCreate: false });
  }
  const mapping = {
    headers: args.table.headers, header_row: args.table.headerRow, columns: args.mapping,
    defaults: { ...args.defaults },
  };
  return {
    records,
    names: [...names.values()],
    build(decisions) {
      const { payload, problems } = buildPhysicalPayload({ records, defaults: args.defaults, decisions, mapping: args.mapping, meta: args.meta });
      const errorsByRow = new Map(records.filter((r) => r.errors.length).map((r) => [r.row, r.errors.join("; ")]));
      const annotations: Annotation[] = problems.map((p) => ({ row: p.row, name: p.name, result: "error", note: p.note }));
      for (const rec of records) {
        const name = String(rec.values.player ?? "").trim();
        if (!name) annotations.push({ row: rec.row, name: "", result: "error", note: t.notes.noPlayer });
        else if (isSummaryRow(name)) annotations.push({ row: rec.row, name, result: "skipped", note: t.notes.summaryRow });
      }
      let matched = 0;
      let unmatched = 0;
      const flagged: Array<{ row: number; name: string; note: string }> = [];
      for (const session of payload.sessions) {
        for (const row of session.rows) {
          const d = decisions[decisionKey(String(row.source_name), null)];
          if (row.player_id) {
            matched++;
            const note = errorsByRow.get(Number(row.row));
            if (note) {
              annotations.push({ row: Number(row.row), name: String(row.source_name), note });
              flagged.push({ row: Number(row.row), name: String(row.source_name), note });
            }
          } else {
            unmatched++;
            row.note = d?.action === "skip" ? t.notes.skippedByChoice : t.notes.unmatched;
          }
        }
      }
      return {
        payload: { ...payload, mapping },
        annotations,
        importable: matched,
        flagged,
        stats: [
          { label: t.summary.sessions, value: payload.sessions.length, tone: "gray" },
          { label: t.summary.physicalRows, value: matched, tone: "green" },
          { label: t.summary.unmatchedRows, value: unmatched, tone: unmatched ? "orange" : "gray" },
          { label: t.summary.summaryRows, value: annotations.filter((a) => a.result === "skipped").length, tone: "gray" },
          { label: t.summary.errorRows, value: annotations.filter((a) => a.result === "error").length, tone: "red" },
          { label: t.summary.flaggedRows, value: flagged.length, tone: "orange" },
        ],
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Teste fizice
// ---------------------------------------------------------------------------
const TEST_PREFIX = "test:";

/** Câmpurile de mapare pentru teste: jucător, dată și câte un câmp pentru fiecare test al clubului. */
export function testFields(tests: ImportTest[]): ImportField[] {
  return [
    ...TEST_FIELDS,
    ...tests.map((test) => {
      const name = norm(test.name);
      const words = name.split(" ");
      const hints = new Set([name, name.replace(/(\d) (M|S|CM)\b/g, "$1$2"), norm(test.code.replace(/_/g, " ")), norm(test.code).replace(/ /g, "")]);
      if (words.length > 2) hints.add(words.slice(0, -1).join(" "));
      if (words.length > 1 && words[0].length >= 5) hints.add(words[0]);
      return { key: `${TEST_PREFIX}${test.id}`, label: `${test.name} (${test.unit})`, type: "number" as const, hints: [...hints].filter((h) => h.length >= 3) };
    }),
  ];
}

export type TestRow = {
  row: number;
  name: string;
  tested_on: string | null;
  results: Array<{ test_id: string; value: number }>;
  errors: string[];
  summary: boolean;
};

/**
 * Rândurile fișierului de teste, citite direct din celule: timpii de sprint au nevoie de două
 * zecimale, iar conversia generică din `applyMapping` rotunjește numerele la o zecimală.
 */
export function testRows(table: TabularPreview, mapping: ColumnMapping, tests: ImportTest[], defaultDate: string | null): TestRow[] {
  const t = getT().imports.notes;
  const columns = Object.entries(mapping).map(([col, target]) => ({ col: Number(col), target }));
  const playerCol = columns.find((c) => c.target === "player")?.col;
  const dateCol = columns.find((c) => c.target === "tested_on")?.col;
  const testCols = columns.filter((c) => c.target.startsWith(TEST_PREFIX)).map((c) => ({ col: c.col, id: c.target.slice(TEST_PREFIX.length) }));
  const testName = new Map(tests.map((x) => [x.id, x.name]));
  return table.rows.map((r) => {
    const name = playerCol === undefined ? "" : (r.cells[playerCol] ?? "").trim();
    const errors: string[] = [];
    const results: TestRow["results"] = [];
    let testedOn = defaultDate;
    if (dateCol !== undefined && r.cells[dateCol]) {
      const parsed = parseDate(r.cells[dateCol]);
      if (parsed) testedOn = parsed;
      else errors.push(t.unreadable(TEST_FIELDS[1].label, r.cells[dateCol]));
    }
    for (const c of testCols) {
      const raw = r.cells[c.col] ?? "";
      if (!raw || /^[-–—]+$/.test(raw)) continue;
      const value = parseNumber(raw);
      if (value === null || Math.abs(value) > 99999) errors.push(t.unreadable(testName.get(c.id) ?? "?", raw));
      else results.push({ test_id: c.id, value: Math.round(value * 100) / 100 });
    }
    return { row: r.row, name, results, tested_on: testedOn, errors: name ? errors : [], summary: !!name && isSummaryRow(name) };
  });
}

export function prepareTests(args: {
  table: TabularPreview;
  mapping: ColumnMapping;
  tests: ImportTest[];
  defaultDate: string | null;
  hintGroupId: string | null;
  meta: ImportMeta;
}): Prepared & { rows: TestRow[] } {
  const t = getT().imports;
  const rows = testRows(args.table, args.mapping, args.tests, args.defaultDate);
  const names = new Map<string, NameItem>();
  for (const r of rows) {
    if (r.name && !r.summary) collect(names, r.name, null, args.hintGroupId, { hasData: r.results.length > 0, allowCreate: false, autoCreate: false });
  }
  const testName = new Map(args.tests.map((x) => [x.id, x.name]));
  const mapping = {
    headers: args.table.headers, header_row: args.table.headerRow,
    columns: Object.fromEntries(Object.entries(args.mapping).map(([col, target]) =>
      [col, target.startsWith(TEST_PREFIX) ? `test:${testName.get(target.slice(TEST_PREFIX.length)) ?? "?"}` : target])),
    default_date: args.defaultDate,
  };
  return {
    rows,
    names: [...names.values()],
    build(decisions) {
      const annotations: Annotation[] = [];
      const flagged: Array<{ row: number; name: string; note: string }> = [];
      const out: Array<Record<string, unknown>> = [];
      let importable = 0;
      let values = 0;
      let unmatched = 0;
      for (const r of rows) {
        if (!r.name) { annotations.push({ row: r.row, name: "", result: "error", note: t.notes.noPlayer }); continue; }
        if (r.summary) { annotations.push({ row: r.row, name: r.name, result: "skipped", note: t.notes.summaryRow }); continue; }
        const d = decisions[decisionKey(r.name, null)];
        const playerId = d?.action === "match" ? d.player_id : null;
        const problems = [...r.errors];
        let note: string | null = problems.join("; ") || null;
        if (!playerId) {
          unmatched++;
          note = d?.action === "skip" ? t.notes.skippedByChoice : t.notes.unmatched;
        } else if (r.tested_on && r.results.length) {
          importable++;
          values += r.results.length;
          if (note) flagged.push({ row: r.row, name: r.name, note });
        }
        out.push({ row: r.row, source_name: r.name, match_key: norm(r.name), player_id: playerId, tested_on: r.tested_on, results: r.results, note });
      }
      return {
        payload: { filename: args.meta.filename, file_hash: args.meta.file_hash, mapping, rows: out },
        annotations,
        importable,
        flagged,
        stats: [
          { label: t.summary.testRows, value: importable, tone: "green" },
          { label: t.summary.testValues, value: values, tone: "green" },
          { label: t.summary.unmatchedRows, value: unmatched, tone: unmatched ? "orange" : "gray" },
          { label: t.summary.errorRows, value: annotations.filter((a) => a.result === "error").length, tone: "red" },
          { label: t.summary.flaggedRows, value: flagged.length, tone: "orange" },
        ],
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Șabloane de mapare (date fizice)
// ---------------------------------------------------------------------------
/** Cheia stabilă a unei coloane: antetul normalizat + a câta apariție (antetele se pot repeta). */
export function headerKeys(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((h) => {
    const n = norm(h);
    const count = (seen.get(n) ?? 0) + 1;
    seen.set(n, count);
    return `${n}#${count}`;
  });
}

export function toTemplate(headers: string[], mapping: ColumnMapping, defaults: PhysicalDefaults): TemplateMapping {
  const keys = headerKeys(headers);
  return {
    version: 1,
    headers: headers.map((h) => norm(h)),
    columns: Object.fromEntries(keys.map((k, col) => [k, mapping[col] ?? ""])),
    defaults: { session_type: defaults.session_type, source: defaults.source },
  };
}

/** Aplică un șablon pe antetele fișierului curent; coloanele necunoscute șablonului rămân cum erau propuse. */
export function applyTemplate(template: TemplateMapping, headers: string[], fallback: ColumnMapping): ColumnMapping {
  const keys = headerKeys(headers);
  const mapping: ColumnMapping = {};
  const used = new Set<string>();
  keys.forEach((k, col) => {
    const target = template.columns[k];
    if (target !== undefined) {
      // „extra:" păstrează antetul din fișierul curent
      mapping[col] = target.startsWith("extra:") ? `extra:${headers[col]}` : target;
      if (target && !target.startsWith("extra:")) used.add(target);
    }
  });
  keys.forEach((_, col) => {
    if (mapping[col] !== undefined) return;
    const proposed = fallback[col] ?? "";
    mapping[col] = proposed && !proposed.startsWith("extra:") && used.has(proposed) ? "" : proposed;
  });
  return mapping;
}

/** Șablonul se potrivește pe deplin: fișierul are exact aceleași antete. */
export function templateMatches(template: TemplateMapping, headers: string[]): boolean {
  const a = headers.map((h) => norm(h)).filter(Boolean).sort().join("|");
  const b = template.headers.filter(Boolean).sort().join("|");
  return a.length > 0 && a === b;
}

export function isTemplateMapping(value: unknown): value is TemplateMapping {
  const v = value as TemplateMapping | null;
  return !!v && typeof v === "object" && v.version === 1 && Array.isArray(v.headers) && typeof v.columns === "object" && !!v.columns;
}
