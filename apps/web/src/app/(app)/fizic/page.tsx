import Link from "next/link";
import { Activity, ChevronRight, Plus, Upload, Users } from "lucide-react";
import {
  SESSION_TYPES, WEEKDAYS_SHORT_RO, addDays, can, formatDateShort, isoWeekday, label, listPlayers, weekStart,
} from "@club/shared";
import { requireCapability, visibleGroups } from "@/lib/auth";
import { BarsChart, TrendChart } from "@/components/charts";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/status";
import { getT } from "@/messages";
import { formatNumber, mean } from "@/components/physical/domain";
import { listMetricsFor, listSessions } from "@/components/physical/queries";
import { SectionNav } from "@/components/physical/section-nav";
import { IntervalNav } from "@/components/wellness/interval-nav";

const INTERVALS = [7, 28, 90] as const;
const SUMMARY_WEEKS = 8;

/** Date fizice pe grupă: sinteza ultimelor săptămâni și lista sesiunilor. */
export default async function Page({ searchParams }: { searchParams: Promise<{ grupa?: string; zile?: string }> }) {
  const { db, ctx } = await requireCapability("viewPhysicalData");
  const sp = await searchParams;
  const t = getT().physical;
  const canEdit = can(ctx.role, "manage");
  const groups = visibleGroups(ctx);

  if (!groups.length) {
    return (
      <>
        <PageHeader title={t.title} />
        <EmptyState
          icon={<Users className="size-8" aria-hidden />}
          title={ctx.role === "coach" ? t.noGroupsCoachTitle : t.noGroupsTitle}
          description={ctx.role === "coach" ? t.noGroupsCoach : t.noGroups}
        />
      </>
    );
  }

  const group = groups.find((g) => g.id === sp.grupa) ?? groups[0];
  const days = INTERVALS.find((d) => String(d) === sp.zile) ?? 28;
  const today = ctx.today;
  const from = addDays(today, -(days - 1));
  const summaryFrom = addDays(weekStart(today), -7 * (SUMMARY_WEEKS - 1));

  const players = await listPlayers(db, { groupId: group.id });
  const ids = players.map((p) => p.id);
  const [sessions, metrics] = await Promise.all([
    listSessions(db, group.id, ids, from, today),
    listMetricsFor(db, ids, summaryFrom, today),
  ]);

  const q = (g: string, zile: number = days) => {
    const p = new URLSearchParams();
    if (g !== groups[0].id) p.set("grupa", g);
    if (zile !== 28) p.set("zile", String(zile));
    const s = p.toString();
    return s ? `?${s}` : "";
  };
  const groupParam = group.id === groups[0].id ? "" : `?grupa=${group.id}`;

  // sinteză: media pe jucător și sesiune, pe săptămâni
  const weeks = Array.from({ length: SUMMARY_WEEKS }, (_, i) => addDays(summaryFrom, 7 * i));
  const weekly = weeks.map((monday) => {
    const rows = metrics.filter((m) => weekStart(m.session_date) === monday);
    const total = mean(rows.map((m) => m.values.total_distance_m));
    const hsr = mean(rows.map((m) => m.values.hsr_distance_m));
    return { x: formatDateShort(monday, false), total: total === null ? null : Math.round(total), hsr: hsr === null ? null : Math.round(hsr) };
  });
  const nameOf = new Map(players.map((p) => [p.id, p.display_name]));
  const topSpeed = new Map<string, number>();
  for (const m of metrics) {
    const v = m.values.max_speed_kmh;
    if (v !== null && v > (topSpeed.get(m.player_id) ?? 0)) topSpeed.set(m.player_id, v);
  }
  const speedRows = [...topSpeed.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, value]) => ({ x: nameOf.get(id) ?? "—", value }));
  // cele trei grafice ale sintezei au aceeași înălțime (barele orizontale cresc cu numărul de jucători)
  const chartH = Math.max(220, speedRows.length * 34 + 24);
  const hasSummary = metrics.length > 0;

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description(group.name)}
        action={
          canEdit ? (
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap [&>:last-child:nth-child(odd)]:col-span-2">
              <LinkButton href="/import?tip=fizic" icon={<Upload className="size-5" aria-hidden />}>{t.importKsport}</LinkButton>
              <LinkButton href={`/fizic/sesiuni/nou${groupParam}`} variant="primary" icon={<Plus className="size-5" aria-hidden />}>{t.addSession}</LinkButton>
            </div>
          ) : undefined
        }
      />
      <SectionNav
        current="sesiuni"
        groups={groups}
        groupId={group.id}
        hrefFor={(section, g) => (section === "teste" ? `/fizic/teste${g === groups[0].id ? "" : `?grupa=${g}`}` : `/fizic${q(g)}`)}
      />

      {/* pe telefon lista de sesiuni vine prima; sinteza, după ea */}
      <div className="flex flex-col gap-6">
        {hasSummary ? (
          <section className="space-y-3 max-md:order-last">
            <div>
              <h2 className="text-xl">{t.summary.title}</h2>
              <p className="mt-1 text-sm text-ink-3">{t.summary.hint(SUMMARY_WEEKS)}</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader title={t.summary.totalTitle} description={t.summary.perSession} />
                <CardBody className="relative overflow-hidden">
                  <TrendChart data={weekly} series={[{ key: "total", label: t.summary.totalLabel }]} caption={t.summary.totalCaption(group.name)} connectNulls height={chartH} />
                </CardBody>
              </Card>
              <Card>
                <CardHeader title={t.summary.hsrTitle} description={t.summary.perSession} />
                <CardBody className="relative overflow-hidden">
                  <TrendChart data={weekly} series={[{ key: "hsr", label: t.summary.hsrLabel }]} caption={t.summary.hsrCaption(group.name)} connectNulls height={chartH} />
                </CardBody>
              </Card>
              <Card>
                <CardHeader title={t.summary.speedTitle} description={t.summary.speedHint} />
                <CardBody className="relative overflow-hidden">
                  <BarsChart data={speedRows} label={t.summary.speedLabel} caption={t.summary.speedCaption(group.name)} horizontal height={120} />
                </CardBody>
              </Card>
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl">{t.list.title}</h2>
              <p className="mt-1 text-sm text-ink-3">{t.list.hint(sessions.length, formatDateShort(from, false), formatDateShort(today))}</p>
            </div>
            <IntervalNav
              label={t.list.interval}
              current={String(days)}
              options={INTERVALS.map((d) => ({ value: String(d), label: t.list.days(d), href: `/fizic${q(group.id, d)}` }))}
              className="w-full md:w-auto"
            />
          </div>

          {sessions.length ? (
            <ul className="-mx-4 divide-y divide-line border-y border-line bg-surface md:mx-0 md:overflow-hidden md:rounded-[var(--radius-card)] md:border">
              {sessions.map((s) => (
                <li key={s.id}>
                  <Link href={`/fizic/sesiuni/${s.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-canvas">
                    <span className="w-16 shrink-0 leading-tight">
                      <span className="block text-sm text-ink-3">{WEEKDAYS_SHORT_RO[isoWeekday(s.session_date) - 1]}</span>
                      <span className="block font-bold">{formatDateShort(s.session_date, false)}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="truncate font-semibold">{s.name || label(SESSION_TYPES, s.session_type)}</span>
                        <Badge tone={s.session_type === "match" ? "blue" : "outline"}>{label(SESSION_TYPES, s.session_type)}</Badge>
                      </span>
                      <span className="block text-sm text-ink-3">
                        {[
                          s.duration_min ? t.list.minutes(s.duration_min) : null,
                          t.sources[s.source as keyof typeof t.sources] ?? s.source,
                          !s.group_id ? t.list.noGroup : null,
                        ].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-right leading-tight">
                      <span className="block font-bold">{formatNumber(s.playerCount)}</span>
                      <span className="block text-sm text-ink-3">{t.list.players(s.playerCount)}</span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-ink-3" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<Activity className="size-8" aria-hidden />}
              title={t.list.emptyTitle}
              description={canEdit ? t.list.emptyPhysio : t.list.emptyCoach}
              action={canEdit ? <LinkButton href="/import?tip=fizic" icon={<Upload className="size-5" aria-hidden />}>{t.importKsport}</LinkButton> : undefined}
            />
          )}
        </section>
      </div>
    </>
  );
}
