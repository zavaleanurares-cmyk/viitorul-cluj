import Link from "next/link";
import { ChevronRight, Megaphone, Plus } from "lucide-react";
import { formatDateTime } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { getT } from "@/messages";

export const metadata = { title: "Mesaje" };

/** Mesajele trimise (biroul și directorul: toate; ceilalți: ale lor), cu câți le-au citit. */
export default async function MessagesPage() {
  const { db, ctx } = await requireCapability("clubMessages");
  const t = getT().club.messages;
  const { data } = await db.from("messages").select("id, title, status, scheduled_at, sent_at, recipient_count, author_id, created_at").order("created_at", { ascending: false }).limit(200);
  const ids = (data ?? []).filter((m) => m.status === "sent").map((m) => m.id);
  const { data: reads } = ids.length ? await db.from("message_recipients").select("message_id, read_at").in("message_id", ids).not("read_at", "is", null) : { data: [] };
  const readCount = new Map<string, number>();
  for (const r of reads ?? []) readCount.set(r.message_id, (readCount.get(r.message_id) ?? 0) + 1);
  const authors = [...new Set((data ?? []).map((m) => m.author_id).filter(Boolean))] as string[];
  const { data: names } = authors.length ? await db.from("profiles").select("id, full_name").in("id", authors) : { data: [] };
  const nameOf = new Map((names ?? []).map((n) => [n.id, n.full_name]));
  const tz = ctx.settings.timezone;
  return (
    <>
      <PageHeader title={t.title} description={t.description} action={<LinkButton href="/club/mesaje/nou" variant="primary" icon={<Plus className="size-5" aria-hidden />}>{t.new}</LinkButton>} />
      {!data?.length ? <EmptyState icon={<Megaphone className="size-8" aria-hidden />} title={t.empty} description={t.emptyText} /> : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line/70 bg-surface shadow-[var(--shadow-card)]">
          {data.map((m) => {
            const read = readCount.get(m.id) ?? 0;
            const pct = m.recipient_count ? Math.round((read / m.recipient_count) * 100) : 0;
            return (
              <li key={m.id}>
                <Link href={`/club/mesaje/${m.id}`} className="grid gap-2 px-4 py-3 hover:bg-canvas sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-center">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{m.title}</span>
                      <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold", m.status === "sent" ? "bg-st-green-soft" : m.status === "scheduled" ? "bg-st-blue-soft" : "bg-sunken text-ink-3")}>{t.status[m.status as "sent"]}</span>
                    </span>
                    <span className="block text-sm text-ink-3">
                      {m.status === "scheduled" ? t.scheduledFor(formatDateTime(m.scheduled_at, tz)) : formatDateTime(m.sent_at ?? m.created_at, tz)}
                      {m.author_id ? ` · ${t.by(nameOf.get(m.author_id) ?? "—")}` : ""}
                    </span>
                  </span>
                  {m.status === "sent" ? (
                    <span className="space-y-1">
                      <span className="block text-sm text-ink-2">{t.readStats(read, m.recipient_count)}</span>
                      <span className="block h-2 overflow-hidden rounded-full bg-sunken" aria-hidden><span className="block h-full rounded-full bg-st-green" style={{ width: `${pct}%` }} /></span>
                    </span>
                  ) : <span />}
                  <ChevronRight className="hidden size-5 text-ink-3 sm:block" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
