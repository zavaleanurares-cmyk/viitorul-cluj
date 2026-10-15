import Link from "next/link";
import { ChevronRight, CircleAlert, ClipboardList, Landmark, Wallet } from "lucide-react";
import { can, formatLei, type AppContext, type Db } from "@club/shared";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getT } from "@/messages";

/** Azi, biroul: ce e de rezolvat la bani (restanțe, plăți de asociat, extras, referate). Nimic de rezolvat → nu apare. */
export async function MoneyTodayCard({ db, ctx }: { db: Db; ctx: AppContext }) {
  const t = getT().today.money;
  const finance = can(ctx.role, "manageMoney");
  const [overdue, unalloc, bank, pending, settings] = await Promise.all([
    finance ? db.from("charge_balances").select("balance, guardian_id, player_id").eq("status", "open").gt("balance", 0).lt("due_on", ctx.today) : Promise.resolve({ data: [] }),
    finance ? db.from("payment_balances").select("id", { count: "exact", head: true }).gt("unallocated", 0) : Promise.resolve({ count: 0 }),
    finance ? db.from("bank_lines").select("id", { count: "exact", head: true }).eq("status", "unmatched") : Promise.resolve({ count: 0 }),
    db.from("purchase_requests").select("id, requested_by", { count: "exact" }).eq("status", "submitted"),
    db.from("finance_settings").select("approver_roles").maybeSingle(),
  ]);
  const rows = (overdue.data ?? []) as Array<{ balance: number; guardian_id: string | null; player_id: string }>;
  const owed = rows.reduce((s, r) => s + r.balance, 0);
  const families = new Set(rows.map((r) => r.guardian_id ?? r.player_id)).size;
  const approver = (settings.data?.approver_roles ?? []).includes(ctx.role);
  const toApprove = approver ? (pending.data ?? []).filter((r) => r.requested_by !== ctx.userId).length : 0;
  const items = [
    ...(owed ? [{ key: "o", href: "/bani/taxe", icon: Wallet, text: t.overdue(formatLei(owed), families), tone: "bg-st-red-soft text-st-red" }] : []),
    ...((unalloc.count ?? 0) ? [{ key: "u", href: "/bani/incasari?vedere=asociat", icon: CircleAlert, text: t.unallocated(unalloc.count ?? 0), tone: "bg-st-yellow-soft text-ink" }] : []),
    ...((bank.count ?? 0) ? [{ key: "b", href: "/bani/banca", icon: Landmark, text: t.bank(bank.count ?? 0), tone: "bg-st-yellow-soft text-ink" }] : []),
    ...(toApprove ? [{ key: "r", href: "/bani/referate?stare=submitted", icon: ClipboardList, text: t.requests(toApprove), tone: "bg-st-blue-soft text-ink" }] : []),
  ];
  if (!items.length) return null;
  return (
    <Card>
      <CardHeader title={t.title} />
      <CardBody className="pt-2">
        <ul className="divide-y divide-line">
          {items.map((it) => (
            <li key={it.key}>
              <Link href={it.href} className="flex min-h-14 items-center gap-3 py-2 hover:underline">
                <span aria-hidden className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full ${it.tone}`}><it.icon className="size-5" /></span>
                <span className="flex-1 font-semibold">{it.text}</span>
                <ChevronRight className="size-5 text-ink-3" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

/** Azi, părintele: cât e de plată (cu restanțele), cu drum direct la Plăți. */
export async function FamilyDueCard({ db, ctx }: { db: Db; ctx: AppContext }) {
  const t = getT().today.money;
  const { data } = await db.from("charge_balances").select("balance, due_on").eq("status", "open").gt("balance", 0);
  const rows = data ?? [];
  if (!rows.length) return null;
  const total = rows.reduce((s, r) => s + r.balance, 0);
  const late = rows.filter((r) => r.due_on < ctx.today).length;
  return (
    <Link href="/plati" className={`flex min-h-16 items-center gap-3 rounded-[var(--radius-card)] px-4 py-3 ${late ? "bg-st-red-soft" : "bg-st-blue-soft"}`}>
      <Wallet className="size-6 shrink-0" aria-hidden />
      <span className="flex-1">
        <span className="block text-lg font-bold">{t.familyDue(formatLei(total))}</span>
        {late ? <span className="flex items-center gap-1 text-sm font-semibold"><CircleAlert className="size-4" aria-hidden />{t.familyLate(late)}</span> : null}
      </span>
      <span className="font-semibold underline">{t.pay}</span>
    </Link>
  );
}
