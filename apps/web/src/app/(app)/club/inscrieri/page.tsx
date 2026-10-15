import Link from "next/link";
import { CalendarClock, ExternalLink, Globe, Star, UserPlus } from "lucide-react";
import { formatDate, formatDateTime } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { TabLinks } from "@/components/ui/misc";
import { RequestFormButton } from "@/components/club/enrolment-admin";
import { getT } from "@/messages";
import { requestTime } from "@/lib/request-time";

export const metadata = { title: "Înscrieri" };

type Row = {
  id: string; status: string; child_name: string; birth_date: string; group_id: string | null; source: string;
  created_at: string; trial_at: string | null; trial_rating: number | null; updated_at: string;
};

function RequestCard({ r, team, tz }: { r: Row; team: string; tz: string }) {
  const t = getT().club.enrolment;
  return (
    <li>
      <Link href={`/club/inscrieri/${r.id}`} className="block rounded-[var(--radius-control)] border border-line bg-surface p-3 hover:border-line-strong hover:bg-canvas">
        <span className="block font-semibold">{r.child_name}</span>
        <span className="block text-sm text-ink-3">{t.born(Number(r.birth_date.slice(0, 4)))} · {team}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
          {r.status === "trial" && r.trial_at ? <span className="inline-flex items-center gap-1"><CalendarClock className="size-4" aria-hidden />{formatDateTime(r.trial_at, tz)}</span> : null}
          {r.trial_rating ? <span className="inline-flex items-center gap-1"><Star className="size-4" aria-hidden />{t.rating(r.trial_rating)}</span> : null}
          {r.status === "new" ? <span className="inline-flex items-center gap-1">{r.source === "public" ? <Globe className="size-4" aria-hidden /> : null}{t.received(formatDate(r.created_at.slice(0, 10)))}</span> : null}
          {r.status === "declined" || r.status === "withdrawn" ? <span>{t.status[r.status]} · {formatDate(r.updated_at.slice(0, 10))}</span> : null}
        </span>
      </Link>
    </li>
  );
}

export default async function EnrolmentPage({ searchParams }: { searchParams: Promise<{ vedere?: string }> }) {
  const { db, ctx } = await requireCapability("manageEnrolment");
  const t = getT().club.enrolment;
  const closed = (await searchParams).vedere === "inchise";
  const { data } = await db.from("enrolment_requests")
    .select("id, status, child_name, birth_date, group_id, source, created_at, trial_at, trial_rating, updated_at")
    .order("created_at", { ascending: false }).limit(1000);
  const rows = (data ?? []) as Row[];
  const team = (id: string | null) => ctx.groups.find((g) => g.id === id)?.name ?? t.noTeam;
  const recent = new Date(requestTime() - 45 * 86400e3).toISOString();
  const stages = [
    { key: "new", rows: rows.filter((r) => r.status === "new") },
    { key: "trial", rows: rows.filter((r) => r.status === "trial").sort((a, b) => (a.trial_at ?? "").localeCompare(b.trial_at ?? "")) },
    { key: "trial_done", rows: rows.filter((r) => r.status === "trial_done") },
    { key: "enrolled", rows: rows.filter((r) => r.status === "enrolled" && r.updated_at > recent) },
  ] as const;
  const closedRows = rows.filter((r) => r.status === "declined" || r.status === "withdrawn");
  const publicHref = `/c/${ctx.club.slug}/inscriere`;


  return (
    <>
      <PageHeader title={t.title} description={t.description}
        action={<div className="flex flex-wrap gap-2">
          <a href={publicHref} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full px-4 font-medium hover:bg-line bg-sunken transition-colors">
            <ExternalLink className="size-5" aria-hidden />{t.publicForm}
          </a>
          <RequestFormButton groups={ctx.groups.map((g) => ({ id: g.id, name: g.name }))} />
        </div>} />
      <TabLinks className="mb-4" current={closed ? "closed" : "open"} tabs={[
        { key: "open", href: "/club/inscrieri", label: t.title },
        { key: "closed", href: "/club/inscrieri?vedere=inchise", label: `${t.stages.closed}${closedRows.length ? ` · ${closedRows.length}` : ""}` },
      ]} />
      {!rows.length ? <EmptyState icon={<UserPlus className="size-8" aria-hidden />} title={t.empty} /> : closed ? (
        closedRows.length ? <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{closedRows.map((r) => <RequestCard key={r.id} r={r} team={team(r.group_id)} tz={ctx.settings.timezone} />)}</ul> : <p className="text-ink-3">{t.emptyStage}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stages.map((s) => (
            <section key={s.key} aria-labelledby={`st-${s.key}`} className="rounded-[var(--radius-card)] bg-sunken/60 p-3">
              <h2 id={`st-${s.key}`} className="mb-2 flex items-center justify-between text-base">
                {t.stages[s.key]}<span className="rounded-full bg-surface px-2 text-sm tabular-nums text-ink-2">{s.rows.length}</span>
              </h2>
              {s.rows.length ? <ul className="space-y-2">{s.rows.map((r) => <RequestCard key={r.id} r={r} team={team(r.group_id)} tz={ctx.settings.timezone} />)}</ul> : <p className="px-1 py-2 text-sm text-ink-3">{t.emptyStage}</p>}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
