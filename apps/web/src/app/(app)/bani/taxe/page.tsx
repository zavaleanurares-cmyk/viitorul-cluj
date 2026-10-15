import { ADJUSTMENT_REASON_LABELS, CHARGE_KIND_LABELS, formatDateShort, formatLei, monthLabel, type AppContext, type Db } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/card";
import { PrevNext, TabLinks, TableWrap } from "@/components/ui/misc";
import { FilterLinks } from "@/components/squad/bits";
import { CollectedMeter, Money } from "@/components/money/bits";
import { FeesStatus } from "@/components/money/fees-status";
import { FeesGrid, type GridRow } from "@/components/money/fees-grid";
import { AdjustmentButton, ChargeRequestButton, EndPlanButton, PlayerFeeButton, TeamFeeButton } from "@/components/money/fee-dialogs";
import { feeRoster, getFinanceSettings, listFamilies, periodOf } from "@/components/money/queries";
import { getT } from "@/messages";

export const metadata = { title: "Taxe" };

type SP = { vedere?: string; an?: string; echipa?: string; inactivi?: string };

export default async function FeesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { db, ctx } = await requireCapability("manageMoney");
  const sp = await searchParams;
  const t = getT().money;
  const view = (["grila", "cereri", "planuri"] as const).find((v) => v === sp.vedere) ?? "situatie";
  const tabs = [
    { key: "situatie", href: "/bani/taxe", label: t.fees.tabs.status },
    { key: "grila", href: "/bani/taxe?vedere=grila", label: t.fees.tabs.grid },
    { key: "cereri", href: "/bani/taxe?vedere=cereri", label: t.fees.tabs.requests },
    { key: "planuri", href: "/bani/taxe?vedere=planuri", label: t.fees.tabs.plans },
  ];
  return (
    <>
      <PageHeader title={t.fees.title} />
      <TabLinks tabs={tabs} current={view} className="mb-6" />
      {view === "situatie" ? <FeesStatus db={db} ctx={ctx} /> : null}
      {view === "grila" ? <GridView db={db} ctx={ctx} sp={sp} /> : null}
      {view === "cereri" ? <RequestsView db={db} ctx={ctx} /> : null}
      {view === "planuri" ? <PlansView db={db} ctx={ctx} /> : null}
    </>
  );
}

