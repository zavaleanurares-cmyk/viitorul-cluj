import Link from "next/link";
import { CircleAlert, CircleCheck, ReceiptText, UserX, Users, Wallet } from "lucide-react";
import { formatDate, formatLei, monthLabel, type AppContext, type Db } from "@club/shared";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { TableWrap } from "@/components/ui/misc";
import { getT } from "@/messages";
import { availableProviders } from "@/lib/payments/registry";
import { Money } from "./bits";
import { IssueButton, RemindButton } from "./fee-buttons";
import { RecordPaymentButton, type Family } from "./record-payment";
import { addMonths, feeRoster, getFinanceSettings, listFamilies, moneySummary, periodOf } from "./queries";

type Todo = { key: string; tone: "red" | "yellow" | "blue"; icon: typeof Wallet; title: string; detail: string; action: React.ReactNode };

/** Taxe › Situație: întâi excepțiile, apoi ce face singur sistemul până la următoarea emitere. */
export async function FeesStatus({ db, ctx }: { db: Db; ctx: AppContext }) {
  const t = getT().money;
  const f = t.fees;
  const period = periodOf(ctx.today);
  const [settings, roster, summary, families, overdueRows, preview] = await Promise.all([
    getFinanceSettings(db),
    feeRoster(db, period),
    moneySummary(db, Number(ctx.today.slice(0, 4)), Number(ctx.today.slice(5, 7))),
    listFamilies(db),
    db.from("charge_balances").select("id, player_id, guardian_id, balance, due_on, players(full_name, group_id)")
      .eq("status", "open").gt("balance", 0).lt("due_on", ctx.today).order("due_on"),
    db.rpc("preview_monthly_charges", { p_period: period }),
  ]);
  const month = summary.months[Number(ctx.today.slice(5, 7)) - 1];
  const pct = month.expected > 0 ? Math.round((month.collected_for_month / month.expected) * 100) : 0;
  const prev = (preview.data ?? { count: 0, gross: 0 }) as { count: number; gross: number };
  const feeMonths = settings?.fee_months ?? [];
  const isFeeMonth = feeMonths.includes(Number(ctx.today.slice(5, 7)));
  const issuedThisMonth = roster.some((r) => r.charge_id);

  // restanțe pe familie (părinte plătitor sau jucătorul, dacă n-are părinte)
  const famByKey = new Map<string, Family>();
  for (const fm of families) famByKey.set(fm.guardianId ?? `p:${fm.playerId}`, fm);
  const debts = new Map<string, { family: Family | null; label: string; amount: number; n: number; groups: Set<string> }>();
  for (const c of overdueRows.data ?? []) {
    const key = c.guardian_id ?? `p:${c.player_id}`;
    const pl = c.players as { full_name: string; group_id: string | null } | null;
    const fam = famByKey.get(key) ?? null;
    const d = debts.get(key) ?? { family: fam, label: fam?.label ?? pl?.full_name ?? "", amount: 0, n: 0, groups: new Set<string>() };
    d.amount += c.balance;
    d.n++;
    if (pl?.group_id) d.groups.add(pl.group_id);
    debts.set(key, d);
  }
  const debtList = [...debts.values()].sort((a, b) => b.amount - a.amount);
  const debtPlayers = new Set((overdueRows.data ?? []).map((c) => c.player_id)).size;
  const outstanding = debtList.reduce((s, d) => s + d.amount, 0);

  // restanțe pe echipe
  const byTeam = new Map<string, { players: Set<string>; amount: number }>();
  for (const c of overdueRows.data ?? []) {
    const g = (c.players as { group_id: string | null } | null)?.group_id ?? "none";
    const e = byTeam.get(g) ?? { players: new Set<string>(), amount: 0 };
    e.players.add(c.player_id);
    e.amount += c.balance;
    byTeam.set(g, e);
  }
  const groupName = new Map(ctx.groups.map((g) => [g.id, g.name]));

  const active = roster.filter((r) => r.is_active);
  const noPlan = active.filter((r) => r.fee === null); // 0 = echipă fără taxă, ales de club
  const noPayer = active.filter((r) => (r.fee ?? 0) > 0 && !r.guardian_id);
  const newPlayers = issuedThisMonth ? active.filter((r) => (r.fee ?? 0) > 0 && !r.charge_id) : [];

  const todos: Todo[] = [];
  if (isFeeMonth && !issuedThisMonth && prev.count > 0) {
    todos.push({ key: "issue", tone: "blue", icon: ReceiptText, title: f.todo.notIssued(monthLabel(period)), detail: f.todo.notIssuedDetail(prev.count, formatLei(prev.gross)), action: <IssueButton period={period} size="sm" /> });
  }
  if (newPlayers.length) {
    todos.push({ key: "new", tone: "blue", icon: Users, title: f.todo.newPlayers(newPlayers.length), detail: `${f.todo.newPlayersDetail} ${newPlayers.slice(0, 4).map((p) => p.full_name).join(", ")}${newPlayers.length > 4 ? "…" : ""}`, action: <IssueButton period={period} size="sm" variant="secondary" label={f.todo.newPlayersAction} /> });
  }
  for (const d of debtList.slice(0, 12)) {
    todos.push({
      key: `debt:${d.label}`, tone: "red", icon: Wallet, title: f.todo.overdue(d.label), detail: f.todo.overdueDetail(formatLei(d.amount), d.n),
      action: d.family ? <RecordPaymentButton families={families} today={ctx.today} preset={d.family} label={f.todo.overdueAction} variant="secondary" size="sm" /> : null,
    });
  }
  if (summary.kpi.unallocated_count) {
    todos.push({ key: "unalloc", tone: "yellow", icon: CircleAlert, title: f.todo.unallocated(summary.kpi.unallocated_count), detail: f.todo.unallocatedDetail, action: <LinkButton href="/bani/incasari?vedere=asociat" size="sm">{f.todo.unallocatedAction}</LinkButton> });
  }
  if (noPlan.length) {
    todos.push({ key: "noplan", tone: "yellow", icon: ReceiptText, title: f.todo.noPlan(noPlan.length), detail: f.todo.noPlanDetail, action: <LinkButton href="/bani/taxe?vedere=planuri" size="sm">{f.todo.noPlanAction}</LinkButton> });
  }
  if (noPayer.length) {
    todos.push({ key: "nopayer", tone: "yellow", icon: UserX, title: f.todo.noPayer(noPayer.length), detail: f.todo.noPayerDetail, action: <LinkButton href="/lot/parinti" size="sm">{f.todo.noPayerAction}</LinkButton> });
  }

  const provider = availableProviders().find((p) => p.id === settings?.provider);
  const nextIssue = settings?.auto_issue
    ? (Number(ctx.today.slice(8, 10)) < settings.issue_day && !issuedThisMonth ? `${period.slice(0, 8)}${String(settings.issue_day).padStart(2, "0")}` : `${addMonths(period, 1).slice(0, 8)}${String(settings.issue_day).padStart(2, "0")}`)
    : null;
  const toneCls = { red: "bg-st-red text-white", yellow: "bg-st-yellow text-ink", blue: "bg-st-blue-soft text-ink" } as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-ink-3">{f.description}</p>
        <div className="flex flex-wrap gap-2">
          <RemindButton families={debtList.filter((d) => d.family?.guardianId).length} />
          <RecordPaymentButton families={families} today={ctx.today} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={f.kpiCollected(monthLabel(period).split(" ")[0])} value={<Money value={month.collected_for_month} />} hint={f.kpiCollectedHint(pct, formatLei(month.expected))} tone={pct >= 85 ? "green" : pct >= 50 ? "yellow" : "red"} />
        <Stat label={f.kpiOutstanding} value={<Money value={outstanding} />} hint={f.kpiOutstandingHint(debtPlayers, debtList.length)} tone={outstanding > 0 ? "red" : "green"} />
        <Stat label={f.kpiUnallocated} value={summary.kpi.unallocated_count} hint={f.kpiUnallocatedHint} tone={summary.kpi.unallocated_count ? "yellow" : "green"} />
        <Stat label={f.kpiAdjusted} value={summary.kpi.adjusted_players} hint={f.kpiAdjustedHint} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader title={f.todoTitle(todos.length)} />
          <CardBody className="pt-3">
            {todos.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <CircleCheck className="size-10 text-st-green" aria-hidden />
                <p className="text-lg font-semibold">{f.todoEmpty}</p>
                <p className="text-ink-3">{f.todoEmptyText}</p>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {todos.map((it) => (
                  <li key={it.key} className="flex flex-wrap items-center gap-3 py-3">
                    <span aria-hidden className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full ${toneCls[it.tone]}`}><it.icon className="size-5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{it.title}</p>
                      <p className="text-sm text-ink-3">{it.detail}</p>
                    </div>
                    {it.action}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title={f.autopilotTitle} action={<Link href="/bani/setari" className="text-sm font-semibold underline">{f.settingsLink}</Link>} />
            <CardBody className="space-y-3 pt-3">
              {nextIssue ? (
                <p className="font-semibold">{f.autopilotNext(formatDate(nextIssue))}</p>
              ) : <p>{f.autopilotOff}</p>}
              {!issuedThisMonth && prev.count > 0 ? <p className="text-sm text-ink-3">{f.autopilotPreview(prev.count, formatLei(prev.gross))}</p> : null}
              <p>{f.autopilotReminders((settings?.reminder_days ?? []).join(", "))}</p>
              <p>{settings?.online_enabled ? f.autopilotOnline(provider?.label ?? settings.provider, provider?.test ?? false) : f.autopilotOnlineOff}</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={f.arrearsTitle} />
            <CardBody className="pt-3">
              {byTeam.size === 0 ? <p className="text-ink-3">{f.arrearsEmpty}</p> : (
                <TableWrap>
                  <>
                    <thead>
                      <tr><th scope="col">{f.arrearsCols.team}</th><th scope="col" className="text-right">{f.arrearsCols.players}</th><th scope="col" className="text-right">{f.arrearsCols.amount}</th></tr>
                    </thead>
                    <tbody>
                      {[...byTeam.entries()].sort((a, b) => b[1].amount - a[1].amount).map(([g, e]) => (
                        <tr key={g}>
                          <td className="font-semibold">{g === "none" ? t.common.none : groupName.get(g) ?? t.common.none}</td>
                          <td className="text-right tabular-nums">{e.players.size}</td>
                          <td className="text-right"><Money value={e.amount} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                </TableWrap>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
