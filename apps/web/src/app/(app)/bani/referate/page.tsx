import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { formatDateShort, PURCHASE_STATUS_LABELS } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { FilterLinks } from "@/components/squad/bits";
import { Money, PurchaseStatusChip } from "@/components/money/bits";
import { getT } from "@/messages";

export const metadata = { title: "Referate" };

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<{ stare?: string }> }) {
  const { db, ctx } = await requireCapability("purchaseRequests");
  const sp = await searchParams;
  const t = getT().money.purchases;
  const filter = (["submitted", "approved", "mine"] as const).find((f) => f === sp.stare) ?? null;
  let q = db.from("purchase_requests").select("id, number, status, total, justification, created_at, department_id, requested_by, departments(name), profiles!purchase_requests_requested_by_fkey(full_name)")
    .order("number", { ascending: false }).limit(200);
  if (filter === "mine") q = q.eq("requested_by", ctx.userId);
  else if (filter) q = q.eq("status", filter);
  const { data } = await q;
  const rows = data ?? [];
  const items = [
    { href: "/bani/referate", label: t.filters.all, active: !filter },
    { href: "/bani/referate?stare=submitted", label: t.filters.submitted, active: filter === "submitted" },
    { href: "/bani/referate?stare=approved", label: t.filters.approved, active: filter === "approved" },
    { href: "/bani/referate?stare=mine", label: t.filters.mine, active: filter === "mine" },
  ];
  return (
    <>
      <PageHeader title={t.title} description={t.description} action={<LinkButton href="/bani/referate/nou" variant="primary" icon={<Plus className="size-5" aria-hidden />}>{t.add}</LinkButton>} />
      <div className="mb-4"><FilterLinks label={t.filters.all} items={items} /></div>
      {rows.length === 0 ? <EmptyState title={t.empty} description={t.emptyText} /> : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/bani/referate/${r.id}`} className="grid min-h-16 grid-cols-[3.5rem_1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-canvas sm:grid-cols-[3.5rem_1fr_auto_auto_auto]">
                <span className="font-bold tabular-nums text-ink-2">#{r.number}</span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{r.justification}</span>
                  <span className="block truncate text-sm text-ink-3">
                    {(r.profiles as { full_name: string } | null)?.full_name ?? "—"} · {formatDateShort(r.created_at.slice(0, 10))}
                    {(r.departments as { name: string } | null)?.name ? ` · ${(r.departments as { name: string }).name}` : ""}
                  </span>
                </span>
                <Money value={r.total} className="text-right font-bold" />
                <span className="col-span-2 col-start-2 sm:col-span-1 sm:col-start-auto"><PurchaseStatusChip status={r.status} label={PURCHASE_STATUS_LABELS[r.status] ?? r.status} /></span>
                <ChevronRight className="hidden size-5 text-ink-3 sm:block" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
