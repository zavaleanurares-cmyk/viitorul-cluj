import { diffDays, type Availability, type ClubStatus } from "@club/shared";

/**
 * Reguli de domeniu ale modulului, fără acces la date (se pot folosi și în componente client).
 */

export const AVAILABILITY_ORDER: Availability[] = ["out", "limited", "full"];

export function availabilityOf(status: Pick<ClubStatus, "availability"> | null | undefined): Availability {
  const a = status?.availability;
  return a === "out" || a === "limited" ? a : "full";
}

/** Starea „accidentat" a clubului: codul ACC, dacă există și este activ. */
export function injuredStatus(statuses: ClubStatus[]): ClubStatus | null {
  return statuses.find((s) => s.is_active && s.code === "ACC") ?? null;
}

/** Starea „apt": codul APT sau, în lipsă, prima stare activă cu disponibilitate completă. */
export function fitStatus(statuses: ClubStatus[]): ClubStatus | null {
  const active = statuses.filter((s) => s.is_active);
  return active.find((s) => s.code === "APT") ?? active.find((s) => s.availability === "full") ?? null;
}

export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export type VisaState = "missing" | "expired" | "expiring" | "valid";

export function visaState(expiresOn: string | null | undefined, today: string, warnDays = 30): VisaState {
  if (!expiresOn) return "missing";
  const left = diffDays(today, expiresOn);
  if (left < 0) return "expired";
  if (left <= warnDays) return "expiring";
  return "valid";
}

type InjuryDates = { occurred_on: string; actual_return_on: string | null };

/** Zile de la accidentare până la revenire (sau până azi, dacă accidentarea este încă deschisă). */
export function daysLost(injury: InjuryDates, today: string): number {
  const end = injury.actual_return_on ?? today;
  return Math.max(0, diffDays(injury.occurred_on, end));
}

/**
 * Zile indisponibile într-un interval: reuniunea perioadelor de accidentare (două accidentări
 * suprapuse nu se numără de două ori).
 */
export function daysUnavailable(injuries: InjuryDates[], from: string, today: string): number {
  const spans = injuries
    .map((i) => ({ start: i.occurred_on < from ? from : i.occurred_on, end: i.actual_return_on ?? today }))
    .map((s) => ({ start: s.start, end: s.end > today ? today : s.end }))
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start.localeCompare(b.start));
  let total = 0;
  let cursor: string | null = null;
  for (const s of spans) {
    const start: string = cursor && cursor > s.start ? cursor : s.start;
    if (s.end > start) {
      total += diffDays(start, s.end);
      cursor = s.end;
    }
  }
  return total;
}

/** Tipurile de fișier acceptate în bucketul „medical" (aceleași ca în politica bucketului). */
export const MEDICAL_FILE_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  zip: "application/zip",
};
export const MEDICAL_FILE_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.zip";
export const MEDICAL_FILE_MAX_BYTES = 25 * 1024 * 1024;

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/** Tipul MIME după extensie (browserele nu raportează mereu corect HEIC și ZIP). */
export function medicalMimeType(fileName: string): string | null {
  return MEDICAL_FILE_TYPES[fileExtension(fileName)] ?? null;
}

export function formatBytes(n: number | null | undefined): string {
  if (!n) return "";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
