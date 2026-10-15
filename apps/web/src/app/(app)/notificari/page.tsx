import { Bell, Gauge, BellRing, CalendarDays, ChevronRight, CircleCheck, ClipboardCheck, ClipboardList, HeartPulse, ListChecks, ReceiptText, Stethoscope, TriangleAlert, Wallet, Clapperboard, FileCheck2, FileSignature, Megaphone, ShoppingBag, Star, Tent, UserPlus } from "lucide-react";
import { addDays, formatDateTime, listNotifications, todayIn, type Notification } from "@club/shared";
import { requireSession } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { getT } from "@/messages";
import { knownKind, safeInternalLink, type KnownKind } from "@/components/notifications/links";
import { MarkAllButton } from "@/components/notifications/mark-all-button";

const LIMIT = 100;

const ICONS: Record<KnownKind | "other", typeof Bell> = {
  wellness_reminder: ClipboardCheck,
  plan_new: CalendarDays,
  program_new: ListChecks,
  status_changed: HeartPulse,
  alert: TriangleAlert,
  visa_expiring: Stethoscope,
  fee_issued: ReceiptText,
  fee_reminder: Wallet,
  charge_request: ReceiptText,
  payment_received: CircleCheck,
  purchase_request: ClipboardList,
  visa_document: FileCheck2,
  visa_reminder: Stethoscope,
  rpe_request: Gauge,
  evaluation_published: Star,
  evaluation_round: Star,
  video_shared: Clapperboard,
  message: Megaphone,
  contract_sign: FileSignature,
  shop_order: ShoppingBag,
  enrolment: UserPlus,
  camp: Tent,
  other: BellRing,
};

/** Notificările utilizatorului curent (toate rolurile). RLS întoarce doar rândurile lui. */
export default async function Page() {
  const { db, ctx } = await requireSession();
  const t = getT().notifications;
  const tz = ctx.settings.timezone;
  const items = await listNotifications(db, LIMIT);
  const unread = items.filter((n) => !n.read_at);
  const read = items.filter((n) => n.read_at);

  const when = (iso: string) => {
    const day = todayIn(tz, new Date(iso));
    const full = formatDateTime(iso, tz);
    const time = full.split(", ")[1] ?? "";
    if (day === ctx.today) return t.today(time);
    if (day === addDays(ctx.today, -1)) return t.yesterday(time);
    return full;
  };

  const renderItem = (n: Notification) => {
    const kind = knownKind(n.kind);
    const Icon = ICONS[kind];
    const isUnread = !n.read_at;
    const hasLink = !!safeInternalLink(n.link);
    const body = (
      <>
        <span className={cn("mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-full", isUnread ? "border border-line-strong bg-surface text-ink" : "bg-sunken text-ink-3")}>
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className={cn("break-words", isUnread ? "font-bold" : "font-semibold text-ink-2")}>{n.title}</span>
            {isUnread ? <span className="sr-only">({t.unread})</span> : null}
          </span>
          {n.body ? <span className="block break-words text-ink-2">{n.body}</span> : null}
          <span className="mt-0.5 block text-sm text-ink-3">{t.kinds[kind]} · {when(n.created_at)}</span>
        </span>
        {isUnread ? <span aria-hidden className="mt-2 size-2.5 shrink-0 rounded-full bg-st-blue" /> : null}
        {hasLink ? <ChevronRight className="mt-1.5 size-5 shrink-0 text-ink-3" aria-hidden /> : null}
      </>
    );
    const cls = cn("flex min-h-16 items-start gap-3 px-4 py-3", isUnread && "bg-st-blue-soft/50");
    return (
      <li key={n.id} className="border-t border-line first:border-t-0">
        {/* link simplu, fără preîncărcare: deschiderea marchează notificarea ca citită */}
        {hasLink || isUnread ? <a href={`/notificari/${n.id}`} className={cn(cls, "hover:bg-canvas")}>{body}</a> : <div className={cls}>{body}</div>}
      </li>
    );
  };

  return (
    <>
      <PageHeader
        title={t.title}
        description={items.length ? t.description(unread.length) : undefined}
        action={unread.length ? <MarkAllButton label={t.markAll} /> : undefined}
      />
      {items.length === 0 ? (
        <EmptyState icon={<Bell className="size-8" aria-hidden />} title={t.emptyTitle} description={t.emptyDescription} />
      ) : (
        <div className="grid gap-4">
          {unread.length ? (
            <section aria-labelledby="notif-necitite">
              <h2 id="notif-necitite" className="mb-2 text-sm font-semibold text-ink-3">{t.unreadSection} · {unread.length}</h2>
              <ul className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">{unread.map(renderItem)}</ul>
            </section>
          ) : null}
          {read.length ? (
            <section aria-labelledby="notif-citite">
              <h2 id="notif-citite" className="mb-2 text-sm font-semibold text-ink-3">{t.readSection}</h2>
              <ul className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">{read.map(renderItem)}</ul>
            </section>
          ) : null}
          {items.length >= LIMIT ? <p className="text-sm text-ink-3">{t.limitNote(LIMIT)}</p> : null}
        </div>
      )}
    </>
  );
}
