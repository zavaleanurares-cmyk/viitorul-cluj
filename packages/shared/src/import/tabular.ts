import { cell, norm } from "../text";
import type { Sheet } from "./health";

/** Import generic prin mapare de coloane: date fizice (K-Sport sau orice alt export) și liste nominale. */

export type FieldType = "text" | "number" | "integer" | "date" | "duration";

export type ImportField = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** fragmente de antet (normalizate) care sugerează câmpul */
  hints: string[];
  /** înmulțitor aplicat dacă antetul conține unitatea (ex. km -> m) */
  unitFactor?: Array<[RegExp, number]>;
};

export const PHYSICAL_FIELDS: ImportField[] = [
  { key: "player", label: "Jucător", type: "text", required: true, hints: ["PLAYER", "JUCATOR", "NUME", "NAME", "ATHLETE", "ATLETA", "GIOCATORE"] },
  { key: "session_date", label: "Data sesiunii", type: "date", hints: ["DATE", "DATA", "DAY", "ZI"] },
  { key: "session_name", label: "Sesiune", type: "text", hints: ["SESSION", "SESIUNE", "DRILL", "ACTIVITY", "ANTRENAMENT", "SEDUTA", "TITLE", "PERIOD"] },
  { key: "session_type", label: "Tip (antrenament / meci)", type: "text", hints: ["TYPE", "TIP", "CATEGORY", "TIPO"] },
  { key: "duration_min", label: "Durată (min)", type: "duration", hints: ["DURATION", "DURATA", "TIME", "TIMP", "MINUTES", "MINUTE", "TEMPO"] },
  { key: "total_distance_m", label: "Distanță totală (m)", type: "number", hints: ["TOTAL DISTANCE", "DISTANTA TOTALA", "DIST TOTAL", "TOT DIST", "DISTANZA TOTALE", "DISTANCE", "DISTANTA"], unitFactor: [[/\bKM\b/, 1000]] },
  { key: "hsr_distance_m", label: "Distanță la viteză mare (m)", type: "number", hints: ["HSR", "HIGH SPEED", "VITEZA MARE", "HIGH INTENSITY", "HI DIST", "DIST 20", "DISTANCE 20", "ALTA VELOCITA", "ZONE 5"], unitFactor: [[/\bKM\b(?! H)/, 1000]] },
  { key: "sprint_distance_m", label: "Distanță în sprint (m)", type: "number", hints: ["SPRINT DIST", "DISTANTA SPRINT", "SPRINT M", "DIST 25", "DISTANCE 25", "ZONE 6"] },
  { key: "sprint_count", label: "Număr de sprinturi", type: "integer", hints: ["SPRINTS", "SPRINTURI", "N SPRINT", "NR SPRINT", "SPRINT COUNT", "NUMBER OF SPRINT", "SPRINT EFFORTS", "SPRINT"] },
  { key: "max_speed_kmh", label: "Viteză maximă (km/h)", type: "number", hints: ["MAX SPEED", "VITEZA MAX", "TOP SPEED", "VMAX", "MAX VEL", "VELOCITA MAX", "SPEED MAX"], unitFactor: [[/\bM S\b/, 3.6]] },
  { key: "accelerations", label: "Accelerări", type: "integer", hints: ["ACCELERATIONS", "ACCELERARI", "ACCEL", "ACC"] },
  { key: "decelerations", label: "Decelerări", type: "integer", hints: ["DECELERATIONS", "DECELERARI", "DECEL", "DEC"] },
  { key: "player_load", label: "Încărcare (player load)", type: "number", hints: ["PLAYER LOAD", "LOAD", "INCARCARE", "METABOLIC", "TRAINING LOAD", "CARICO"] },
  { key: "hr_avg", label: "Puls mediu", type: "integer", hints: ["AVG HR", "HR AVG", "PULS MEDIU", "AVERAGE HEART", "FC MEDIA", "MEAN HR"] },
  { key: "hr_max", label: "Puls maxim", type: "integer", hints: ["MAX HR", "HR MAX", "PULS MAX", "MAX HEART", "FC MAX"] },
];

