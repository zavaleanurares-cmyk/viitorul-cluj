import { cell, norm } from "../text";
import { parseScore } from "../status";
import { parseZoneText } from "../body";
import type { Sheet } from "./health";

export type WellnessMetric = "fatigue" | "muscle_load" | "pain";

export const METRIC_LABELS: Record<WellnessMetric, string> = {
  fatigue: "Oboseală",
  muscle_load: "Încărcătură musculară",
  pain: "Zonă dureroasă",
};

export type FatigueColumn = {
  index: number;
  header: string;
  metric: WellnessMetric | null;
  /** 0 = luni … 6 = duminică */
  day: number | null;
  /** ziua a fost dedusă (coloana nu are antet de zi) — de confirmat în ecranul de mapare */
  inferred: boolean;
  hasData: boolean;
};

export type ParsedFatigueGrid = {
  headerRow: number;
  nameColumn: number;
  columns: FatigueColumn[];
  rows: Array<{ row: number; name: string; cells: string[] }>;
};

const DAYS: Array<[RegExp, number]> = [
  [/^(LUNI|LU|MON\w*)$/, 0], [/^(MARTI|MA|TUE\w*)$/, 1], [/^(MIERCURI|MI|WED\w*)$/, 2], [/^(JOI|JO|THU\w*)$/, 3],
  [/^(VINERI|VI|FRI\w*)$/, 4], [/^(SAMBATA|SA|SAT\w*)$/, 5], [/^(DUMINICA|DU|SUN\w*)$/, 6],
];

function dayOf(header: string): number | null {
  const n = norm(header);
  for (const [re, d] of DAYS) if (re.test(n)) return d;
  return null;
}

function metricOf(header: string): WellnessMetric | null {
  const n = norm(header);
  if (!n) return null;
  if (/INCARCATUR|MUSCUL|SORENESS|DOMS/.test(n)) return "muscle_load";
  if (/ZONA|DURER|PAIN/.test(n)) return "pain";
  if (/FATIGUE|OBOSEAL/.test(n)) return "fatigue";
  return null;
}

/**
 * Grila săptămânală „FATIGUE/STARE DE OBOSEALA": nume pe rânduri, apoi secțiuni
 * (oboseală, încărcătură musculară, zonă dureroasă), fiecare cu coloane pe zile.
 * Unde secțiunea nu are antete de zi (cum e în tabelul clubului), coloanele ei se
 * aliniază, în ordine, cu zilele în care există valori de oboseală; alinierea este
 * marcată „dedusă" și se confirmă în ecranul de mapare.
 */
export function parseFatigueGrid(sheet: Sheet): ParsedFatigueGrid {
  let headerRow = sheet.findIndex((r) => (r ?? []).some((c) => dayOf(cell(c)) !== null || metricOf(cell(c)) !== null));
  if (headerRow < 0) headerRow = 0;
  const header = (sheet[headerRow] ?? []).map(cell);
  const width = Math.max(...sheet.map((r) => (r ?? []).length), header.length);
  const nameColumn = Math.max(0, header.findIndex((h) => /\bNUME\b|JUCATOR|PLAYER/.test(norm(h))));

  const rows = sheet
    .slice(headerRow + 1)
    .map((raw, i) => ({ row: headerRow + i + 2, cells: Array.from({ length: width }, (_, c) => cell((raw ?? [])[c])) }))
    .filter((r) => r.cells[nameColumn])
    .map((r) => ({ ...r, name: r.cells[nameColumn] }));

  const hasData = (c: number) => rows.some((r) => r.cells[c] !== "");

  // 1) secțiuni
  const columns: FatigueColumn[] = [];
  let section: WellnessMetric | null = null;
  const sections: Array<{ metric: WellnessMetric; cols: number[] }> = [];
  for (let c = 0; c < width; c++) {
    if (c === nameColumn) continue;
    const h = header[c] ?? "";
    const m = metricOf(h);
    if (m) {
      section = m;
      sections.push({ metric: m, cols: [] });
    }
    if (section) sections[sections.length - 1].cols.push(c);
    columns.push({ index: c, header: h, metric: null, day: null, inferred: false, hasData: hasData(c) });
  }
  const byIndex = new Map(columns.map((c) => [c.index, c]));

  // 2) secțiunile cu antete de zi
  for (const s of sections) {
    const dayCols = s.cols.filter((c) => dayOf(header[c] ?? "") !== null);
    if (dayCols.length) {
      for (const c of dayCols) Object.assign(byIndex.get(c)!, { metric: s.metric, day: dayOf(header[c]), inferred: false });
    }
  }
  // zilele „active": cele în care există măcar o valoare într-o coloană cu zi explicită
  const activeDays = [...new Set(columns.filter((c) => c.day !== null && c.hasData).map((c) => c.day as number))].sort((a, b) => a - b);

  // 3) secțiunile fără antete de zi: coloanele cu date, în ordine, pe zilele active
  for (const s of sections) {
    if (s.cols.some((c) => byIndex.get(c)!.metric)) continue;
    const dataCols = s.cols.filter((c) => byIndex.get(c)!.hasData);
    dataCols.forEach((c, i) => {
      const day = activeDays[i] ?? (activeDays.length ? Math.min(6, activeDays[activeDays.length - 1] + (i - activeDays.length + 1)) : i);
      Object.assign(byIndex.get(c)!, { metric: s.metric, day, inferred: true });
    });
  }

  return { headerRow: headerRow + 1, nameColumn, columns, rows };
}

