import { FileDown } from "lucide-react";
import { can, formatDateShort, monthLabel, norm, PAYMENT_METHOD_LABELS, type AppContext, type Db } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { PrevNext, TabLinks, TableWrap } from "@/components/ui/misc";
import { FilterLinks } from "@/components/squad/bits";
import { Money } from "@/components/money/bits";
import { RecordPaymentButton, type Family } from "@/components/money/record-payment";
import { AssignPaymentButton, PaymentList, type PaymentRow } from "@/components/money/payment-dialogs";
import { addMonths, listFamilies, periodOf } from "@/components/money/queries";
import { getT } from "@/messages";

export const metadata = { title: "Încasări" };

type SP = { vedere?: string; luna?: string; mod?: string };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { db, ctx } = await requireCapability("manageMoney");
  const sp = await searchParams;
  const t = getT().money.payments;
  const view = (["asociat", "chitante"] as const).find((v) => v === sp.vedere) ?? "plati";
  const families = await listFamilies(db);
  const { count: inboxCount } = await db.from("payment_balances").select("id", { count: "exact", head: true }).gt("unallocated", 0);
  const tabs = [
    { key: "plati", href: "/bani/incasari", label: t.tabs.list },
    { key: "asociat", href: "/bani/incasari?vedere=asociat", label: `${t.tabs.inbox}${inboxCount ? ` · ${inboxCount}` : ""}` },
    { key: "chitante", href: "/bani/incasari?vedere=chitante", label: t.tabs.receipts },
  ];
  return (
    <>
      <PageHeader title={t.title} action={<RecordPaymentButton families={families} today={ctx.today} />} />
      <TabLinks tabs={tabs} current={view} className="mb-6" />
      {view === "plati" ? <ListView db={db} ctx={ctx} sp={sp} families={families} /> : null}
      {view === "asociat" ? <InboxView db={db} families={families} /> : null}
      {view === "chitante" ? <ReceiptsView db={db} ctx={ctx} sp={sp} /> : null}
    </>
  );
}

async function loadRows(db: Db, filter: { from?: string; to?: string; method?: string; inbox?: boolean }, families: Family[]): Promise<PaymentRow[]> {
  let q = db.from("payment_balances").select("*, guardians(full_name), players(full_name)").order("received_on", { ascending: false }).order("created_at", { ascending: false }).limit(500);
  if (filter.from) q = q.gte("received_on", filter.from);
  if (filter.to) q = q.lt("received_on", filter.to);
  if (filter.method) q = q.eq("method", filter.method);
  if (filter.inbox) q = q.gt("unallocated", 0);
  const { data: pays, error } = await q;
  if (error) throw error;
  const ids = (pays ?? []).map((p) => p.id);
  const [allocs, receipts] = ids.length
    ? await Promise.all([
        db.from("allocations").select("payment_id, amount, charges(title, players(full_name))").in("payment_id", ids),
        db.from("receipts").select("id, payment_id, series, number").in("payment_id", ids),
      ])
    : [{ data: [] }, { data: [] }];
  const byPay = new Map<string, PaymentRow["allocations"]>();
  for (const a of allocs.data ?? []) {
    const c = a.charges as { title: string; players: { full_name: string } | null } | null;
    byPay.set(a.payment_id, [...(byPay.get(a.payment_id) ?? []), { title: c?.title ?? "", player: c?.players?.full_name ?? "", amount: a.amount }]);
  }
  const rc = new Map((receipts.data ?? []).map((r) => [r.payment_id, r]));
  const famBy = new Map<string, Family>();
  for (const f of families) famBy.set(f.guardianId ?? `p:${f.playerId}`, f);
  return (pays ?? []).map((p) => {
    const r = rc.get(p.id);
    return {
      id: p.id, received_on: p.received_on, amount: p.amount, method: p.method, status: p.status, refunded_amount: p.refunded_amount,
      allocated: p.allocated, unallocated: p.unallocated,
      payer: (p.guardians as { full_name: string } | null)?.full_name ?? (p.players as { full_name: string } | null)?.full_name ?? p.payer_name ?? "—",
      reference: p.reference, note: p.note, provider: p.provider, provider_ref: p.provider_ref,
      receiptId: r?.id ?? null, receiptLabel: r ? `${r.series} nr. ${r.number}` : null,
      family: p.guardian_id ? famBy.get(p.guardian_id) ?? null : p.player_id ? famBy.get(`p:${p.player_id}`) ?? null : null,
      allocations: byPay.get(p.id) ?? [],
    };
  });
}

