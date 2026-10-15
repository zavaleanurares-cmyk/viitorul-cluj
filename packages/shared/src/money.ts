/**
 * Bani: sume în bani (întregi; 1 leu = 100 de bani), afișare în română, suma în litere pentru chitanțe,
 * TVA, împărțirea unei plăți pe taxe. Aceleași reguli ca în funcțiile din baza de date, ca previzualizarea
 * din browser să arate exact ce va salva serverul.
 */
import { MONTHS_RO } from "./dates";

// ---------------------------------------------------------------------------
// Afișare
// ---------------------------------------------------------------------------
function groupThousands(n: string): string {
  return n.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * „1.554.012,93 lei". Cu `decimals: "auto"` (implicit), sumele întregi apar fără „,00": „450 lei".
 * `currency: false` lasă doar cifrele.
 */
export function formatLei(bani: number | null | undefined, opts: { decimals?: "auto" | "always"; currency?: boolean; sign?: boolean } = {}): string {
  const v = Math.round(Number(bani ?? 0));
  const neg = v < 0;
  const abs = Math.abs(v);
  const whole = groupThousands(String(Math.floor(abs / 100)));
  const cents = String(abs % 100).padStart(2, "0");
  const body = (opts.decimals ?? "auto") === "auto" && cents === "00" ? whole : `${whole},${cents}`;
  const sign = neg ? "−" : opts.sign && v > 0 ? "+" : "";
  return `${sign}${body}${opts.currency === false ? "" : " lei"}`;
}

/** Text introdus de om → bani. Acceptă „450", „450,5", „1.250,00", „1250.00", „1 250 lei". Altfel null. */
export function parseLei(input: unknown): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input * 100) : null;
  let s = String(input ?? "").trim().replace(/\s*(lei|ron|leu)\.?\s*$/i, "").replace(/[\s ]/g, "");
  if (!s) return null;
  const neg = /^[-−]/.test(s);
  s = s.replace(/^[-−+]/, "");
  if (!/^[\d.,]+$/.test(s)) return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let intPart: string;
  let frac = "";
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? "." : ",";
    const i = s.lastIndexOf(dec);
    intPart = s.slice(0, i).replace(/[.,]/g, "");
    frac = s.slice(i + 1);
  } else if (lastComma >= 0) {
    const parts = s.split(",");
    if (parts.length > 2) return null;
    intPart = parts[0];
    frac = parts[1];
  } else if (lastDot >= 0) {
    const parts = s.split(".");
    // „1.250" sau „1.250.000" = separator de mii; „12.5" / „12.50" = zecimale
    if (parts.length > 2 || (parts[1].length === 3 && parts[0].length <= 3 && parts[0] !== "0")) {
      if (!parts.slice(1).every((p) => p.length === 3)) return null;
      intPart = parts.join("");
    } else {
      intPart = parts[0];
      frac = parts[1];
    }
  } else {
    intPart = s;
  }
  if (!/^\d*$/.test(intPart) || !/^\d{0,2}$/.test(frac)) return null;
  const v = Number(intPart || "0") * 100 + Number((frac + "00").slice(0, 2));
  return neg ? -v : v;
}

/** „2026-10-01" → „octombrie 2026" */
export function monthLabel(period: string | null | undefined): string {
  if (!period) return "";
  const [y, m] = period.split("-").map(Number);
  return `${MONTHS_RO[m - 1]} ${y}`;
}

/** „2026-10-01" → „oct." */
export function monthShort(period: string): string {
  const m = Number(period.slice(5, 7));
  return ["ian.", "feb.", "mar.", "apr.", "mai", "iun.", "iul.", "aug.", "sept.", "oct.", "nov.", "dec."][m - 1];
}

