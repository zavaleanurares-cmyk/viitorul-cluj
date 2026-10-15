/**
 * Extrase bancare: fișierul (CSV sau Excel, de la BT, BCR, ING, BRD, Raiffeisen…) se citește în browser,
 * coloanele se recunosc după nume (se pot corecta), iar fiecare rând devine { dată, sumă cu semn, descriere,
 * ordonator } plus o amprentă stabilă, ca reimportul aceluiași extras să nu dubleze nimic.
 */
import { norm } from "./text";
import { parseFixtureDate } from "./fixtures";
import { parseLei } from "./money";

export type BankField = "date" | "amount" | "credit" | "debit" | "description" | "counterparty" | "reference";

const BANK_HINTS: Record<BankField, string[]> = {
  date: ["data", "data tranzactie", "data tranzactiei", "data inregistrare", "data inregistrarii", "data operatiunii", "data contabila", "booking date", "date"],
  amount: ["suma", "valoare", "amount", "suma tranzactie"],
  credit: ["credit", "suma credit", "incasari", "intrari"],
  debit: ["debit", "suma debit", "plati", "iesiri"],
  description: ["descriere", "detalii", "detalii tranzactie", "descrierea tranzactiei", "explicatii", "mentiuni", "description", "details"],
  counterparty: ["ordonator", "beneficiar", "nume beneficiar ordonator", "nume ordonator beneficiar", "partener", "contrapartida", "nume", "counterparty", "denumire ordonator beneficiar"],
  reference: ["referinta", "referinta tranzactiei", "nr op", "numar document", "reference"],
};

/** Coloana fiecărui câmp, după antet. Potrivirea exactă are întâietate; apoi „conține". */
export function guessBankMapping(headers: string[]): Partial<Record<BankField, number>> {
  const out: Partial<Record<BankField, number>> = {};
  const used = new Set<number>();
  const order: BankField[] = ["date", "credit", "debit", "amount", "description", "counterparty", "reference"];
  for (const field of order) {
    let idx = headers.findIndex((h, i) => !used.has(i) && BANK_HINTS[field].some((k) => norm(h) === norm(k)));
    if (idx < 0) idx = headers.findIndex((h, i) => !used.has(i) && norm(h).length > 2 && BANK_HINTS[field].some((k) => k.length > 3 && norm(h).includes(norm(k))));
    if (idx >= 0) { out[field] = idx; used.add(idx); }
  }
  // „data valutei" nu e data tranzacției, dar e mai bună decât nimic
  if (out.date === undefined) {
    const v = headers.findIndex((h, i) => !used.has(i) && norm(h).startsWith("DATA"));
    if (v >= 0) out.date = v;
  }
  return out;
}

/** Rândul de antet: primul rând care conține și o dată, și o sumă/credit (extrasele au adesea câteva rânduri de titlu). */
export function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const m = guessBankMapping(rows[i].map((c) => String(c ?? "")));
    if (m.date !== undefined && (m.amount !== undefined || m.credit !== undefined)) return i;
  }
  return 0;
}

export type BankLine = {
  hash: string;
  booked_on: string;
  /** bani, cu semn: + încasare, − plată */
  amount: number;
  description: string;
  counterparty: string;
};

export type BankPreview = { lines: BankLine[]; skipped: Array<{ row: number; reason: string }> };

/** FNV-1a pe 2 × 32 de biți: amprentă scurtă, aceeași în browser și pe server, fără API-uri asincrone. */
export function fingerprint(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

function amountOf(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Math.round(v * 100);
  return parseLei(String(v));
}

export function buildBankLines(rows: unknown[][], mapping: Partial<Record<BankField, number>>, opts: { fallbackYear?: number } = {}): BankPreview {
  const lines: BankLine[] = [];
  const skipped: BankPreview["skipped"] = [];
  const seen = new Map<string, number>();
  const at = (r: unknown[], f: BankField) => (mapping[f] === undefined ? undefined : r[mapping[f]!]);
  rows.forEach((r, i) => {
    if (r.every((c) => c === null || c === undefined || String(c).trim() === "")) return;
    const d = parseFixtureDate(at(r, "date"), opts.fallbackYear);
    if (!d) { skipped.push({ row: i + 1, reason: "fără dată" }); return; }
    let amount: number | null = null;
    if (mapping.credit !== undefined || mapping.debit !== undefined) {
      const cr = amountOf(at(r, "credit"));
      const db = amountOf(at(r, "debit"));
      if (cr && cr !== 0) amount = Math.abs(cr);
      else if (db && db !== 0) amount = -Math.abs(db);
    }
    if (amount === null && mapping.amount !== undefined) amount = amountOf(at(r, "amount"));
    if (!amount) { skipped.push({ row: i + 1, reason: "fără sumă" }); return; }
    const description = [at(r, "description"), at(r, "reference")].filter((x) => x !== undefined && String(x).trim() !== "").map((x) => String(x).replace(/\s+/g, " ").trim()).join(" · ");
    const counterparty = String(at(r, "counterparty") ?? "").replace(/\s+/g, " ").trim();
    const base = `${d.date}|${amount}|${norm(description)}|${norm(counterparty)}`;
    // două rânduri identice în același extras (aceeași zi, sumă și text) sunt două tranzacții, nu un duplicat
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    lines.push({ hash: fingerprint(`${base}|${n}`), booked_on: d.date, amount, description, counterparty });
  });
  return { lines, skipped };
}

/** Codul de plată al familiei dintr-un text („LR-1042", „lr 1042", „LR1042"), la fel ca guardian_by_ref din baza de date. */
export function findPaymentRef(text: string, prefix: string): string | null {
  const re = new RegExp(`(?:^|[^A-Z0-9])${prefix}[\\s\\-_./]*([0-9]{4,6})(?![0-9])`);
  const m = re.exec(String(text ?? "").toUpperCase());
  return m ? `${prefix}-${m[1]}` : null;
}
