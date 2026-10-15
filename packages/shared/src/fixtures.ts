/**
 * Importul programului și al clasamentului din listele federației (FRF, AJF, AMFB):
 * tabel lipit din browser sau fișier Excel/CSV → rânduri pentru RPC-urile import_fixtures / import_standings.
 * Fără rețea: totul se calculează în browser, iar utilizatorul vede previzualizarea înainte de import.
 */
import { norm } from "./text";
import { zonedToUtc } from "./schedule";

export type FixtureField = "round" | "date" | "time" | "home" | "away" | "venue" | "score";
export type StandingField = "position" | "team" | "played" | "won" | "drawn" | "lost" | "goalsFor" | "goalsAgainst" | "goals" | "points";

const FIXTURE_HINTS: Record<FixtureField, string[]> = {
  round: ["etapa", "etapă", "et", "runda", "rnd", "round"],
  date: ["data", "date", "ziua", "zi"],
  time: ["ora", "ora meci", "time", "h"],
  home: ["gazde", "gazda", "echipa gazda", "acasa", "home"],
  away: ["oaspeti", "oaspete", "echipa oaspete", "deplasare", "away"],
  venue: ["teren", "stadion", "baza", "locatie", "venue"],
  score: ["scor", "rezultat", "score"],
};
const STANDING_HINTS: Record<StandingField, string[]> = {
  position: ["loc", "locul", "poz", "pozitie", "nr", "#"],
  team: ["echipa", "club", "team"],
  played: ["j", "jucate", "meciuri", "mj"],
  won: ["v", "victorii", "c", "castigate"],
  drawn: ["e", "egaluri"],
  lost: ["i", "infrangeri", "p", "pierdute"],
  goalsFor: ["gm", "goluri marcate", "marcate"],
  goalsAgainst: ["gp", "goluri primite", "primite"],
  goals: ["golaveraj", "goluri", "gol"],
  points: ["pct", "puncte", "p.", "pt"],
};

function guess<F extends string>(headers: string[], hints: Record<F, string[]>): Partial<Record<F, number>> {
  const out: Partial<Record<F, number>> = {};
  const used = new Set<number>();
  for (const field of Object.keys(hints) as F[]) {
    const idx = headers.findIndex((h, i) => !used.has(i) && hints[field].some((k) => norm(h) === norm(k)));
    const loose = idx >= 0 ? idx : headers.findIndex((h, i) => !used.has(i) && norm(h).length > 2 && hints[field].some((k) => k.length > 2 && norm(h).includes(norm(k))));
    if (loose >= 0) { out[field] = loose; used.add(loose); }
  }
  return out;
}

export const guessFixtureMapping = (headers: string[]) => guess(headers, FIXTURE_HINTS);
export const guessStandingMapping = (headers: string[]) => guess(headers, STANDING_HINTS);

/** Tabel lipit (din browser, Excel sau Word): rânduri separate de linie nouă, celule de tab (sau ; ). */
export function parsePastedTable(text: string): string[][] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim() !== "");
  const sep = lines.some((l) => l.includes("\t")) ? "\t" : lines.some((l) => l.includes(";")) ? ";" : ",";
  return lines.map((l) => l.split(sep).map((c) => c.trim()));
}

/** „17.10.2026", „17/10/26", „2026-10-17", „sâm. 17.10.2026 10:00", dată Excel → „AAAA-LL-ZZ" (+ oră, dacă există). */
export function parseFixtureDate(value: unknown, fallbackYear?: number): { date: string; time: string | null } | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const date = value.toISOString().slice(0, 10);
    const time = value.getUTCHours() || value.getUTCMinutes() ? `${String(value.getUTCHours()).padStart(2, "0")}:${String(value.getUTCMinutes()).padStart(2, "0")}` : null;
    return { date, time };
  }
  const s = String(value ?? "").trim();
  if (!s) return null;
  const time = parseTime(s.replace(/^.*?(\d{1,2}[:.]\d{2})\s*$/, "$1"));
  const iso = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (iso) return valid(+iso[1], +iso[2], +iso[3], /\d{1,2}[:.]\d{2}\s*$/.test(s) ? time : null);
  const ro = /(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?/.exec(s);
  if (!ro) return null;
  let year = ro[3] ? +ro[3] : fallbackYear ?? new Date().getFullYear();
  if (year < 100) year += 2000;
  return valid(year, +ro[2], +ro[1], /\s\d{1,2}[:.]\d{2}\s*$/.test(s) ? time : null);
}