// ---------------------------------------------------------------------------
// Suma în litere (pentru chitanțe): „patru sute cincizeci de lei și cincizeci de bani"
// ---------------------------------------------------------------------------
type Gender = "m" | "f" | "n";
const UNITS = ["", "unu", "doi", "trei", "patru", "cinci", "șase", "șapte", "opt", "nouă"];
const TEENS = ["zece", "unsprezece", "doisprezece", "treisprezece", "paisprezece", "cincisprezece", "șaisprezece", "șaptesprezece", "optsprezece", "nouăsprezece"];
const TENS = ["", "", "douăzeci", "treizeci", "patruzeci", "cincizeci", "șaizeci", "șaptezeci", "optzeci", "nouăzeci"];

/** Numeral de sine stătător (0–999), acordat: 1 → unu/una, 2 → doi/două, 12 → doisprezece/douăsprezece. */
function under1000(n: number, g: Gender): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h === 1) parts.push("o sută");
  else if (h === 2) parts.push("două sute");
  else if (h > 2) parts.push(`${UNITS[h]} sute`);
  if (rest >= 20) {
    const u = rest % 10;
    const tens = TENS[Math.floor(rest / 10)];
    if (u === 0) parts.push(tens);
    else if (u === 1) parts.push(`${tens} și ${g === "f" ? "una" : "unu"}`);
    else if (u === 2) parts.push(`${tens} și ${g === "m" ? "doi" : "două"}`);
    else parts.push(`${tens} și ${UNITS[u]}`);
  } else if (rest >= 10) {
    parts.push(rest === 12 && g !== "m" ? "douăsprezece" : TEENS[rest - 10]);
  } else if (rest > 0) {
    parts.push(rest === 1 ? (g === "f" ? "una" : "unu") : rest === 2 ? (g === "m" ? "doi" : "două") : UNITS[rest]);
  }
  return parts.join(" ");
}

/** „de" între numeral și substantiv: de la 20 în sus, când ultimele două cifre sunt 00 sau ≥ 20 (DOOM). */
const needsDe = (n: number) => n >= 20 && (n % 100 === 0 || n % 100 >= 20);

/** Numeral + substantiv: 1 → „un leu" / „o mie", 2 → „doi lei" / „două mii", 21 → „douăzeci și unu de lei". */
function counted(n: number, one: string, many: string, g: Gender): string {
  if (n === 1) return `${g === "f" ? "o" : "un"} ${one}`;
  return `${spellNumber(n, g)}${needsDe(n) ? " de" : ""} ${many}`;
}

/** Numărul în litere, acordat cu genul substantivului care urmează. */
export function spellNumber(n: number, g: Gender = "m"): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return "zero";
  const parts: string[] = [];
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  if (millions) parts.push(counted(millions, "milion", "milioane", "n"));
  if (thousands) parts.push(counted(thousands, "mie", "mii", "f"));
  if (rest) parts.push(under1000(rest, g));
  return parts.join(" ");
}

/** „patru sute cincizeci de lei și cincizeci de bani"; „un leu"; „cincizeci de bani". */
export function leiInWords(bani: number): string {
  const v = Math.round(Math.abs(bani));
  const lei = Math.floor(v / 100);
  const b = v % 100;
  const parts: string[] = [];
  if (lei > 0 || b === 0) parts.push(lei === 0 ? "zero lei" : counted(lei, "leu", "lei", "m"));
  if (b > 0) parts.push(counted(b, "ban", "bani", "m"));
  return parts.join(" și ");
}

// ---------------------------------------------------------------------------
// TVA pe un articol de referat (identic cu save_purchase_request)
// ---------------------------------------------------------------------------
export function vatLine(quantity: number, unitPrice: number, vatRate: number, includesVat: boolean): { net: number; vat: number; gross: number } {
  if (includesVat) {
    const gross = Math.round(quantity * unitPrice);
    const net = Math.round((gross * 100) / (100 + vatRate));
    return { net, vat: gross - net, gross };
  }
  const net = Math.round(quantity * unitPrice);
  const vat = Math.round((net * vatRate) / 100);
  return { net, vat, gross: net + vat };
}

