"use server";
import { z } from "zod";
import { fail, run } from "@/lib/actions";
import { getT } from "@/messages";

const STAFF = ["admin", "secretary", "accountant", "sporting_director", "physio", "coach", "owner"] as const;
const paths = ["/bani", "/bani/referate", "/bani/cheltuieli", "/azi"];

const Item = z.object({
  name: z.string().trim().min(1, "Fiecare articol are nevoie de nume.").max(200),
  details: z.string().max(500).optional(),
  unit: z.string().max(20).optional(),
  quantity: z.number().positive("Cantitatea trebuie să fie mai mare decât zero.").max(1_000_000),
  unit_price: z.number().int().min(0).max(1_000_000_000),
  vat_rate: z.number().int().min(0).max(100),
  price_includes_vat: z.boolean(),
});
const Request = z.object({
  id: z.uuid().nullable(),
  department_id: z.uuid().nullable(),
  group_id: z.uuid().nullable(),
  justification: z.string().trim().min(1, "Scrie de ce e nevoie.").max(2000),
  needed_by: z.iso.date().nullable(),
  spec_path: z.string().max(300).nullable(),
  submit: z.boolean(),
  items: z.array(Item).min(1, "Adaugă cel puțin un articol.").max(100),
});

export async function savePurchaseRequest(input: z.input<typeof Request>) {
  return run<{ id: string; number: number; total: number }>({ roles: [...STAFF], revalidate: paths }, async ({ db }) => {
    const p = Request.parse(input);
    const { data, error } = await db.rpc("save_purchase_request", { p });
    if (error) fail(error.message);
    return data as { id: string; number: number; total: number };
  });
}

export async function decidePurchaseRequest(input: { id: string; decision: "approved" | "rejected"; note: string }) {
  const t = getT().money.purchases.detail;
  return run({ roles: [...STAFF], revalidate: paths, message: input.decision === "approved" ? t.approved : t.rejected }, async ({ db }) => {
    const { error } = await db.rpc("decide_purchase_request", { p_id: z.uuid().parse(input.id), p_decision: input.decision, p_note: z.string().max(500).parse(input.note) || undefined });
    if (error) fail(error.message);
    return null;
  });
}

export async function cancelPurchaseRequest(input: { id: string }) {
  return run({ roles: [...STAFF], revalidate: paths, message: getT().money.purchases.detail.cancelled }, async ({ db }) => {
    const { error } = await db.rpc("cancel_purchase_request", { p_id: z.uuid().parse(input.id) });
    if (error) fail(error.message);
    return null;
  });
}

export async function completePurchaseRequest(input: { id: string; spent_on: string; supplier: string; invoice_no: string; amount: number; method: "cash" | "bank" | "card"; document_path: string | null }) {
  return run({ roles: ["admin", "secretary", "accountant"], revalidate: paths, message: getT().money.purchases.detail.completed }, async ({ db }) => {
    const { error } = await db.rpc("complete_purchase_request", { p_id: z.uuid().parse(input.id), p: {
      spent_on: z.iso.date().parse(input.spent_on), supplier: z.string().max(200).parse(input.supplier), invoice_no: z.string().max(60).parse(input.invoice_no),
      amount: z.number().int().positive().parse(input.amount), method: input.method, document_path: input.document_path,
    } });
    if (error) fail(error.message);
    return null;
  });
}
