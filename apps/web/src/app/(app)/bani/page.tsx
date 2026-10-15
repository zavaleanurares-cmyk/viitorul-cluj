import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { can, formatLei, monthLabel, monthShort } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { Card, CardBody, CardHeader, EmptyState, Notice, PageHeader, Stat } from "@/components/ui/card";
import { PrevNext, TableWrap } from "@/components/ui/misc";
import { CollectedMeter, Money } from "@/components/money/bits";
import { MoneyChart } from "@/components/money/money-chart";
import { moneySummary } from "@/components/money/queries";
import { getT } from "@/messages";

export const metadata = { title: "Bani" };

/** Prezentarea banilor: aceleași cifre pentru birou, director și patron (doar agregate, fără familii). */
export default async function MoneyOverviewPage({ searchParams }: { searchParams: Promise<{ luna?: string }> }) {
  const { db, ctx } = await requireCapability("viewMoneySummary");
  const sp = await searchParams;
  const t = getT().money.overview;
  const month = /^\d{4}-\d{2}$/.test(sp.luna ?? "") ? `${sp.luna}-01` : `${ctx.today.slice(0, 7)}-01`;
  const year = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const s = await moneySummary(db, year, m);
  const cur = s.months[m - 1];
  const pct = cur.expected > 0 ? Math.round((cur.collected_for_month / cur.expected) * 100) : 0;
  const finance = can(ctx.role, "manageMoney");
  const shift = (n: number) => { const d = new Date(Date.UTC(year, m - 1 + n, 1)); return `/bani?luna=${d.toISOString().slice(0, 7)}`; };
  const monthName = monthLabel(month).split(" ")[0];
  const thisMonth = `${ctx.today.slice(0, 7)}-01`;
  const future = (mo: number) => `${year}-${String(mo).padStart(2, "0")}-01` > thisMonth;
  const chart = s.months.map((x) => ({ label: monthShort(`${year}-${String(x.month).padStart(2, "0")}-01`), expected: x.expected,
    collected: future(x.month) ? null : x.collected_for_month, received: future(x.month) ? null : x.received }));

  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      <div className="mb-4 w-72"><PrevNext prevHref={shift(-1)} nextHref={shift(1)} label={monthLabel(month)} /></div>
      {!finance ? <Notice tone="gray" className="mb-4">{t.readOnly}</Notice> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t.receivedMonth(monthName)} value={<Money value={cur.collected_for_month} />} hint={t.expectedHint(pct, formatLei(cur.expected))} tone={cur.expected === 0 ? undefined : pct >= 85 ? "green" : pct >= 50 ? "yellow" : "red"} />
        <Stat label={t.overdue} value={<Money value={s.kpi.overdue} />} hint={t.overdueHint(s.kpi.overdue_families)} tone={s.kpi.overdue ? "red" : "green"} />
        <Stat label={t.unallocated} value={s.kpi.unallocated_count} hint={t.unallocatedHint} tone={s.kpi.unallocated_count ? "yellow" : "green"} />
        <Stat label={t.spentMonth(monthName)} value={<Money value={cur.spent} />} hint={cur.planned_expense ? `${getT().money.budget.planned}: ${formatLei(cur.planned_expense)}` : undefined} />
      </div>

      {s.kpi.requests_pending ? (
        <Link href="/bani/referate?stare=submitted" className="mt-4 flex min-h-12 items-center gap-3 rounded-[var(--radius-control)] bg-st-yellow-soft px-4 py-3 font-semibold hover:underline">
          <ClipboardList className="size-5" aria-hidden /> {t.pendingRequests(s.kpi.requests_pending)}
        </Link>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-6">
        <Card>
          <CardHeader title={t.chartTitle(year)} />
          <CardBody>
            <MoneyChart data={chart} caption={t.chartTitle(year)} series={[
              { key: "expected", label: t.chartExpected, kind: "bar" },
              { key: "collected", label: t.chartCollected, kind: "bar" },
              { key: "received", label: t.chartReceived, kind: "line" },
            ]} />
            <p className="mt-2 text-sm text-ink-3">{t.chartNote}</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t.teamsTitle(monthLabel(month))} />
          <CardBody>
            {s.teams.length === 0 ? <EmptyState title={t.teamsEmpty} /> : (
              <TableWrap>
                <>
                  <thead><tr><th scope="col">{t.teamCols.team}</th><th scope="col" className="text-right">{t.teamCols.payers}</th><th scope="col" className="text-right">{t.teamCols.collected}</th><th scope="col">{t.teamCols.pct}</th></tr></thead>
                  <tbody>
                    {s.teams.map((x) => (
                      <tr key={x.group_id}>
                        <td className="font-semibold">{x.name}</td>
                        <td className="text-right tabular-nums">{x.payers}/{x.players}</td>
                        <td className="text-right"><Money value={x.collected} /><span className="block text-xs text-ink-3">{formatLei(x.expected)}</span></td>
                        <td><CollectedMeter collected={x.collected} expected={x.expected} lowLabel={t.lowTeam} /></td>
                      </tr>
                    ))}
                  </tbody>
                </>
              </TableWrap>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
