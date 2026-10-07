/**
 * Indicatorii fizici păstrați pe coloane proprii în `physical_metrics`, în ordinea de afișare.
 * Etichetele sunt în `messages/ro/physical.ts` (cheia = numele coloanei).
 */
export const METRIC_KEYS = [
  "duration_min", "total_distance_m", "hsr_distance_m", "sprint_distance_m", "sprint_count", "max_speed_kmh",
  "accelerations", "decelerations", "player_load", "hr_avg", "hr_max",
] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

/** Câte zecimale are sens să afișăm / să acceptăm pentru fiecare indicator. */
export const METRIC_DECIMALS: Record<MetricKey, number> = {
  duration_min: 0, total_distance_m: 0, hsr_distance_m: 0, sprint_distance_m: 0, sprint_count: 0, max_speed_kmh: 1,
  accelerations: 0, decelerations: 0, player_load: 0, hr_avg: 0, hr_max: 0,
};

/** Limite de bun-simț, ca o greșeală de tastare să nu ajungă în baza de date. */
export const METRIC_MAX: Record<MetricKey, number> = {
  duration_min: 300, total_distance_m: 30000, hsr_distance_m: 10000, sprint_distance_m: 5000, sprint_count: 300, max_speed_kmh: 45,
  accelerations: 1000, decelerations: 1000, player_load: 5000, hr_avg: 230, hr_max: 240,
};

export const INTEGER_METRICS: ReadonlySet<MetricKey> = new Set(["sprint_count", "accelerations", "decelerations", "hr_avg", "hr_max"]);

export type MetricValues = Record<MetricKey, number | null>;

export const SESSION_TYPE_CODES = ["training", "match", "test", "other"] as const;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** Valorile numerice vin din Postgres ca numere sau ca text (numeric). */
export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Text introdus de utilizator („6.250", „31,4") → număr; null dacă este gol; NaN dacă nu se poate citi. */
export function parseDecimal(text: string): number | null {
  const s = text.trim().replace(/\s/g, "");
  if (!s) return null;
  if (!/^\d+([.,]\d+)?$/.test(s)) return Number.NaN;
  return Number(s.replace(",", "."));
}

export function formatNumber(v: number | null | undefined, decimals = 0): string {
  if (v === null || v === undefined) return "—";
  return new Intl.NumberFormat("ro-RO", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);
}

const nf2 = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 });
export function formatValue(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : nf2.format(v);
}

export function mean(values: Array<number | null | undefined>): number | null {
  const v = values.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}

/** Diferența față de o valoare de referință, cu sensul „mai bine / mai slab" după tipul testului. */
export function compare(value: number, reference: number | null | undefined, lowerIsBetter: boolean): { diff: number; better: boolean | null } | null {
  if (reference === null || reference === undefined) return null;
  const diff = Math.round((value - reference) * 100) / 100;
  return { diff, better: diff === 0 ? null : lowerIsBetter ? diff < 0 : diff > 0 };
}

/** Cod stabil pentru un test nou, din nume: „Sprint 20 m" → „sprint_20_m". */
export function testCode(name: string): string {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "test";
}
