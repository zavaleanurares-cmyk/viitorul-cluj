import { addDays, formatDateShort, isBodyZone, zoneIsSided, zoneLabel, type WellnessEntry } from "@club/shared";

/**
 * Reguli de afișare pentru chestionare, fără acces la date (se folosesc și pe server, și în browser).
 */

export type Thresholds = { fatigue: number; muscle: number };

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Chestionar cu cel puțin una dintre cele două scale completate. */
export function isFilled(e: Pick<WellnessEntry, "fatigue" | "muscle_load"> | null | undefined): boolean {
  return !!e && (e.fatigue !== null || e.muscle_load !== null);
}

export function hasPain(e: Pick<WellnessEntry, "pain_zone" | "pain_note"> | null | undefined): boolean {
  return !!e && (!!e.pain_zone || !!e.pain_note?.trim());
}

const SIDE_SHORT: Record<string, string> = { left: "stg.", right: "dr.", both: "bilat." };

function rawObject(raw: WellnessEntry["raw"]): Record<string, unknown> | null {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
}

/** Textul scris de club în tabelul importat pentru zona dureroasă (ex. „hamstring", „Knee"), dacă există. */
export function importedPainText(e: Pick<WellnessEntry, "source" | "raw">): string | null {
  if (e.source !== "import") return null;
  const v = rawObject(e.raw)?.pain;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * Zona dureroasă, pe scurt, pentru o celulă din grilă.
 * La rândurile importate păstrăm cuvântul clubului (grila trebuie să arate ca tabelul lor);
 * la cele din aplicație, zona de pe harta corpului, prescurtată.
 */
export function painShort(e: Pick<WellnessEntry, "pain_zone" | "pain_side" | "pain_note" | "source" | "raw">): string {
  const imported = importedPainText(e);
  if (imported) return imported;
  if (e.pain_zone) {
    const base = zoneLabel(e.pain_zone, null, true);
    const side = e.pain_side && zoneIsSided(e.pain_zone) ? SIDE_SHORT[e.pain_side] : null;
    return side ? `${base} ${side}` : base;
  }
  return e.pain_note?.trim() ?? "";
}

/** Zona dureroasă, complet: „Adductori / zona inghinală, dreapta". */
export function painFull(e: Pick<WellnessEntry, "pain_zone" | "pain_side" | "pain_note">): string {
  if (e.pain_zone) return zoneLabel(e.pain_zone, e.pain_side);
  return e.pain_note?.trim() ?? "";
}

/** Valorile originale dintr-un rând importat, în ordinea din chestionar. */
export function rawValues(raw: WellnessEntry["raw"]): { fatigue: string | null; muscle: string | null; pain: string | null } | null {
  const r = rawObject(raw);
  if (!r) return null;
  const s = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : null);
  const out = { fatigue: s(r.fatigue), muscle: s(r.muscle_load), pain: s(r.pain) };
  return out.fatigue || out.muscle || out.pain ? out : null;
}

export function validZone(zone: string | null | undefined): string | null {
  return isBodyZone(zone) ? zone : null;
}

/** „28.09 – 04.10.2026" */
export function weekLabel(monday: string): string {
  return `${formatDateShort(monday, false)} – ${formatDateShort(addDays(monday, 6))}`;
}

export function percent(part: number, total: number): number | null {
  return total > 0 ? Math.round((part / total) * 100) : null;
}

const nf1 = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 1 });
export function fmt1(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : nf1.format(v);
}
