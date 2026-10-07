import type { Json } from "@club/shared";

/** Ce întoarce RPC-ul `club_overview()`: doar agregate, fără nume și fără diagnostice. */
export type OverviewGroup = {
  id: string;
  name: string;
  total: number;
  available: number;
  limited: number;
  out: number;
  active_injuries: number;
  days_lost: number;
};

export type Overview = {
  today: string;
  season_start: string;
  groups: OverviewGroup[];
  totals: {
    players: number;
    available: number;
    limited: number;
    out: number;
    active_injuries: number;
    injuries_season: number;
    recurrences_season: number;
    days_lost_season: number;
  };
  injuries_by_zone: Array<{ zone: string; count: number }>;
  injuries_by_month: Array<{ month: string; count: number }>;
  trend: Array<{ date: string; available: number; limited: number; out: number; total: number }>;
};

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const arr = (v: unknown): Array<Record<string, unknown>> => (Array.isArray(v) ? v.map(obj) : []);

/** Citește defensiv răspunsul JSON al RPC-ului (tipul generat este `Json`). */
export function parseOverview(raw: Json | null | undefined): Overview | null {
  const r = obj(raw);
  if (!r.totals) return null;
  const t = obj(r.totals);
  return {
    today: str(r.today),
    season_start: str(r.season_start),
    groups: arr(r.groups).map((g) => ({
      id: str(g.id), name: str(g.name), total: num(g.total), available: num(g.available), limited: num(g.limited),
      out: num(g.out), active_injuries: num(g.active_injuries), days_lost: num(g.days_lost),
    })),
    totals: {
      players: num(t.players), available: num(t.available), limited: num(t.limited), out: num(t.out),
      active_injuries: num(t.active_injuries), injuries_season: num(t.injuries_season),
      recurrences_season: num(t.recurrences_season), days_lost_season: num(t.days_lost_season),
    },
    injuries_by_zone: arr(r.injuries_by_zone).map((z) => ({ zone: str(z.zone), count: num(z.count) })),
    injuries_by_month: arr(r.injuries_by_month).map((m) => ({ month: str(m.month), count: num(m.count) })),
    trend: arr(r.trend).map((w) => ({
      date: str(w.date).slice(0, 10), available: num(w.available), limited: num(w.limited), out: num(w.out), total: num(w.total),
    })),
  };
}

export function percent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/** Lunile sezonului până azi (AAAA-LL), ca lunile fără accidentări să apară cu zero. */
export function seasonMonths(seasonStart: string, today: string): string[] {
  const out: string[] = [];
  let [y, m] = seasonStart.split("-").map(Number);
  const [ty, tm] = today.split("-").map(Number);
  if (!y || !m || !ty || !tm) return out;
  while ((y < ty || (y === ty && m <= tm)) && out.length < 24) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}
