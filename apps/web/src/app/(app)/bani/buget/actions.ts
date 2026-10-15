"use server";
import { z } from "zod";
import { fail, run } from "@/lib/actions";
import { getT } from "@/messages";

export async function saveBudget(input: { year: number; kind: "income" | "expense"; departmentId: string | null; amounts: number[] }) {
  return run({ roles: ["admin", "accountant"], revalidate: ["/bani", "/bani/buget"], message: getT().money.budget.saved }, async ({ db, ctx }) => {
    const year = z.number().int().min(2000).max(2100).parse(input.year);
    const kind = z.enum(["income", "expense"]).parse(input.kind);
    const dept = input.departmentId ? z.uuid().parse(input.departmentId) : null;
    if (kind === "income" && dept) fail("Încasările nu au departament.");
    const amounts = z.array(z.number().int().min(0).max(1_000_000_000)).length(12).parse(input.amounts);
    let del = db.from("budget_lines").delete().eq("year", year).eq("kind", kind);
    del = dept ? del.eq("department_id", dept) : del.is("department_id", null);
    const { error } = await del;
    if (error) fail(error.message);
    const rows = amounts.map((amount, i) => ({ club_id: ctx.club.id, year, month: i + 1, kind, department_id: dept, amount })).filter((r) => r.amount > 0);
    if (rows.length) {
      const { error: e2 } = await db.from("budget_lines").insert(rows);
      if (e2) fail(e2.message);
    }
    return null;
  });
}
