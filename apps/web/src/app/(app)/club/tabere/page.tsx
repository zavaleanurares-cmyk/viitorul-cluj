import Link from "next/link";
import { CalendarRange, MapPin, Tent } from "lucide-react";
import { formatDate, formatLei } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/status";
import { ProgressBar, TabLinks } from "@/components/ui/misc";
import { CampFormButton } from "@/components/club/camp-admin";
import { getT } from "@/messages";

export const metadata = { title: "Tabere" };

const TONE = { draft: "gray", open: "green", closed: "yellow", cancelled: "gray" } as const;

export default async function CampsPage({ searchParams }: { searchParams: Promise<{ vedere?: string }> }) {
  const { db, ctx } = await requireCapability("manageCamps");
  const t = getT().club.camps;
  const past = (await searchParams).vedere === "incheiate";
  const { data: camps } = await db.from("camps").select("id, title, location, starts_on, ends_on, price, capacity, status, birth_year_from, birth_year_to, camp_registrations(status)")
    .order("starts_on", { ascending: past ? false : true });
  const list = (camps ?? []).filter((c) => (past ? c.ends_on < ctx.today : c.ends_on >= ctx.today));
  return (
    <>
      <PageHeader title={t.title} description={t.description} action={<CampFormButton />} />
      <TabLinks className="mb-4" current={past ? "past" : "upcoming"} tabs={[
        { key: "upcoming", href: "/club/tabere", label: t.views.upcoming },
        { key: "past", href: "/club/tabere?vedere=incheiate", label: t.views.past },
      ]} />
      {!list.length ? <EmptyState icon={<Tent className="size-8" aria-hidden />} title={t.empty} /> : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((c) => {
            const regs = (c.camp_registrations ?? []) as Array<{ status: string }>;
            const taken = regs.filter((r) => r.status === "confirmed").length;
            const waiting = regs.filter((r) => r.status === "waitlist").length;
            const pending = regs.filter((r) => r.status === "pending").length;
            return (
              <li key={c.id}>
                <Link href={`/club/tabere/${c.id}`} className="block space-y-3 rounded-[var(--radius-card)] border border-line/70 bg-surface p-4 hover:border-line-strong shadow-[var(--shadow-card)]">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-lg font-bold">{c.title}</span>
                    <Badge tone={TONE[c.status as keyof typeof TONE]}>{t.status[c.status as keyof typeof t.status]}</Badge>
                  </div>
                  <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
                    <span className="inline-flex items-center gap-1"><CalendarRange className="size-4" aria-hidden />{t.dates(formatDate(c.starts_on), formatDate(c.ends_on))}</span>
                    {c.location ? <span className="inline-flex items-center gap-1"><MapPin className="size-4" aria-hidden />{c.location}</span> : null}
                  </p>
                  <p className="text-sm text-ink-3">{t.years(c.birth_year_from, c.birth_year_to)} · {c.price ? formatLei(c.price) : t.free}</p>
                  <div className="space-y-1">
                    <ProgressBar value={taken} max={c.capacity} label={t.taken(taken, c.capacity)} />
                    <p className="flex flex-wrap gap-x-3 text-sm text-ink-2">
                      <span>{t.taken(taken, c.capacity)}</span>
                      {pending ? <span className="font-semibold text-ink">{t.pendingN(pending)}</span> : null}
                      {waiting ? <span>{t.waitlistN(waiting)}</span> : null}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
