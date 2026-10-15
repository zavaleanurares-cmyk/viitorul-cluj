import { CircleCheck, CircleSlash, CircleAlert } from "lucide-react";
import { formatDateShort, formatLei } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/card";
import { Money } from "@/components/money/bits";
import { BankImportButton } from "@/components/money/bank-import";
import { ReopenLineButton, ResolveLineButton } from "@/components/money/bank-line";
import { listFamilies } from "@/components/money/queries";
import { getT } from "@/messages";

export const metadata = { title: "Bancă" };

export default async function BankPage() {
  const { db } = await requireCapability("manageMoney");
  const t = getT().money.bank;
  const [statements, unmatched, resolved, families, expenses, departments] = await Promise.all([
    db.from("bank_statements").select("id, file_name, bank, period_from, period_to, line_count, created_at").order("created_at", { ascending: false }).limit(24),
    db.from("bank_lines").select("id, booked_on, amount, description, counterparty, status, note").eq("status", "unmatched").order("booked_on", { ascending: false }),
    db.from("bank_lines").select("id, booked_on, amount, description, counterparty, status, note").neq("status", "unmatched").order("matched_at", { ascending: false }).limit(20),
    listFamilies(db),
    db.from("expenses").select("id, description, supplier, amount, spent_on").is("deleted_at", null).is("bank_line_id", null).eq("method", "bank").order("spent_on", { ascending: false }).limit(100),
    db.from("departments").select("id, name, parent_id").is("deleted_at", null).order("sort").order("name"),
  ]);
  const deptName = new Map((departments.data ?? []).map((d) => [d.id, d.name]));
  const deptOpts = (departments.data ?? []).map((d) => ({ id: d.id, label: d.parent_id ? `${deptName.get(d.parent_id)} › ${d.name}` : d.name }));
  const expOpts = (expenses.data ?? []).map((e) => ({ id: e.id, label: `${formatDateShort(e.spent_on)} · ${e.description}${e.supplier ? ` · ${e.supplier}` : ""} · ${formatLei(e.amount)}` }));
  const icon = { matched: CircleCheck, ignored: CircleSlash, unmatched: CircleAlert } as const;

  return (
    <>
      <PageHeader title={t.title} description={t.description} action={<BankImportButton />} />
      <div className="space-y-6">
        <Card>
          <CardHeader title={t.unmatchedTitle((unmatched.data ?? []).length)} />
          <CardBody>
            {(unmatched.data ?? []).length === 0 ? <p className="flex items-center gap-2 text-ink-2"><CircleCheck className="size-5 text-st-green" aria-hidden />{t.unmatchedEmpty}</p> : (
              <ul className="divide-y divide-line">
                {(unmatched.data ?? []).map((l) => (
                  <li key={l.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 py-3 sm:grid-cols-[6rem_1fr_auto_auto]">
                    <span className="tabular-nums text-ink-2">{formatDateShort(l.booked_on)}</span>
                    <Money value={l.amount} sign className="text-right font-bold sm:order-3" />
                    <span className="col-span-2 min-w-0 sm:order-2 sm:col-span-1">
                      <span className="block font-semibold">{l.counterparty || "—"}</span>
                      <span className="block text-sm text-ink-3">{l.description}</span>
                    </span>
                    <span className="col-span-2 sm:order-4 sm:col-span-1"><ResolveLineButton line={l} families={families} expenses={expOpts} departments={deptOpts} /></span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title={t.statementsTitle} />
            <CardBody>
              {(statements.data ?? []).length === 0 ? <EmptyState title={t.statementsEmpty} /> : (
                <ul className="divide-y divide-line">
                  {(statements.data ?? []).map((s) => (
                    <li key={s.id} className="py-2">
                      <span className="block font-semibold">{s.file_name}{s.bank ? ` · ${s.bank}` : ""}</span>
                      <span className="block text-sm text-ink-3">{t.statementLine(s.line_count, formatDateShort(s.period_from), formatDateShort(s.period_to))}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={`${t.status.matched} / ${t.status.ignored}`} />
            <CardBody>
              <ul className="divide-y divide-line">
                {(resolved.data ?? []).map((l) => {
                  const Icon = icon[l.status as keyof typeof icon] ?? CircleAlert;
                  return (
                    <li key={l.id} className="flex items-center gap-3 py-2">
                      <Icon className="size-5 shrink-0 text-ink-3" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{l.counterparty || l.description}</span>
                        <span className="block text-sm text-ink-3">{formatDateShort(l.booked_on)} · {t.status[l.status as keyof typeof t.status]}{l.note ? ` · ${l.note}` : ""}</span>
                      </span>
                      <Money value={l.amount} sign />
                      <ReopenLineButton lineId={l.id} />
                    </li>
                  );
                })}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
