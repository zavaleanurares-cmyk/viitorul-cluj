import { CircleAlert } from "lucide-react";
import { can, formatLei, monthShort } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/card";
import { PrevNext } from "@/components/ui/misc";
import { MoneyChart } from "@/components/money/money-chart";
import { BudgetEditButton } from "@/components/money/budget-edit";
import { moneySummary } from "@/components/money/queries";
import { getT } from "@/messages";

export const metadata = { title: "Buget" };

type Dep = { id: string; name: string; planned: number[]; actual: number[] };

export default async function BudgetPage({ searchParams }: { searchParams: Promise<{ an?: string }> }) {
  const { db, ctx } = await requireCapability("viewMoneySummary");
  const sp = await searchParams;
  const t = getT().money.budget;
  const year = /^\d{4}$/.test(sp.an ?? "") ? Number(sp.an) : Number(ctx.today.slice(0, 4));
  const [summary, report] = await Promise.all([moneySummary(db, year), db.rpc("budget_report", { p_year: year })]);
  const rep = (report.data ?? { departments: [], unassigned: [] }) as { departments: Dep[]; unassigned: number[] };
  const canEdit = can(ctx.role, "administerMoney");
  const months = summary.months;
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
  const label = (i: number) => monthShort(`${year}-${String(i + 1).padStart(2, "0")}-01`);
  const thisMonth = `${ctx.today.slice(0, 7)}-01`;
  const future = (i: number) => `${year}-${String(i + 1).padStart(2, "0")}-01` > thisMonth;
  const chart = months.map((mo, i) => ({ label: label(i), income: future(i) ? null : mo.received, spent: future(i) ? null : mo.spent, net: future(i) ? null : mo.received - mo.spent }));
  const rows: Array<{ key: string; name: string; planned: number[]; actual: number[]; kind: "income" | "expense"; dept: string | null }> = [
    { key: "income", name: t.income, planned: months.map((m) => m.planned_income), actual: months.map((m) => m.received), kind: "income", dept: null },
    ...rep.departments.map((d) => ({ key: d.id, name: d.name, planned: d.planned, actual: d.actual, kind: "expense" as const, dept: d.id })),
    ...(sum(rep.unassigned) ? [{ key: "none", name: t.unassigned, planned: Array(12).fill(0), actual: rep.unassigned, kind: "expense" as const, dept: "none" }] : []),
  ];

  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      <div className="mb-4 w-56"><PrevNext prevHref={`/bani/buget?an=${year - 1}`} nextHref={`/bani/buget?an=${year + 1}`} label={year} /></div>
      <Card className="mb-6">
        <CardHeader title={t.cashflowTitle(year)} />
        <CardBody>
          <MoneyChart data={chart} caption={t.cashflowTitle(year)} series={[
            { key: "income", label: t.income, kind: "bar", color: "#2a78d6" },
            { key: "spent", label: t.expenses, kind: "bar", color: "#eb6834" },
            { key: "net", label: t.net, kind: "line", color: "#0e1726" },
          ]} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t.departmentsTitle} />
        <CardBody>
          {rep.departments.length === 0 ? <EmptyState title={t.empty} /> : (
            <div className="-mx-4 overflow-x-auto md:mx-0">
              <table className="w-full min-w-[960px] border-collapse text-sm">
                <thead>
                  <tr className="bg-canvas text-left text-xs font-semibold text-ink-3">
                    <th scope="col" className="sticky left-0 z-10 bg-canvas px-3 py-2">{t.departmentsTitle}</th>
                    {months.map((_, i) => <th key={i} scope="col" className="px-2 py-2 text-right">{label(i)}</th>)}
                    <th scope="col" className="px-3 py-2 text-right">{t.yearTotal}</th>
                    {canEdit ? <th scope="col"><span className="sr-only">{t.edit}</span></th> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const totalP = sum(r.planned);
                    const totalA = sum(r.actual);
                    const over = r.kind === "expense" && totalP > 0 && totalA > totalP;
                    return (
                      <tr key={r.key} className="border-t border-line align-top">
                        <th scope="row" className="sticky left-0 z-10 bg-surface px-3 py-2 text-left">
                          <span className="block font-semibold">{r.name}</span>
                          <span className="block text-xs font-normal text-ink-3">{t.actual} / {t.planned}</span>
                        </th>
                        {r.actual.map((a, i) => {
                          const p = r.planned[i];
                          const mOver = r.kind === "expense" && p > 0 && a > p;
                          return (
                            <td key={i} className="px-2 py-2 text-right tabular-nums">
                              <span className={mOver ? "block font-bold text-st-red" : "block font-semibold"}>{a ? formatLei(a, { currency: false }) : "—"}</span>
                              <span className="block text-xs text-ink-3">{p ? formatLei(p, { currency: false }) : "—"}</span>
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-right tabular-nums">
                          <span className={over ? "flex items-center justify-end gap-1 font-bold text-st-red" : "block font-bold"}>{over ? <CircleAlert className="size-4" aria-hidden /> : null}{formatLei(totalA)}</span>
                          <span className="block text-xs text-ink-3">{formatLei(totalP)}</span>
                          {over ? <span className="block text-xs font-semibold text-st-red">{t.over}</span> : null}
                        </td>
                        {canEdit ? <td className="px-1 py-1 text-right">{r.dept !== "none" ? <BudgetEditButton year={year} kind={r.kind} departmentId={r.dept} name={r.name} planned={r.planned} /> : null}</td> : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}