export const ROSTER_FIELDS: ImportField[] = [
  { key: "full_name", label: "Nume complet", type: "text", required: true, hints: ["NUME SI PRENUME", "NUME PRENUME", "NUME COMPLET", "JUCATOR", "NUME", "NAME"] },
  { key: "first_name", label: "Prenume (dacă e pe coloană separată)", type: "text", hints: ["PRENUME", "FIRST NAME"] },
  { key: "birth_date", label: "Data nașterii", type: "date", hints: ["DATA NASTERII", "NASTERE", "NASCUT", "BIRTH", "DATA NAST", "DN"] },
  { key: "group", label: "Grupă", type: "text", hints: ["GRUPA", "ECHIPA", "CATEGORIE", "TEAM", "GROUP"] },
  { key: "position", label: "Post", type: "text", hints: ["POST", "POZITIE", "POSITION"] },
  { key: "shirt_number", label: "Număr", type: "integer", hints: ["NUMAR", "NR TRICOU", "TRICOU", "NUMBER", "NR"] },
  { key: "dominant_foot", label: "Picior de bază", type: "text", hints: ["PICIOR", "FOOT"] },
  { key: "display_name", label: "Nume de afișare", type: "text", hints: ["NUME SCURT", "PORECLA", "AFISARE"] },
];

export const TEST_FIELDS: ImportField[] = [
  { key: "player", label: "Jucător", type: "text", required: true, hints: ["PLAYER", "JUCATOR", "NUME", "NAME"] },
  { key: "tested_on", label: "Data testării", type: "date", hints: ["DATE", "DATA"] },
];

/** coloană -> cheie de câmp; „extra:<etichetă>" păstrează coloana în câmpul liber; "" = ignorată */
export type ColumnMapping = Record<number, string>;

export type TabularPreview = {
  headerRow: number;
  headers: string[];
  rows: Array<{ row: number; cells: string[] }>;
};

/** Găsește rândul de antet (primul rând cu cel puțin 2 celule text) și întoarce datele de sub el. */
export function readTable(sheet: Sheet, headerRow?: number): TabularPreview {
  let h = headerRow !== undefined ? headerRow - 1 : -1;
  if (h < 0) {
    h = sheet.findIndex((r) => {
      const cells = (r ?? []).map(cell).filter(Boolean);
      return cells.length >= 2 && cells.filter((c) => /[A-Za-z]/.test(c)).length >= Math.ceil(cells.length / 2);
    });
    if (h < 0) h = 0;
  }
  const headers = (sheet[h] ?? []).map(cell);
  const width = Math.max(headers.length, ...sheet.slice(h + 1).map((r) => (r ?? []).length));
  while (headers.length < width) headers.push("");
  const rows = sheet
    .slice(h + 1)
    .map((raw, i) => ({ row: h + i + 2, cells: Array.from({ length: width }, (_, c) => cell((raw ?? [])[c])) }))
    .filter((r) => r.cells.some(Boolean));
  return { headerRow: h + 1, headers, rows };
}

/** Propune o mapare după antete. Fiecare câmp se folosește o singură dată; restul coloanelor numerice merg în „extra". */
export function suggestMapping(headers: string[], fields: ImportField[], extras = true): ColumnMapping {
  const mapping: ColumnMapping = {};
  const taken = new Set<string>();
  const normalized = headers.map((h) => norm(h));

  // potriviri de la cel mai specific indiciu (cel mai lung) la cel mai general
  const pairs: Array<{ col: number; key: string; weight: number }> = [];
  normalized.forEach((h, col) => {
    if (!h) return;
    for (const f of fields) {
      for (const hint of f.hints) {
        if (h === hint) pairs.push({ col, key: f.key, weight: 1000 + hint.length });
        else if (new RegExp(`(^| )${hint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( |$)`).test(h)) pairs.push({ col, key: f.key, weight: 100 + hint.length });
        else if (hint.length >= 5 && h.includes(hint)) pairs.push({ col, key: f.key, weight: hint.length });
      }
    }
  });
  pairs.sort((a, b) => b.weight - a.weight);
  for (const p of pairs) {
    if (mapping[p.col] !== undefined || taken.has(p.key)) continue;
    mapping[p.col] = p.key;
    taken.add(p.key);
  }
  headers.forEach((h, col) => {
    if (mapping[col] === undefined) mapping[col] = extras && h ? `extra:${h}` : "";
  });
  return mapping;
}