// ---------------------------------------------------------------------------
async function GridView({ db, ctx, sp }: { db: Db; ctx: AppContext; sp: SP }) {
  const t = getT().money;
  const year = /^\d{4}$/.test(sp.an ?? "") ? Number(sp.an) : Number(ctx.today.slice(0, 4));
  const teamId = ctx.groups.some((g) => g.id === sp.echipa) ? sp.echipa! : null;
  const showInactive = sp.inactivi === "1";
  const [charges, players, roster, families] = await Promise.all([
    db.from("charge_balances").select("id, player_id, period, net, paid, state, due_on")
      .eq("kind", "monthly").gte("period", `${year}-01-01`).lte("period", `${year}-12-01`).neq("status", "cancelled"),
    db.from("players").select("id, full_name, group_id, is_active").is("anonymized_at", null).order("full_name"),
    feeRoster(db, periodOf(ctx.today)),
    listFamilies(db),
  ]);
  const fee = new Map(roster.map((r) => [r.player_id, r.fee ?? null]));
  const famOf = new Map<string, (typeof families)[number]>();
  for (const f of families) for (const p of f.players) if (!famOf.has(p)) famOf.set(p, f);
  const groupName = new Map(ctx.groups.map((g) => [g.id, g.name]));
  const cells = new Map<string, GridRow["cells"]>();
  for (const c of charges.data ?? []) {
    const m = Number(c.period!.slice(5, 7));
    const row = cells.get(c.player_id) ?? {};
    row[m] = { id: c.id, net: c.net, paid: c.paid, state: c.state, due_on: c.due_on };
    cells.set(c.player_id, row);
  }
  const rows: GridRow[] = (players.data ?? [])
    .filter((p) => (showInactive || p.is_active || cells.has(p.id)) && (!teamId || p.group_id === teamId))
    .filter((p) => cells.has(p.id) || (fee.get(p.id) ?? 0) > 0)
    .map((p) => ({ playerId: p.id, name: p.full_name, team: p.group_id ? groupName.get(p.group_id) ?? "" : t.common.none, fee: fee.get(p.id) ?? null, inactive: !p.is_active, family: famOf.get(p.id) ?? null, cells: cells.get(p.id) ?? {} }));
  const href = (o: { an?: number; echipa?: string | null; inactivi?: boolean }) => {
    const u = new URLSearchParams({ vedere: "grila", an: String(o.an ?? year) });
    const team = o.echipa === undefined ? teamId : o.echipa;
    if (team) u.set("echipa", team);
    if (o.inactivi ?? showInactive) u.set("inactivi", "1");
    return `/bani/taxe?${u.toString()}`;
  };
  return (
    <div className="space-y-4">
      <p className="max-w-prose text-ink-3">{t.grid.description}</p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-64"><PrevNext prevHref={href({ an: year - 1 })} nextHref={href({ an: year + 1 })} label={year} /></div>
        <a href={href({ inactivi: !showInactive })} className="font-semibold underline">{showInactive ? t.grid.hideInactive : t.grid.showInactive}</a>
      </div>
      <FilterLinks label={t.common.allTeams} items={[
        { href: href({ echipa: null }), label: t.common.allTeams, active: !teamId },
        ...ctx.groups.filter((g) => g.is_active).map((g) => ({ href: href({ echipa: g.id }), label: g.name, active: teamId === g.id })),
      ]} />
      {rows.length === 0 ? <EmptyState title={t.grid.empty} /> : <FeesGrid year={year} rows={rows} today={ctx.today} families={families} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
async function RequestsView({ db, ctx }: { db: Db; ctx: AppContext }) {
  const t = getT().money.requests;
  const [reqs, charges, players] = await Promise.all([
    db.from("charge_requests").select("id, title, description, kind, amount, due_on, created_at").is("deleted_at", null).order("due_on", { ascending: false }),
    db.from("charge_balances").select("request_id, player_id, net, paid, state").not("request_id", "is", null).eq("status", "open"),
    db.from("players").select("id, full_name, group_id").eq("is_active", true).is("anonymized_at", null).order("full_name"),
  ]);
  const pick = (players.data ?? []).map((p) => ({ id: p.id, name: p.full_name, groupId: p.group_id }));
  const teams = ctx.groups.filter((g) => g.is_active).map((g) => ({ id: g.id, name: g.name }));
  const byReq = new Map<string, { n: number; paid: number; net: number; collected: number; players: string[] }>();
  for (const c of charges.data ?? []) {
    const e = byReq.get(c.request_id!) ?? { n: 0, paid: 0, net: 0, collected: 0, players: [] };
    e.n++;
    if (c.state === "paid" || c.state === "waived") e.paid++;
    e.net += c.net;
    e.collected += c.paid;
    e.players.push(c.player_id);
    byReq.set(c.request_id!, e);
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-ink-3">{t.description}</p>
        <ChargeRequestButton players={pick} teams={teams} today={ctx.today} />
      </div>
      {(reqs.data ?? []).length === 0 ? <EmptyState title={t.empty} description={t.emptyText} /> : (
        <TableWrap>
          <>
            <thead>
              <tr>
                <th scope="col">{t.cols.title}</th>
                <th scope="col" className="text-right">{t.cols.amount}</th>
                <th scope="col">{t.cols.due}</th>
                <th scope="col">{t.cols.paid}</th>
                <th scope="col">{t.cols.collected}</th>
                <th scope="col"><span className="sr-only">{getT().money.common.edit}</span></th>
              </tr>
            </thead>
            <tbody>
              {(reqs.data ?? []).map((r) => {
                const e = byReq.get(r.id) ?? { n: 0, paid: 0, net: 0, collected: 0, players: [] };
                return (
                  <tr key={r.id}>
                    <td><span className="block font-semibold">{r.title}</span><span className="text-sm text-ink-3">{CHARGE_KIND_LABELS[r.kind]}</span></td>
                    <td className="text-right"><Money value={r.amount} /></td>
                    <td>{formatDateShort(r.due_on)}</td>
                    <td className="tabular-nums">{t.paidCount(e.paid, e.n)}</td>
                    <td><CollectedMeter collected={e.collected} expected={e.net} /></td>
                    <td className="text-right">
                      <ChargeRequestButton players={pick} teams={teams} today={ctx.today}
                        request={{ id: r.id, title: r.title, description: r.description, kind: r.kind, amount: r.amount, due_on: r.due_on, playerIds: e.players }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </>
        </TableWrap>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
async function PlansView({ db, ctx }: { db: Db; ctx: AppContext }) {
  const t = getT().money.plans;
  const period = periodOf(ctx.today);
  const [plans, adjustments, players, settings, roster] = await Promise.all([
    db.from("fee_plans").select("id, group_id, player_id, amount, valid_from, valid_to, reason").is("deleted_at", null).order("valid_from", { ascending: false }),
    db.from("fee_adjustments").select("id, player_id, kind, value, reason, note, from_month, to_month").is("deleted_at", null).order("created_at", { ascending: false }),
    db.from("players").select("id, full_name, group_id").eq("is_active", true).is("anonymized_at", null).order("full_name"),
    getFinanceSettings(db),
    feeRoster(db, period),
  ]);
  const active = (p: { valid_from: string; valid_to: string | null }) => p.valid_from <= period && (!p.valid_to || p.valid_to >= period);
  const upcoming = (p: { valid_from: string }) => p.valid_from > period;
  const name = new Map((players.data ?? []).map((p) => [p.id, p.full_name]));
  const pick = (players.data ?? []).map((p) => ({ id: p.id, name: p.full_name, groupId: p.group_id }));
  const countByTeam = new Map<string, number>();
  for (const p of players.data ?? []) if (p.group_id) countByTeam.set(p.group_id, (countByTeam.get(p.group_id) ?? 0) + 1);
  const playerPlans = (plans.data ?? []).filter((p) => p.player_id && (active(p) || upcoming(p)));
  const adjs = (adjustments.data ?? []).filter((a) => !a.to_month || a.to_month >= period);
  const adjText = (a: (typeof adjs)[number]) => a.kind === "percent" ? `${a.value}%` : a.kind === "waiver" ? t.fields.kinds.waiver : formatLei(a.value);
  const reasonText = (r: string) => ADJUSTMENT_REASON_LABELS[r] ?? r;
  const noPlan = roster.filter((r) => r.is_active && r.fee === null).length;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title={t.teamsTitle} description={t.teamsDescription} />
        <CardBody>
          <TableWrap flush>
            <>
              <thead>
                <tr><th scope="col">{t.teamCols.team}</th><th scope="col" className="text-right">{t.teamCols.amount}</th><th scope="col">{t.teamCols.since}</th><th scope="col" className="text-right">{t.teamCols.players}</th><th scope="col"><span className="sr-only">{getT().money.common.edit}</span></th></tr>
              </thead>
              <tbody>
                {ctx.groups.filter((g) => g.is_active).map((g) => {
                  const cur = (plans.data ?? []).find((p) => p.group_id === g.id && active(p));
                  const next = (plans.data ?? []).find((p) => p.group_id === g.id && upcoming(p));
                  return (
                    <tr key={g.id}>
                      <td className="font-semibold">{g.name}</td>
                      <td className="text-right">{cur ? <Money value={cur.amount} /> : <span className="text-ink-3">{t.noPlan}</span>}
                        {next ? <span className="block text-sm text-ink-3"><Money value={next.amount} /> {t.periodOpen(monthLabel(next.valid_from))}</span> : null}</td>
                      <td>{cur ? monthLabel(cur.valid_from) : "—"}</td>
                      <td className="text-right tabular-nums">{countByTeam.get(g.id) ?? 0}</td>
                      <td className="text-right"><TeamFeeButton team={{ id: g.id, name: g.name }} current={cur?.amount ?? null} period={period} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </>
          </TableWrap>
          {noPlan ? <p className="mt-3 text-sm font-semibold text-st-red">{getT().money.fees.todo.noPlan(noPlan)}</p> : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t.playerPlansTitle} description={t.playerPlansDescription} action={<PlayerFeeButton players={pick} period={period} />} />
        <CardBody>
          {playerPlans.length === 0 ? <p className="text-ink-3">{t.playerPlansEmpty}</p> : (
            <ul className="divide-y divide-line">
              {playerPlans.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 py-2">
                  <span className="min-w-0 flex-1"><span className="font-semibold">{name.get(p.player_id!) ?? "—"}</span>
                    <span className="block text-sm text-ink-3">{p.valid_to ? t.periodRange(monthLabel(p.valid_from), monthLabel(p.valid_to)) : t.periodOpen(monthLabel(p.valid_from))}{p.reason ? ` · ${p.reason}` : ""}</span></span>
                  <Money value={p.amount} className="font-semibold" />
                  <EndPlanButton id={p.id} period={period} kind="plan" />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t.adjustmentsTitle} description={t.adjustmentsDescription} action={<AdjustmentButton players={pick} period={period} />} />
        <CardBody className="space-y-3">
          <p className="text-sm text-ink-3">{t.siblingAuto(settings?.sibling_discount_pct ?? 0)}</p>
          {adjs.length === 0 ? <p className="text-ink-3">{t.adjustmentsEmpty}</p> : (
            <TableWrap flush>
              <>
                <thead><tr><th scope="col">{t.adjCols.player}</th><th scope="col">{t.adjCols.what}</th><th scope="col">{t.adjCols.reason}</th><th scope="col">{t.adjCols.period}</th><th scope="col"><span className="sr-only">{t.remove}</span></th></tr></thead>
                <tbody>
                  {adjs.map((a) => (
                    <tr key={a.id}>
                      <td className="font-semibold">{name.get(a.player_id) ?? "—"}</td>
                      <td>{adjText(a)}</td>
                      <td>{reasonText(a.reason)}{a.note ? <span className="block text-sm text-ink-3">{a.note}</span> : null}</td>
                      <td>{a.to_month ? t.periodRange(monthLabel(a.from_month), monthLabel(a.to_month)) : t.periodOpen(monthLabel(a.from_month))}</td>
                      <td className="text-right"><EndPlanButton id={a.id} period={period} kind="adjustment" /></td>
                    </tr>
                  ))}
                </tbody>
              </>
            </TableWrap>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
