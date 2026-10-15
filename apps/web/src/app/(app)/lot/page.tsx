import Link from "next/link";
import { ChevronRight, Plus, Search, Ban } from "lucide-react";
import { ageOn, can } from "@club/shared";
import { requireCapability, visibleGroups } from "@/lib/auth";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/status";
import { TableWrap } from "@/components/ui/misc";
import { AttendanceMeter, FilterLinks, VisaChip } from "@/components/squad/bits";
import { listRoster, visaState } from "@/components/squad/queries";
import { getT } from "@/messages";

export const metadata = { title: "Lot" };

export default async function SquadPage({ searchParams }: { searchParams: Promise<{ echipa?: string; q?: string }> }) {
  const { db, ctx } = await requireCapability("viewSquad");
  const sp = await searchParams;
  const t = getT().squad;
  const groups = visibleGroups(ctx);
  const teamId = typeof sp.echipa === "string" && (sp.echipa === "none" || groups.some((g) => g.id === sp.echipa)) ? sp.echipa : null;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const canManage = can(ctx.role, "manageSquad");

  const all = await listRoster(db, { today: ctx.today });
  const rows = (teamId ? all.filter((p) => (teamId === "none" ? !p.group_id : p.group_id === teamId)) : all)
    .filter((p) => !q || [p.full_name, p.display_name].some((s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .includes(q.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase())));
  const groupName = new Map(ctx.groups.map((g) => [g.id, g.name]));
  const status = new Map(ctx.statuses.map((s) => [s.id, s]));
  const warn = ctx.settings.alerts.visa_days_before;
  const href = (params: { echipa?: string | null; q?: string }) => {
    const u = new URLSearchParams();
    if (params.echipa) u.set("echipa", params.echipa);
    if (params.q) u.set("q", params.q);
    const s = u.toString();
    return s ? `/lot?${s}` : "/lot";
  };
  const withoutTeam = all.filter((p) => !p.group_id).length;

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.list.description(rows.length)}
        action={canManage ? <LinkButton href="/lot/jucatori/nou" variant="primary" icon={<Plus className="size-5" aria-hidden />}>{t.list.add}</LinkButton> : null}
      />

      <div className="mb-4 space-y-3">
        {groups.length > 1 || withoutTeam ? <FilterLinks label={t.list.all} items={[
          { href: href({ q }), label: t.list.all, active: !teamId, count: all.length },
          ...groups.map((g) => ({ href: href({ echipa: g.id, q }), label: g.name, active: teamId === g.id, count: all.filter((p) => p.group_id === g.id).length })),
          ...(withoutTeam && canManage ? [{ href: href({ echipa: "none", q }), label: t.list.noTeam, active: teamId === "none", count: withoutTeam }] : []),
        ]} /> : null}
        <form action="/lot" method="get" role="search" className="flex max-w-md gap-2">
          {teamId ? <input type="hidden" name="echipa" value={teamId} /> : null}
          <label className="sr-only" htmlFor="lot-q">{t.list.search}</label>
          <input id="lot-q" name="q" defaultValue={q} placeholder={t.list.search}
            className="h-12 min-w-0 flex-1 rounded-[var(--radius-control)] border border-border-control bg-surface px-3" />
          <button type="submit" className="inline-flex h-12 items-center gap-2 rounded-[var(--radius-control)] border border-border-control bg-surface px-4 font-semibold hover:bg-canvas">
            <Search className="size-5" aria-hidden /> {t.list.searchButton}
          </button>
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={t.list.emptyTitle} description={canManage ? t.list.emptyText : t.list.emptyTextReadOnly} />
      ) : (
        <>
          {/* telefon: listă */}
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface md:hidden">
            {rows.map((p) => {
              const st = p.status_id ? status.get(p.status_id) : null;
              const visa = visaState(p.medical_visa_expires_on, ctx.today, warn);
              return (
                <li key={p.id}>
                  <Link href={`/lot/jucatori/${p.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2 hover:bg-canvas">
                    <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken text-sm font-bold text-ink-2">{p.shirt_number ?? "–"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{p.full_name}</span>
                      <span className="flex flex-col items-start gap-1 pt-0.5 text-sm text-ink-3">
                        {p.group_id ? groupName.get(p.group_id) : t.list.noTeam}
                        {visa.state !== "ok" ? <VisaChip {...visa} expires={p.medical_visa_expires_on} /> : null}
                        {p.suspended ? <span className="inline-flex h-6 items-center gap-1 rounded-md bg-st-red px-1.5 text-xs font-semibold text-white"><Ban className="size-3.5" aria-hidden />{t.player.suspended}</span> : null}
                      </span>
                    </span>
                    {st ? <StatusChip status={st} size="sm" /> : null}
                    <ChevronRight className="size-5 shrink-0 text-ink-3" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* ecrane mari: tabel */}
          <TableWrap className="hidden md:block">
            <>
              <thead>
                <tr className="border-b border-line text-left text-xs font-semibold text-ink-3">
                  <th scope="col" className="px-3 py-2.5">{t.list.columns.player}</th>
                  <th scope="col" className="px-3 py-2.5">{t.list.columns.team}</th>
                  <th scope="col" className="px-3 py-2.5">{t.list.columns.position}</th>
                  <th scope="col" className="px-3 py-2.5">{t.list.columns.born}</th>
                  <th scope="col" className="px-3 py-2.5">{t.list.columns.status}</th>
                  <th scope="col" className="px-3 py-2.5">{t.list.columns.visa}</th>
                  <th scope="col" className="px-3 py-2.5">{t.list.columns.attendance}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const st = p.status_id ? status.get(p.status_id) : null;
                  const visa = visaState(p.medical_visa_expires_on, ctx.today, warn);
                  const age = ageOn(p.birth_date, ctx.today);
                  return (
                    <tr key={p.id} className="border-b border-line last:border-0 hover:bg-canvas">
                      <td className="px-3 py-2">
                        <Link href={`/lot/jucatori/${p.id}`} className="flex items-center gap-2 font-semibold text-ink hover:underline">
                          <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-xs font-bold text-ink-2">{p.shirt_number ?? "–"}</span>
                          <span className="text-base">{p.full_name}</span>
                        </Link>
                        {p.suspended ? <span className="ml-10 inline-flex h-6 items-center gap-1 rounded-md bg-st-red px-1.5 text-xs font-semibold text-white"><Ban className="size-3.5" aria-hidden />{t.player.suspended}</span> : null}
                      </td>
                      <td className="px-3 py-2">{p.group_id ? groupName.get(p.group_id) : <span className="text-ink-3">{t.list.noTeam}</span>}</td>
                      <td className="px-3 py-2">{p.position ? t.player.positions[p.position] ?? p.position : "—"}</td>
                      <td className="px-3 py-2 tabular-nums">{p.birth_date ? `${p.birth_date.slice(0, 4)}${age !== null ? ` · ${t.player.years(age)}` : ""}` : "—"}</td>
                      <td className="px-3 py-2">{st ? <StatusChip status={st} size="sm" /> : "—"}</td>
                      <td className="px-3 py-2"><VisaChip {...visa} expires={p.medical_visa_expires_on} /></td>
                      <td className="px-3 py-2">{p.attendance ? <AttendanceMeter {...p.attendance} /> : <span className="text-ink-3">{t.list.noAttendance}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </>
          </TableWrap>
        </>
      )}
    </>
  );
}
