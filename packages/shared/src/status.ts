import { norm } from "./text";

/** Codurile de stare implicite. Lista efectivă este configurabilă pe club (tabelul club_statuses). */
export const DEFAULT_STATUS_CODES = ["APT", "OBOSEALA", "READAPTARE", "ACC", "ALT_MOTIV"] as const;
export type DefaultStatusCode = (typeof DEFAULT_STATUS_CODES)[number];

export type StatusTone = "green" | "yellow" | "orange" | "red" | "gray" | "blue";
export type Availability = "full" | "limited" | "out";

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  full: "Disponibil",
  limited: "Disponibil parțial",
  out: "Indisponibil",
};

export type ParsedStatus = {
  code: DefaultStatusCode;
  /** textul original, păstrat în observații când spune mai mult decât codul */
  note: string | null;
  flagged: boolean;
  reason: string | null;
};

/** Mapează textul liber din coloana „stare de sănătate" pe una dintre stările clubului. */
export function parseStatusText(input: unknown): ParsedStatus {
  const original = String(input ?? "").replace(/\s+/g, " ").trim();
  const n = norm(original);
  if (!n) return { code: "APT", note: null, flagged: true, reason: "Stare necompletată în tabel; setat APT" };
  if (n === "APT" || n === "APTA" || n === "OK") return { code: "APT", note: null, flagged: false, reason: null };
  if (/^ACC\b/.test(n) || /\bACCIDENT/.test(n)) {
    return { code: "ACC", note: n === "ACC" || n === "ACCIDENTAT" ? null : original, flagged: false, reason: null };
  }
  if (/\b(READAPTARE|RECUPERARE|REABILITARE)\b/.test(n)) {
    return { code: "READAPTARE", note: n === "READAPTARE LA EFORT" || n === "READAPTARE" ? null : original, flagged: false, reason: null };
  }
  if (/\b(OBOSEAL\w*|OBOSIT\w*|FATIGUE)\b/.test(n)) {
    return { code: "OBOSEALA", note: n === "OBOSEALA" ? null : original, flagged: false, reason: null };
  }
  if (/\b(RACIT\w*|RACEAL\w*|GRIP\w*|VIROZ\w*|FEBR\w*|BOLNAV\w*|INDIGEST\w*)\b/.test(n)) {
    return { code: "ALT_MOTIV", note: original, flagged: false, reason: null };
  }
  if (/\bREVINE\b/.test(n)) {
    return {
      code: "ALT_MOTIV", note: original, flagged: true,
      reason: `Motivul absenței nu reiese din text: „${original}"`,
    };
  }
  return { code: "ALT_MOTIV", note: original, flagged: true, reason: `Stare nerecunoscută: „${original}"` };
}

export type ParsedScore = { value: number | null; flagged: boolean; reason: string | null };

/** Scor 1–10 dintr-o celulă. Valorile neregulate („3/4", „5,5") se importă aproximat și se marchează. */
export function parseScore(input: unknown): ParsedScore {
  const original = String(input ?? "").trim();
  if (!original || /^[-–—]+$/.test(original)) return { value: null, flagged: false, reason: null };
  if (/^\d+$/.test(original)) {
    const v = Number(original);
    if (v >= 1 && v <= 10) return { value: v, flagged: false, reason: null };
    return { value: null, flagged: true, reason: `Valoare în afara scalei 1–10: „${original}"` };
  }
  const range = /^(\d+(?:[.,]\d+)?)\s*[\/\-–]\s*(\d+(?:[.,]\d+)?)$/.exec(original);
  if (range) {
    // „3/4" = între 3 și 4. Păstrăm valoarea mai mare (varianta prudentă) și marcăm rândul.
    const a = Number(range[1].replace(",", "."));
    const b = Number(range[2].replace(",", "."));
    const v = Math.round(Math.max(a, b));
    if (v >= 1 && v <= 10) return { value: v, flagged: true, reason: `Valoare dublă „${original}"; importat ${v}` };
    return { value: null, flagged: true, reason: `Valoare neclară: „${original}"` };
  }
  const dec = /^\d+[.,]\d+$/.exec(original);
  if (dec) {
    const v = Math.round(Number(original.replace(",", ".")));
    if (v >= 1 && v <= 10) return { value: v, flagged: true, reason: `Valoare zecimală „${original}"; importat ${v}` };
  }
  return { value: null, flagged: true, reason: `Valoare neclară: „${original}"` };
}
