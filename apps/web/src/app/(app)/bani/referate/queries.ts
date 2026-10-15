import "server-only";
import type { Db } from "@club/shared";
import { deptOptions, type Dept } from "@/components/money/departments";

export async function formOptions(db: Db) {
  const [deps, settings] = await Promise.all([
    db.from("departments").select("id, name, parent_id").is("deleted_at", null).order("sort").order("name"),
    db.from("finance_settings").select("vat_rates").maybeSingle(),
  ]);
  const depts: Dept[] = (deps.data ?? []).map((d) => ({ id: d.id, name: d.name, parentId: d.parent_id }));
  return { departments: deptOptions(depts), depts, vatRates: settings.data?.vat_rates ?? [21, 11, 0] };
}

/** Cât a cheltuit un departament (cu subdepartamentele lui) anul acesta și cât era planificat. Null dacă rolul nu vede bugetul. */
export async function departmentBudget(db: Db, depts: Dept[], departmentId: string | null, year: number): Promise<{ spent: number; planned: number } | null> {
  if (!departmentId) return null;
  const root = depts.find((d) => d.id === departmentId)?.parentId ?? departmentId;
  const ids = [root, ...depts.filter((d) => d.parentId === root).map((d) => d.id)];
  const [exp, plan] = await Promise.all([
    db.from("expenses").select("amount").in("department_id", ids).is("deleted_at", null).gte("spent_on", `${year}-01-01`).lt("spent_on", `${year + 1}-01-01`),
    db.from("budget_lines").select("amount").in("department_id", ids).eq("year", year).eq("kind", "expense"),
  ]);
  if (exp.error || plan.error) return null;
  return { spent: (exp.data ?? []).reduce((s, r) => s + r.amount, 0), planned: (plan.data ?? []).reduce((s, r) => s + r.amount, 0) };
}
