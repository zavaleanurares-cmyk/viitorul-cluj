import { cell, norm } from "../text";
import { parseStatusText, type ParsedStatus } from "../status";
import { parseZoneText, type ParsedZone } from "../body";

export type Sheet = unknown[][];

export type HealthRow = {
  /** numărul rândului din fișier (începe de la 1) */
  row: number;
  name: string;
  statusText: string;
  zoneText: string;
  status: ParsedStatus;
  zone: ParsedZone;
  /** observația finală (textul original al stării + valori rătăcite) */
  note: string | null;
  flagged: boolean;
  reasons: string[];
};

export type HealthBlock = {
  /** eticheta găsită în rândul de titlu („U21", „U16"…); gol pentru primul bloc fără etichetă */
  label: string;
  headerRow: number;
  rows: HealthRow[];
};

export type HealthColumns = { name: number; status: number; zone: number };

export type ParsedHealthSheet = {
  columns: HealthColumns;
  blocks: HealthBlock[];
  totalRows: number;
  flaggedRows: number;
};

const GROUP_LABEL = /^(U ?\d{1,2}|L ?\d|LIGA ?\d|LIGA A \d\w*|SENIORI|JUNIORI ?\w*|TINERET|ECHIPA ?\w*)$/;

function headerInfo(row: string[], cols: HealthColumns): { isHeader: boolean; label: string } {
  const first = norm(row[cols.name]);
  if (!first) return { isHeader: false, label: "" };
  const hasStatusHeader = row.some((c) => /^STAREA? /.test(norm(c)) || norm(c) === "STARE");
  const withoutNume = first.replace(/\bNUME\b/g, "").replace(/\bPRENUME\b/g, "").replace(/\bSI\b/g, "").trim();
  if (first === "NUME" || first === "NUME SI PRENUME" || first === "JUCATOR") return { isHeader: true, label: "" };
  if (GROUP_LABEL.test(withoutNume) && (hasStatusHeader || /\bNUME\b/.test(first) || row.slice(1).every((c) => !cell(c)))) {
    return { isHeader: true, label: withoutNume };
  }
  if (hasStatusHeader) return { isHeader: true, label: withoutNume };
  return { isHeader: false, label: "" };
}

/** Găsește coloanele după antete; altfel presupune nume / stare / zonă în ordinea primelor coloane cu date. */
export function detectHealthColumns(sheet: Sheet): HealthColumns {
  for (const raw of sheet.slice(0, 15)) {
    const row = (raw ?? []).map(cell);
    const status = row.findIndex((c) => /^STAREA? /.test(norm(c)) || norm(c) === "STARE");
    if (status >= 0) {
      const zone = row.findIndex((c) => /\bZONA\b/.test(norm(c)));
      const name = row.findIndex((c) => /\bNUME\b/.test(norm(c)) || norm(c) === "JUCATOR");
      return { name: name >= 0 ? name : 0, status, zone: zone >= 0 ? zone : status + 1 };
    }
  }
  // fără antet: coloanele care au date
  const used = new Set<number>();
  for (const raw of sheet.slice(0, 40)) (raw ?? []).forEach((c, i) => cell(c) && used.add(i));
  const order = [...used].sort((a, b) => a - b);
  return { name: order[0] ?? 0, status: order[1] ?? 1, zone: order[2] ?? 2 };
}

/**
 * Tabelul „STARE DE SANATATE": o singură foaie cu grupele una sub alta, despărțite de
 * rânduri de titlu și rânduri goale. Valorile neregulate nu blochează nimic: rândul se
 * importă și este marcat „de verificat".
 */
export function parseHealthSheet(sheet: Sheet, columns?: Partial<HealthColumns>): ParsedHealthSheet {
  const cols = { ...detectHealthColumns(sheet), ...columns };
  const blocks: HealthBlock[] = [];
  let current: HealthBlock | null = null;

  sheet.forEach((raw, i) => {
    const row = (raw ?? []).map(cell);
    const name = row[cols.name] ?? "";
    if (!name) return;
    const head = headerInfo(row, cols);
    if (head.isHeader) {
      current = { label: head.label, headerRow: i + 1, rows: [] };
      blocks.push(current);
      return;
    }
    if (!current) {
      current = { label: "", headerRow: 0, rows: [] };
      blocks.push(current);
    }
    const statusText = row[cols.status] ?? "";
    const zoneText = row[cols.zone] ?? "";
    const status = parseStatusText(statusText);
    const zone = parseZoneText(zoneText);
    const reasons = [status.reason, zone.reason].filter((r): r is string => !!r);

    const noteParts = [status.note];
    if (zone.misplacedValue) noteParts.push(`${zone.misplacedValue} (trecut la zonă în tabel)`);
    // stare APT cu zonă completată = de verificat
    if (status.code === "APT" && (zone.zone || zone.detail)) reasons.push("Jucător APT cu zonă de accidentare completată");
    // accidentat / readaptare fără zonă = de completat
    if ((status.code === "ACC" || status.code === "READAPTARE") && !zone.zone) {
      if (!zone.reason) reasons.push("Zona accidentării lipsește");
    }

    current.rows.push({
      row: i + 1,
      name,
      statusText,
      zoneText,
      status,
      zone,
      note: noteParts.filter(Boolean).join("; ") || null,
      flagged: reasons.length > 0,
      reasons,
    });
  });

  const kept = blocks.filter((b) => b.rows.length > 0);
  const all = kept.flatMap((b) => b.rows);
  return { columns: cols, blocks: kept, totalRows: all.length, flaggedRows: all.filter((r) => r.flagged).length };
}

/** Sugerează grupa pentru un bloc, după etichetă. Blocul fără etichetă = prima grupă. */
export function suggestGroupForBlock<G extends { id: string; name: string; sort?: number | null }>(
  label: string,
  groups: G[],
  blockIndex: number,
): G | null {
  const sorted = [...groups].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  const l = norm(label).replace(/ /g, "");
  if (l) {
    const exact = sorted.find((g) => norm(g.name).replace(/ /g, "") === l);
    if (exact) return exact;
    const partial = sorted.find((g) => {
      const n = norm(g.name).replace(/ /g, "");
      return n.includes(l) || l.includes(n);
    });
    if (partial) return partial;
    // „L3" ~ „Liga 3"
    const digits = l.replace(/\D/g, "");
    if (/^L(IGA)?\d/.test(l)) return sorted.find((g) => /LIGA/.test(norm(g.name)) && norm(g.name).includes(digits)) ?? null;
    return null;
  }
  return blockIndex === 0 ? sorted[0] ?? null : null;
}