// ---------------------------------------------------------------------------
// Împărțirea unei plăți pe taxe: cele mai vechi întâi (identic cu private.auto_allocate)
// ---------------------------------------------------------------------------
export type OpenCharge = { id: string; balance: number; due_on: string; period?: string | null; issued_at?: string };

export function suggestAllocation(amount: number, charges: OpenCharge[]): { rows: Array<{ charge_id: string; amount: number }>; left: number } {
  const sorted = [...charges]
    .filter((c) => c.balance > 0)
    .sort((a, b) => a.due_on.localeCompare(b.due_on) || (a.period ?? "9999").localeCompare(b.period ?? "9999") || (a.issued_at ?? "").localeCompare(b.issued_at ?? ""));
  let left = Math.max(0, Math.round(amount));
  const rows: Array<{ charge_id: string; amount: number }> = [];
  for (const c of sorted) {
    if (left <= 0) break;
    const take = Math.min(left, c.balance);
    rows.push({ charge_id: c.id, amount: take });
    left -= take;
  }
  return { rows, left };
}

// ---------------------------------------------------------------------------
// Stări și etichete
// ---------------------------------------------------------------------------
export type ChargeState = "open" | "partial" | "paid" | "waived" | "cancelled";

/** Starea afișată: „open" devine „overdue" după scadență. */
export function chargeDisplayState(state: string, dueOn: string, today: string): ChargeState | "overdue" {
  if ((state === "open" || state === "partial") && dueOn < today) return "overdue";
  return state as ChargeState;
}

export const CHARGE_STATE_LABELS: Record<ChargeState | "overdue", string> = {
  open: "De plată",
  partial: "Plătită parțial",
  paid: "Plătită",
  waived: "Scutit",
  cancelled: "Anulată",
  overdue: "Restantă",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Numerar",
  bank: "Transfer bancar",
  online: "Online",
  card: "Card (POS)",
};

export const CHARGE_KIND_LABELS: Record<string, string> = {
  monthly: "Taxă lunară",
  one_off: "Plată unică",
  camp: "Cantonament",
  equipment: "Echipament",
  insurance: "Asigurare",
  other: "Altceva",
};

export const ADJUSTMENT_REASON_LABELS: Record<string, string> = {
  sibling: "Frați",
  scholarship: "Bursă",
  injury: "Accidentare",
  pause: "Pauză",
  staff_child: "Copil de angajat",
  other: "Alt motiv",
};

export const PURCHASE_STATUS_LABELS: Record<string, string> = {
  draft: "Ciornă",
  submitted: "De aprobat",
  approved: "Aprobat",
  rejected: "Respins",
  completed: "Cumpărat",
  cancelled: "Anulat",
};

export const BONUS_TRIGGER_LABELS: Record<string, string> = {
  win: "Victorie",
  draw: "Egal",
  goal: "Gol marcat",
  clean_sheet: "Fără gol primit",
  appearance: "A jucat",
  starter: "Titular",
};

// ---------------------------------------------------------------------------
// IBAN (verificare mod 97, ca să nu apară pe chitanțe și în aplicație un cont greșit)
// ---------------------------------------------------------------------------
export function normalizeIban(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}

export function isValidIban(input: string): boolean {
  const iban = normalizeIban(input);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(iban)) return false;
  if (iban.startsWith("RO") && iban.length !== 24) return false;
  const moved = iban.slice(4) + iban.slice(0, 4);
  let rem = 0;
  for (const ch of moved) {
    const v = /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
    for (const d of v) rem = (rem * 10 + Number(d)) % 97;
  }
  return rem === 1;
}

/** „RO49AAAA1B31007593840000" → „RO49 AAAA 1B31 0075 9384 0000" */
export function formatIban(input: string | null | undefined): string {
  return normalizeIban(input ?? "").replace(/(.{4})/g, "$1 ").trim();
}
