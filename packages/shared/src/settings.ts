import type { Json } from "./database.types";

export type ClubSettings = {
  timezone: string;
  /** început de sezon (AAAA-LL-ZZ); implicit 1 iulie */
  season_start: string | null;
  /** ora la care pleacă mementoul de chestionar */
  reminder_hour: number;
  medical_visa_validity_months: number;
  /** după câte luni de inactivitate un jucător apare pe lista de ștergere/anonimizare */
  retention_months: number;
  /** greutatea și compoziția corporală se urmăresc doar de la această vârstă (implicit 14 ani) */
  body_min_age: number;
  alerts: {
    fatigue_threshold: number;
    muscle_load_threshold: number;
    /** creștere față de media personală pe 28 de zile */
    spike_delta: number;
    pain_intensity_threshold: number;
    missing_days: number;
    visa_days_before: number;
  };
};

export const DEFAULT_SETTINGS: ClubSettings = {
  timezone: "Europe/Bucharest",
  season_start: null,
  reminder_hour: 9,
  medical_visa_validity_months: 6,
  retention_months: 36,
  body_min_age: 14,
  alerts: {
    fatigue_threshold: 8,
    muscle_load_threshold: 8,
    spike_delta: 3,
    pain_intensity_threshold: 1,
    missing_days: 3,
    visa_days_before: 30,
  },
};

export function parseSettings(raw: Json | null | undefined): ClubSettings {
  const r = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const a = (r.alerts && typeof r.alerts === "object" ? r.alerts : {}) as Record<string, unknown>;
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  return {
    timezone: typeof r.timezone === "string" ? r.timezone : DEFAULT_SETTINGS.timezone,
    season_start: typeof r.season_start === "string" ? r.season_start : null,
    reminder_hour: num(r.reminder_hour, DEFAULT_SETTINGS.reminder_hour),
    medical_visa_validity_months: num(r.medical_visa_validity_months, DEFAULT_SETTINGS.medical_visa_validity_months),
    retention_months: num(r.retention_months, DEFAULT_SETTINGS.retention_months),
    body_min_age: num(r.body_min_age, DEFAULT_SETTINGS.body_min_age),
    alerts: {
      fatigue_threshold: num(a.fatigue_threshold, DEFAULT_SETTINGS.alerts.fatigue_threshold),
      muscle_load_threshold: num(a.muscle_load_threshold, DEFAULT_SETTINGS.alerts.muscle_load_threshold),
      spike_delta: num(a.spike_delta, DEFAULT_SETTINGS.alerts.spike_delta),
      pain_intensity_threshold: num(a.pain_intensity_threshold, DEFAULT_SETTINGS.alerts.pain_intensity_threshold),
      missing_days: num(a.missing_days, DEFAULT_SETTINGS.alerts.missing_days),
      visa_days_before: num(a.visa_days_before, DEFAULT_SETTINGS.alerts.visa_days_before),
    },
  };
}

export type WellnessConfig = { sleep: boolean; stress: boolean; mood: boolean };

/** Întrebările suplimentare sunt oprite implicit; preparatorul le activează pe grupă. */
export function parseWellnessConfig(raw: Json | null | undefined): WellnessConfig {
  const r = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  return { sleep: r.sleep === true, stress: r.stress === true, mood: r.mood === true };
}
