import { describe, expect, it } from "vitest";
import { formatLei, formatIban, isValidIban, leiInWords, monthLabel, parseLei, spellNumber, suggestAllocation, vatLine } from "../src/money";
import { buildBankLines, findHeaderRow, findPaymentRef, guessBankMapping } from "../src/bank";

describe("sume", () => {
  it("afișează în stil românesc", () => {
    expect(formatLei(155401293)).toBe("1.554.012,93 lei");
    expect(formatLei(45000)).toBe("450 lei");
    expect(formatLei(45000, { decimals: "always" })).toBe("450,00 lei");
    expect(formatLei(-2500)).toBe("−25 lei");
    expect(formatLei(5, { currency: false })).toBe("0,05");
  });
  it("citește ce scrie omul", () => {
    expect(parseLei("450")).toBe(45000);
    expect(parseLei("450,5")).toBe(45050);
    expect(parseLei("1.250,00")).toBe(125000);
    expect(parseLei("1,250.00")).toBe(125000);
    expect(parseLei("1250.75")).toBe(125075);
    expect(parseLei("1.250")).toBe(125000);
    expect(parseLei("12.5")).toBe(1250);
    expect(parseLei("1 250 lei")).toBe(125000);
    expect(parseLei("-300,00")).toBe(-30000);
    expect(parseLei("abc")).toBeNull();
    expect(parseLei("1,2,3")).toBeNull();
    expect(parseLei("4,555")).toBeNull();
  });
  it("numele lunii", () => {
    expect(monthLabel("2026-10-01")).toBe("octombrie 2026");
  });
});

describe("suma în litere (DOOM)", () => {
  it("acord și „de”", () => {
    expect(leiInWords(100)).toBe("un leu");
    expect(leiInWords(200)).toBe("doi lei");
    expect(leiInWords(1200)).toBe("doisprezece lei");
    expect(leiInWords(2100)).toBe("douăzeci și unu de lei");
    expect(leiInWords(45000)).toBe("patru sute cincizeci de lei");
    expect(leiInWords(45050)).toBe("patru sute cincizeci de lei și cincizeci de bani");
    expect(leiInWords(10100)).toBe("o sută unu lei");
    expect(leiInWords(10000)).toBe("o sută de lei");
    expect(leiInWords(125000)).toBe("o mie două sute cincizeci de lei");
    expect(leiInWords(200000)).toBe("două mii de lei");
    expect(leiInWords(1200000)).toBe("douăsprezece mii de lei");
    expect(leiInWords(2100000)).toBe("douăzeci și una de mii de lei");
    expect(leiInWords(1)).toBe("un ban");
    expect(leiInWords(50)).toBe("cincizeci de bani");
    expect(leiInWords(0)).toBe("zero lei");
    expect(spellNumber(2_000_000)).toBe("două milioane");
  });
});

describe("TVA și împărțirea plăților", () => {
  it("TVA inclus și adăugat, ca în baza de date", () => {
    expect(vatLine(10, 10000, 21, true)).toEqual({ net: 82645, vat: 17355, gross: 100000 });
    expect(vatLine(2, 5000, 21, false)).toEqual({ net: 10000, vat: 2100, gross: 12100 });
    expect(vatLine(1.5, 999, 11, false)).toEqual({ net: 1499, vat: 165, gross: 1664 });
  });
  it("cele mai vechi taxe întâi, restul rămâne", () => {
    const r = suggestAllocation(50000, [
      { id: "noiembrie", balance: 45000, due_on: "2026-11-10", period: "2026-11-01" },
      { id: "octombrie", balance: 45000, due_on: "2026-10-10", period: "2026-10-01" },
    ]);
    expect(r.rows).toEqual([{ charge_id: "octombrie", amount: 45000 }, { charge_id: "noiembrie", amount: 5000 }]);
    expect(r.left).toBe(0);
    expect(suggestAllocation(100000, [{ id: "a", balance: 30000, due_on: "2026-10-10" }]).left).toBe(70000);
  });
});

describe("IBAN", () => {
  it("verifică cifra de control", () => {
    expect(isValidIban("RO49 AAAA 1B31 0075 9384 0000")).toBe(true);
    expect(isValidIban("RO49AAAA1B31007593840001")).toBe(false);
    expect(isValidIban("RO49AAAA1B3100759384")).toBe(false);
    expect(formatIban("ro49aaaa1b31007593840000")).toBe("RO49 AAAA 1B31 0075 9384 0000");
  });
});

describe("extras bancar", () => {
  const bt = [
    ["Extras de cont", "", "", "", "", ""],
    ["Cont: RO49AAAA1B31007593840000", "", "", "", "", ""],
    ["Data tranzactie", "Data valuta", "Descriere", "Referinta tranzactiei", "Debit", "Credit"],
    ["12.10.2026", "12.10.2026", "Incasare OP; ordonator POPESCU ION; Taxa oct LR-1042", "OP123", "", "450,00"],
    ["12.10.2026", "12.10.2026", "Plata factura Magazin Sport", "OP124", "1.200,00", ""],
    ["12.10.2026", "12.10.2026", "Incasare OP; ordonator POPESCU ION; Taxa oct LR-1042", "OP123", "", "450,00"],
    ["", "", "Sold final", "", "", ""],
  ];
  const h = findHeaderRow(bt);
  const mapping = guessBankMapping(bt[h].map(String));
  const { lines, skipped } = buildBankLines(bt.slice(h + 1), mapping);
  it("găsește antetul și coloanele", () => {
    expect(h).toBe(2);
    expect(mapping).toMatchObject({ date: 0, description: 2, reference: 3, debit: 4, credit: 5 });
  });
  it("sume cu semn, rânduri identice păstrate separat, rândurile goale sărite", () => {
    expect(lines.map((l) => l.amount)).toEqual([45000, -120000, 45000]);
    expect(lines[0].booked_on).toBe("2026-10-12");
    expect(lines[0].hash).not.toBe(lines[2].hash);
    expect(skipped).toEqual([{ row: 4, reason: "fără dată" }]);
  });
  it("aceeași amprentă la reimport", () => {
    expect(buildBankLines(bt.slice(h + 1), mapping).lines.map((l) => l.hash)).toEqual(lines.map((l) => l.hash));
  });
  it("coloana unică de sumă (BCR)", () => {
    const m = guessBankMapping(["Data inregistrare", "Suma", "Valuta", "Nume beneficiar/ordonator", "Detalii tranzactie"]);
    expect(m).toMatchObject({ date: 0, amount: 1, counterparty: 3, description: 4 });
    expect(buildBankLines([["2026-10-03", "-35.5", "RON", "ENEL", "Factura"]], m).lines[0].amount).toBe(-3550);
  });
  it("codul de plată, oricum ar fi scris", () => {
    expect(findPaymentRef("taxa oct lr 1042 popescu", "LR")).toBe("LR-1042");
    expect(findPaymentRef("TAXA LR1042", "LR")).toBe("LR-1042");
    expect(findPaymentRef("FLR-1042", "LR")).toBeNull();
    expect(findPaymentRef("LR-10425", "LR")).toBe("LR-10425");
  });
});
