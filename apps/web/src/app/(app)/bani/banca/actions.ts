"use server";
import { z } from "zod";
import { fail, run } from "@/lib/actions";
import { getT } from "@/messages";

const FINANCE = ["admin", "secretary", "accountant"] as const;
const paths = ["/bani", "/bani/banca", "/bani/incasari", "/bani/taxe", "/bani/cheltuieli"];

const Line = z.object({
  hash: z.string().min(8).max(64),
  booked_on: z.iso.date(),
  amount: z.number().int().refine((v) => v !== 0),
  description: z.string().max(500),
  counterparty: z.string().max(200),
});

export type BankPreviewRow = { hash: string; duplicate: boolean; guardian_id: string | null; guardian_name: string | null; payment_ref: string | null; open_balance: number | null; expense_id: string | null; expense_label: string | null };

export async function previewBank(input: { lines: Array<z.input<typeof Line>> }) {
  return run<BankPreviewRow[]>({ roles: [...FINANCE] }, async ({ db }) => {
    const lines = z.array(Line).max(5000).parse(input.lines);
    const { data, error } = await db.rpc("preview_bank_lines", { p_lines: lines });
    if (error) fail(error.message);
    return (data as BankPreviewRow[]) ?? [];
  });
}

const Decided = Line.extend({
  action: z.enum(["match_guardian", "match_expense", "unassigned_payment", "ignore", "leave"]),
  guardian_id: z.uuid().nullable().optional(),
  expense_id: z.uuid().nullable().optional(),
  note: z.string().max(200).optional(),
});

export async function importBank(input: { fileName: string; bank?: string; lines: Array<z.input<typeof Decided>> }) {
  return run<{ inserted: number; duplicates: number; matched: number }>({ roles: [...FINANCE], revalidate: paths }, async ({ db }) => {
    const lines = z.array(Decided).min(1).max(5000).parse(input.lines);
    const { data, error } = await db.rpc("import_bank_statement", { p: { file_name: z.string().max(200).parse(input.fileName), bank: input.bank ?? null, lines } });
    if (error) fail(error.message);
    return data as { inserted: number; duplicates: number; matched: number };
  });
}

export async function resolveLine(input: { lineId: string; action: "match_guardian" | "match_expense" | "unassigned_payment" | "ignore" | "reopen"; guardianId?: string; expenseId?: string; note?: string }) {
  return run({ roles: [...FINANCE], revalidate: paths, message: getT().money.bank.resolved }, async ({ db }) => {
    const { error } = await db.rpc("resolve_bank_line", {
      p_line: z.uuid().parse(input.lineId),
      p: { action: input.action, guardian_id: input.guardianId ?? null, expense_id: input.expenseId ?? null, note: z.string().max(200).optional().parse(input.note) ?? null },
    });
    if (error) fail(error.message);
    return null;
  });
}

/** Rând de plată din extras → cheltuială nouă, legată de rând. */
export async function expenseFromLine(input: { lineId: string; description: string; departmentId: string | null; supplier?: string; invoiceNo?: string }) {
  return run({ roles: [...FINANCE], revalidate: paths, message: getT().money.expenses.saved }, async ({ db, ctx }) => {
    const lineId = z.uuid().parse(input.lineId);
    const { data: line } = await db.from("bank_lines").select("id, amount, booked_on, counterparty, status").eq("id", lineId).maybeSingle();
    if (!line || line.status !== "unmatched" || line.amount >= 0) fail("Rândul nu mai poate deveni cheltuială.");
    const { data: exp, error } = await db.from("expenses").insert({
      club_id: ctx.club.id, description: z.string().trim().min(1, "Scrie descrierea.").max(300).parse(input.description),
      department_id: input.departmentId ? z.uuid().parse(input.departmentId) : null,
      supplier: input.supplier?.trim() || line.counterparty || null, invoice_no: input.invoiceNo?.trim() || null,
      amount: -line.amount, spent_on: line.booked_on, method: "bank", created_by: ctx.userId,
    }).select("id").single();
    if (error) fail(error.message);
    const { error: e2 } = await db.rpc("resolve_bank_line", { p_line: lineId, p: { action: "match_expense", expense_id: exp.id } });
    if (e2) fail(e2.message);
    return null;
  });
}