function valid(y: number, m: number, d: number, time: string | null) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return { date: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, time };
}

/** „10:00", „10.00", „10" → „10:00". */
export function parseTime(value: unknown): string | null {
  const s = String(value ?? "").trim();
  const m = /^(\d{1,2})(?:[:.](\d{2}))?(?::\d{2})?$/.exec(s);
  if (!m) return null;
  const h = +m[1];
  const min = m[2] ? +m[2] : 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** „2-1", „2 : 1", „2–1" → [2, 1]; „-", „—" sau gol → null. */
export function parseMatchScore(value: unknown): [number, number] | null {
  const m = /^\s*(\d{1,2})\s*[-–:]\s*(\d{1,2})\s*$/.exec(String(value ?? ""));
  return m ? [+m[1], +m[2]] : null;
}

export type FixturePreview = {
  ours: Array<{ line: number; round: string; date: string; time: string; home: string; away: string; venue: string; score: [number, number] | null; isHome: boolean }>;
  others: number;
  invalid: Array<{ line: number; reason: "noDate" | "badDate" | "noTeams" }>;
  payload: Array<{ round?: string; starts_at: string; home: string; away: string; venue?: string; home_goals?: string; away_goals?: string }>;
};

/** Transformă tabelul în meciuri; păstrează doar rândurile în care apare echipa noastră (după `ownName`). */
export function buildFixtures(rows: unknown[][], mapping: Partial<Record<FixtureField, number>>, opts: { ownName: string; defaultTime: string; timezone: string; fallbackYear?: number }): FixturePreview {
  const own = norm(opts.ownName);
  const out: FixturePreview = { ours: [], others: 0, invalid: [], payload: [] };
  let lastRound = "";
  rows.forEach((r, i) => {
    const get = (f: FixtureField) => (mapping[f] !== undefined ? r[mapping[f]!] : undefined);
    const home = String(get("home") ?? "").trim();
    const away = String(get("away") ?? "").trim();
    const roundCell = String(get("round") ?? "").trim();
    if (roundCell) lastRound = roundCell.replace(/^etapa\s*/i, "");
    if (!home || !away) {
      if (home || away) out.invalid.push({ line: i + 1, reason: "noTeams" });
      return;
    }
    const isHome = own !== "" && norm(home).includes(own);
    const isAway = own !== "" && norm(away).includes(own);
    if (!isHome && !isAway) { out.others++; return; }
    const rawDate = get("date");
    if (rawDate === undefined || String(rawDate).trim() === "") { out.invalid.push({ line: i + 1, reason: "noDate" }); return; }
    const d = parseFixtureDate(rawDate, opts.fallbackYear);
    if (!d) { out.invalid.push({ line: i + 1, reason: "badDate" }); return; }
    const time = parseTime(get("time")) ?? d.time ?? opts.defaultTime;
    const venue = String(get("venue") ?? "").trim();
    const score = parseMatchScore(get("score"));
    out.ours.push({ line: i + 1, round: lastRound, date: d.date, time, home, away, venue, score, isHome });
    out.payload.push({
      round: lastRound || undefined, starts_at: zonedToUtc(d.date, time, opts.timezone), home, away, venue: venue || undefined,
      home_goals: score ? String(score[0]) : undefined, away_goals: score ? String(score[1]) : undefined,
    });
  });
  return out;
}

export type StandingRow = { position: number; team: string; played?: number; won?: number; drawn?: number; lost?: number; goals_for?: number; goals_against?: number; points?: number };

export function buildStandings(rows: unknown[][], mapping: Partial<Record<StandingField, number>>): StandingRow[] {
  const num = (v: unknown) => { const n = parseInt(String(v ?? "").replace(/[^\d-]/g, ""), 10); return Number.isFinite(n) ? n : undefined; };
  const out: StandingRow[] = [];
  for (const r of rows) {
    const get = (f: StandingField) => (mapping[f] !== undefined ? r[mapping[f]!] : undefined);
    const position = num(get("position"));
    const team = String(get("team") ?? "").trim();
    if (!position || !team) continue;
    let gf = num(get("goalsFor"));
    let ga = num(get("goalsAgainst"));
    const both = /^\s*(\d+)\s*[-:–]\s*(\d+)\s*$/.exec(String(get("goals") ?? ""));
    if (both) { gf = +both[1]; ga = +both[2]; }
    out.push({ position, team, played: num(get("played")), won: num(get("won")), drawn: num(get("drawn")), lost: num(get("lost")), goals_for: gf, goals_against: ga, points: num(get("points")) });
  }
  return out;
}