export function parseNumber(input: unknown): number | null {
  let s = cell(input);
  if (!s || /^[-–—]+$/.test(s)) return null;
  s = s.replace(/[^\d.,\-]/g, "");
  if (!s) return null;
  if (s.includes(",") && s.includes(".")) {
    // ultimul separator este cel zecimal
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (s.includes(",")) {
    s = /,\d{3}$/.test(s) && !/^\d{1,3},\d{3}$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Acceptă 2026-10-07, 07.10.2026, 07/10/2026, 7-10-26 (ordine zi-lună-an) și numere seriale Excel. */
export function parseDate(input: unknown): string | null {
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    // datele din Excel sosesc ca miez de noapte UTC
    return new Date(input.getTime() + 12 * 3600 * 1000).toISOString().slice(0, 10);
  }
  const s = cell(input);
  if (!s) return null;
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(s);
  if (m) return iso(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

function iso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null;
  return date.toISOString().slice(0, 10);
}

/** Durată în minute din „01:32:10", „92:10", „92", „92.5", „1h 32m". */
export function parseDuration(input: unknown): number | null {
  const s = cell(input);
  if (!s) return null;
  let m = /^(\d+):(\d{1,2}):(\d{1,2})(?:[.,]\d+)?$/.exec(s);
  if (m) return round1(+m[1] * 60 + +m[2] + +m[3] / 60);
  m = /^(\d+):(\d{1,2})$/.exec(s);
  if (m) return round1(+m[1] + +m[2] / 60);
  m = /^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m(?:in)?)?$/i.exec(s);
  if (m && (m[1] || m[2])) return (+(m[1] ?? 0)) * 60 + +(m[2] ?? 0);
  const n = parseNumber(s);
  return n === null ? null : round1(n);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function parseSessionType(input: unknown): "training" | "match" | "test" | "other" | null {
  const n = norm(input);
  if (!n) return null;
  if (/\b(MECI|MATCH|GAME|PARTIDA|AMICAL|OFICIAL)\b/.test(n)) return "match";
  if (/\b(TEST\w*)\b/.test(n)) return "test";
  if (/\b(ANTRENAMENT\w*|TRAINING|ALLENAMENTO|SESSION|SEDUTA)\b/.test(n)) return "training";
  return "other";
}

export type TabularRecord = {
  row: number;
  values: Record<string, string | number | null>;
  extra: Record<string, string | number>;
  errors: string[];
};

/** Aplică maparea pe rânduri și convertește valorile după tipul câmpului. */
export function applyMapping(
  table: TabularPreview,
  mapping: ColumnMapping,
  fields: ImportField[],
): TabularRecord[] {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  return table.rows.map((r) => {
    const values: Record<string, string | number | null> = {};
    const extra: Record<string, string | number> = {};
    const errors: string[] = [];
    r.cells.forEach((raw, col) => {
      const target = mapping[col];
      if (!target || raw === "") return;
      if (target.startsWith("extra:")) {
        const n = parseNumber(raw);
        extra[target.slice(6)] = n !== null && /^[\d.,\-\s]+$/.test(raw) ? n : raw;
        return;
      }
      const f = byKey.get(target);
      if (!f) return;
      let v: string | number | null;
      switch (f.type) {
        case "number":
        case "integer": {
          v = parseNumber(raw);
          if (v !== null) {
            const header = norm(table.headers[col]);
            for (const [re, factor] of f.unitFactor ?? []) if (re.test(header)) v = v * factor;
            v = f.type === "integer" ? Math.round(v) : Math.round(v * 10) / 10;
          }
          break;
        }
        case "date": v = parseDate(raw); break;
        case "duration": v = parseDuration(raw); break;
        default: v = raw;
      }
      if (v === null) errors.push(`${f.label}: valoare necitibilă „${raw}"`);
      else values[target] = v;
    });
    for (const f of fields) if (f.required && (values[f.key] === undefined || values[f.key] === "")) errors.push(`${f.label} lipsește`);
    return { row: r.row, values, extra, errors };
  });
}

/** Rânduri de total / medie din exporturi, care nu sunt jucători. */
export function isSummaryRow(name: string): boolean {
  return /^(TOTAL\w*|MEDIA|MEDIE|AVERAGE|AVG|MEAN|TEAM|ECHIPA|SUM|MAX|MIN)\b/.test(norm(name));
}

/** Amprentă stabilă a conținutului, pentru a recunoaște un fișier deja importat. */
export async function hashSheet(sheet: Sheet): Promise<string> {
  const text = sheet.map((r) => (r ?? []).map(cell).join("\u001f")).join("\u001e");
  const data = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
