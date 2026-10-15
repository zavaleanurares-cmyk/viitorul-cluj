"use server";
import { z } from "zod";
import { fail, run } from "@/lib/actions";
import { getT } from "@/messages";

export async function saveBudget(input: { year: number; kind: "income" | "expense"; departmentId: string | null; amounts: number[] }) {
  return run({ roles: ["admin", "accountant"], revalidate: ["/bani", "/bani/buget"], message: getT().money.budget.saved }, async ({ db }) => {
    const year = z.number().int().min(2000).max(2100).parse(input.year);
    const kind = z.enum(["income", "expense"]).parse(input.kind);
    const dept = input.departmentId ? z.uuid().parse(input.departmentId) : null;
    if (kind === "income" && dept) fail("Încasările nu au departament.");
    const amounts = z.array(z.number().int().min(0).max(1_000_000_000)).length(12).parse(input.amounts);
    const { error } = await db.rpc("save_budget_lines", { p_year: year, p_kind: kind, p_department: dept, p_amounts: amounts });
    if (error) fail(error.message);
    return null;
  });
}