async function ListView({ db, ctx, sp, families }: { db: Db; ctx: AppContext; sp: SP; families: Family[] }) {
  const t = getT().money.payments;
  const month = /^\d{4}-\d{2}$/.test(sp.luna ?? "") ? `${sp.luna}-01` : periodOf(ctx.today);
  const method = ["cash", "bank", "online", "card"].includes(sp.mod ?? "") ? sp.mod! : null;
  const rows = await loadRows(db, { from: month, to: addMonths(month, 1), method: method ?? undefined }, families);
  const href = (o: { luna?: string; mod?: string | null }) => {
    const u = new URLSearchParams({ luna: (o.luna ?? month).slice(0, 7) });
    const md = o.mod === undefined ? method : o.mod;
    if (md) u.set("mod", md);
    return `/bani/incasari?${u.toString()}`;
  };
  const total = rows.filter((r) => r.status === "completed").reduce((s, r) => s + r.amount - r.refunded_amount, 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="w-72"><PrevNext prevHref={href({ luna: addMonths(month, -1) })} nextHref={href({ luna: addMonths(month, 1) })} label={monthLabel(month)} /></div>
        <p className="text-lg font-bold"><Money value={total} /></p>
      </div>
      <FilterLinks label={t.filterMethod} items={[
        { href: href({ mod: null }), label: t.filterMethod, active: !method },
        ...(["cash", "bank", "online", "card"] as const).map((k) => ({ href: href({ mod: k }), label: PAYMENT_METHOD_LABELS[k], active: method === k })),
      ]} />
      {rows.length === 0 ? <EmptyState title={t.empty} /> : <PaymentList rows={rows} families={families} canRefund={can(ctx.role, "administerMoney")} />}
    </div>
  );
}

async function InboxView({ db, families }: { db: Db; families: Family[] }) {
  const t = getT().money.payments;
  const rows = await loadRows(db, { inbox: true }, families);
  // propunere de familie: cuvintele din numele plătitorului / referință care se regăsesc în numele părintelui sau copilului
  const suggest = (r: PaymentRow): Family | null => {
    if (r.family) return r.family;
    const words = new Set(norm(`${r.payer} ${r.reference ?? ""}`).split(" ").filter((w) => w.length > 2));
    let best: { f: Family; score: number } | null = null;
    for (const f of families) {
      const fw = norm(`${f.label} ${f.detail}`).split(" ");
      const score = fw.filter((w) => words.has(w)).length;
      if (score >= 2 && (!best || score > best.score)) best = { f, score };
    }
    return best?.f ?? null;
  };
  return (
    <div className="space-y-4">
      <p className="max-w-prose text-ink-3">{t.inbox.description}</p>
      {rows.length === 0 ? <EmptyState title={t.inbox.empty} description={t.inbox.emptyText} /> : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {rows.map((r) => {
            const s = suggest(r);
            return (
              <li key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[6rem_1fr_auto_auto]">
                <span className="tabular-nums text-ink-2">{formatDateShort(r.received_on)}</span>
                <Money value={r.unallocated} className="text-right text-lg font-bold sm:order-3" />
                <span className="col-span-2 min-w-0 sm:order-2 sm:col-span-1">
                  <span className="block font-semibold">{r.payer}</span>
                  <span className="block text-sm text-ink-3">{PAYMENT_METHOD_LABELS[r.method] ?? r.method}{r.reference ? ` · ${r.reference}` : ""}</span>
                  {s && !r.family ? <span className="block text-sm font-semibold text-ink-2">{t.inbox.suggestion(s.label)}</span> : null}
                </span>
                <span className="col-span-2 sm:order-4 sm:col-span-1"><AssignPaymentButton payment={{ ...r, family: s }} families={families} /></span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

async function ReceiptsView({ db, ctx, sp }: { db: Db; ctx: AppContext; sp: SP }) {
  const t = getT().money.payments.receipts;
  const year = /^\d{4}$/.test((sp.luna ?? "").slice(0, 4)) ? Number(sp.luna!.slice(0, 4)) : Number(ctx.today.slice(0, 4));
  const { data } = await db.from("receipts").select("id, series, number, issued_on, payer_name, amount, description, cancelled_at")
    .gte("issued_on", `${year}-01-01`).lt("issued_on", `${year + 1}-01-01`).order("issued_on", { ascending: false }).order("number", { ascending: false });
  const rows = data ?? [];
  return (
    <div className="space-y-4">
      <div className="w-56"><PrevNext prevHref={`/bani/incasari?vedere=chitante&luna=${year - 1}-01`} nextHref={`/bani/incasari?vedere=chitante&luna=${year + 1}-01`} label={year} /></div>
      {rows.length === 0 ? <EmptyState title={t.empty} description={t.emptyText} /> : (
        <TableWrap>
          <>
            <thead>
              <tr><th scope="col">{t.cols.number}</th><th scope="col">{t.cols.date}</th><th scope="col">{t.cols.payer}</th><th scope="col">{t.cols.for}</th><th scope="col" className="text-right">{t.cols.amount}</th><th scope="col"><span className="sr-only">{t.download}</span></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.cancelled_at ? "text-ink-3" : undefined}>
                  <td className="whitespace-nowrap font-semibold tabular-nums">{r.series} {r.number}{r.cancelled_at ? <span className="ml-2 inline-flex h-6 items-center rounded-md bg-sunken px-1.5 text-xs font-semibold">{t.cancelledChip}</span> : null}</td>
                  <td className="tabular-nums">{formatDateShort(r.issued_on)}</td>
                  <td>{r.payer_name}</td>
                  <td className="max-w-md text-sm">{r.description}</td>
                  <td className="text-right"><Money value={r.amount} /></td>
                  <td className="text-right"><a href={`/api/bani/chitanta/${r.id}`} className="inline-flex h-10 items-center gap-1 rounded-lg px-2 font-semibold hover:bg-sunken"><FileDown className="size-4" aria-hidden />{t.download}</a></td>
                </tr>
              ))}
            </tbody>
          </>
        </TableWrap>
      )}
    </div>
  );
}