export type WellnessImportEntry = {
  row: number;
  name: string;
  /** 0 = luni … 6 = duminică */
  day: number;
  entry_date: string;
  fatigue: number | null;
  muscle_load: number | null;
  pain_zone: string | null;
  pain_side: string | null;
  pain_note: string | null;
  flagged: boolean;
  reasons: string[];
  raw: Record<string, string>;
};

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Transformă grila în chestionare zilnice, după maparea coloanelor (eventual corectată de preparator). */
export function buildWellnessEntries(
  grid: ParsedFatigueGrid,
  columns: Pick<FatigueColumn, "index" | "metric" | "day">[],
  weekStart: string,
): { entries: WellnessImportEntry[]; namesWithoutData: Array<{ row: number; name: string }> } {
  const entries: WellnessImportEntry[] = [];
  const namesWithoutData: Array<{ row: number; name: string }> = [];
  const mapped = columns.filter((c) => c.metric && c.day !== null);

  for (const r of grid.rows) {
    const perDay = new Map<number, WellnessImportEntry>();
    const ensure = (day: number) => {
      if (!perDay.has(day)) {
        perDay.set(day, {
          row: r.row, name: r.name, day, entry_date: addDays(weekStart, day),
          fatigue: null, muscle_load: null, pain_zone: null, pain_side: null, pain_note: null,
          flagged: false, reasons: [], raw: {},
        });
      }
      return perDay.get(day)!;
    };
    for (const c of mapped) {
      const value = r.cells[c.index] ?? "";
      if (!value) continue;
      const e = ensure(c.day as number);
      e.raw[c.metric as string] = value;
      if (c.metric === "pain") {
        const z = parseZoneText(value);
        e.pain_zone = z.zone;
        e.pain_side = z.side;
        // textul original rămâne mereu în notă: chestionarul vechi era în text liber
        e.pain_note = value;
        if (z.flagged && z.reason) { e.flagged = true; e.reasons.push(z.reason); }
      } else {
        const s = parseScore(value);
        if (c.metric === "fatigue") e.fatigue = s.value; else e.muscle_load = s.value;
        if (s.flagged && s.reason) { e.flagged = true; e.reasons.push(s.reason); }
      }
    }
    // valori în coloane nemapate
    const stray = grid.columns.filter((c) => c.hasData && r.cells[c.index] && !mapped.some((m) => m.index === c.index));
    if (stray.length && perDay.size) {
      const first = [...perDay.values()][0];
      first.flagged = true;
      first.reasons.push(`Valori în coloane nemapate: ${stray.map((c) => `„${r.cells[c.index]}"`).join(", ")}`);
    }
    if (!perDay.size) namesWithoutData.push({ row: r.row, name: r.name });
    entries.push(...[...perDay.values()].sort((a, b) => a.day - b.day));
  }
  return { entries, namesWithoutData };
}
