import Link from "next/link";
import { ChevronRight, Megaphone } from "lucide-react";
import { formatDateTime } from "@club/shared";
import { requireSession } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { getT } from "@/messages";
import { FamilyClubTabs } from "@/components/club/family-tabs";
import { FamilyNewsCard } from "@/components/club/family-news";

export const metadata = { title: "Mesaje" };

/** Mesajele primite de la club (oricare rol). */
export default async function InboxPage() {
  const { db, ctx } = await requireSession();
  const t = getT().club.messages;
  const { data } = await db.from("message_recipients").select("message_id, read_at, messages!inner(id, title, body, sent_at, status)")
    .eq("user_id", ctx.userId).eq("messages.status", "sent").limit(200);
  const rows = (data ?? []).map((r) => ({ read: !!r.read_at, ...(r.messages as unknown as { id: string; title: string; body: string; sent_at: string }) }))
    .sort((a, b) => (b.sent_at ?? "").localeCompare(a.sent_at ?? ""));
  return (
    <div className="mx-auto max-w-2xl">
      {ctx.role === "guardian" || ctx.role === "player" ? <FamilyClubTabs current="messages" /> : null}
      <PageHeader title={t.inbox} description={t.inboxDescription} />
      <div className="mb-4"><FamilyNewsCard db={db} today={ctx.today} days={60} limit={3} /></div>
      {!rows.length ? <EmptyState icon={<Megaphone className="size-8" aria-hidden />} title={t.inboxEmpty} /> : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {rows.map((m) => (
            <li key={m.id}>
              <Link href={`/mesaje/${m.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2 hover:bg-canvas">
                <span className={cn("size-2.5 shrink-0 rounded-full", m.read ? "bg-transparent" : "bg-st-blue")} aria-label={m.read ? t.read : t.unread} />
                <span className="min-w-0 flex-1">
                  <span className={cn("block", m.read ? "font-semibold" : "font-bold")}>{m.title}</span>
                  <span className="block truncate text-sm text-ink-3">{formatDateTime(m.sent_at, ctx.settings.timezone)} · {m.body}</span>
                </span>
                <ChevronRight className="size-5 text-ink-3" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
