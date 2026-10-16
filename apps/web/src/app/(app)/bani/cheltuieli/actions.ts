"use server";
import { z } from "zod";
import { fail, run } from "@/lib/actions";
import { getT } from "@/messages";
import { deleteFiles } from "@/lib/storage";

const FINANCE = ["admin", "secretary", "accountant"] as const;
const paths = ["/bani", "/bani/cheltuieli", "/bani/buget", "/bani/banca"];

const Expense = z.object({
  id: z.uuid().nullable(),
  description: z.string().trim().min(1, "Scrie descrierea.").max(300),
  department_id: z.uuid().nullable(),
  supplier: z.string().max(200).optional(),
  invoice_no: z.string().max(60).optional(),
  amount: z.number().int().positive("Scrie suma.").max(1_000_000_000),
  spent_on: z.iso.date(),
  method: z.enum(["cash", "bank", "card"]),
  group_id: z.uuid().nullable(),
  player_id: z.uuid().nullable(),
  document_path: z.string().max(300).nullable().optional(),
  documents: z.array(z.object({
    kind: z.enum(["contract", "receipt", "payment_order", "handover", "nir", "other"]),
    path: z.string().max(300),
    file_name: z.string().trim().min(1).max(200),
  })).max(20).optional(),
});

export async function saveExpense(input: z.input<typeof Expense>) {
  return run({ roles: [...FINANCE], revalidate: paths, message: getT().money.expenses.saved }, async ({ db, ctx }) => {
    const e = Expense.parse(input);
    if (e.document_path && !e.document_path.startsWith(`${ctx.club.id}/`)) fail("Document invalid.");
    const { documents, ...fields } = e;
    if (documents?.some((d) => !d.path.startsWith(`${ctx.club.id}/cheltuieli/`))) fail("Document invalid.");
    const row = { ...fields, supplier: fields.supplier?.trim() || null, invoice_no: fields.invoice_no?.trim() || null };
    const { id, ...rest } = row;
    const res = id
      ? await db.from("expenses").update(rest).eq("id", id).select("id")
      : await db.from("expenses").insert({ ...rest, club_id: ctx.club.id, created_by: ctx.userId }).select("id");
    if (res.error) fail(res.error.message);
    if (!res.data?.length) fail("Cheltuială necunoscută.");
    const expenseId = res.data[0].id as string;

    // documentele justificative: lista trimisă e lista completă
    if (documents) {
      const { data: before } = await db.from("expense_documents").select("id, path").eq("expense_id", expenseId);
      const keep = new Set(documents.map((d) => d.path));
      const removed = (before ?? []).filter((d) => !keep.has(d.path));
      if (removed.length) {
        const { error } = await db.from("expense_documents").delete().in("id", removed.map((d) => d.id));
        if (error) fail(error.message);
        await deleteFiles(db, "finance", removed.map((d) => d.path));
      }
      const known = new Set((before ?? []).map((d) => d.path));
      const added = documents.filter((d) => !known.has(d.path));
      if (added.length) {
        const { error } = await db.from("expense_documents").insert(added.map((d) => ({ ...d, club_id: ctx.club.id, expense_id: expenseId, uploaded_by: ctx.userId })));
        if (error) fail(error.message);
      }
    }
    return null;
  });
}

export async function deleteExpense(input: { id: string }) {
  return run({ roles: [...FINANCE], revalidate: paths, message: getT().money.expenses.deleted }, async ({ db }) => {
    const id = z.uuid().parse(input.id);
    const { data } = await db.from("expenses").select("bank_line_id").eq("id", id).maybeSingle();
    if (data?.bank_line_id) fail("Cheltuiala e legată de un rând din extras. Redeschide întâi rândul din Bancă.");
    const { error } = await db.from("expenses").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) fail(error.message);
    return null;
  });
}

export async function saveDepartment(input: { id: string | null; name: string; parentId: string | null }) {
  return run({ roles: [...FINANCE], revalidate: [...paths, "/bani/referate"] }, async ({ db, ctx }) => {
    const name = z.string().trim().min(1, "Scrie numele.").max(80).parse(input.name);
    const parent = input.parentId ? z.uuid().parse(input.parentId) : null;
    const res = input.id
      ? await db.from("departments").update({ name, parent_id: parent }).eq("id", z.uuid().parse(input.id)).select("id")
      : await db.from("departments").insert({ club_id: ctx.club.id, name, parent_id: parent }).select("id");
    if (res.error) fail(res.error.code === "23505" ? "Există deja un departament cu acest nume." : res.error.message);
    return null;
  });
}

export async function deleteDepartment(input: { id: string }) {
  return run({ roles: [...FINANCE], revalidate: [...paths, "/bani/referate"] }, async ({ db }) => {
    const id = z.uuid().parse(input.id);
    const now = new Date().toISOString();
    const { error } = await db.from("departments").update({ deleted_at: now }).or(`id.eq.${id},parent_id.eq.${id}`);
    if (error) fail(error.message);
    return null;
  });
}
