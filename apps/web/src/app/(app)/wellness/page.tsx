import Link from "next/link";
import { ClipboardList, TriangleAlert, Users } from "lucide-react";
import {
  WEEKDAYS_SHORT_RO, addDays, average, can, dateRange, formatDate, formatDateShort, isoWeekday, listPlayers, listWellness,
  weekDates, weekStart, type WellnessEntry,
} from "@club/shared";
import { requireCapability, visibleGroups } from "@/lib/auth";
import { BarsChart, TrendChart } from "@/components/charts";
import { Card, CardBody, CardHeader, EmptyState, PageHeader, Stat } from "@/components/ui/card";
import { PrevNext, TabLinks } from "@/components/ui/misc";
import { Badge } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import { getT } from "@/messages";
import { PrintButton } from "@/components/players/print-button";
import { AlertsList } from "@/components/wellness/alerts-list";
import { DayList } from "@/components/wellness/day-list";
import { fmt1, isFilled, isIsoDate, percent, rawValues, weekLabel } from "@/components/wellness/domain";
import { EntryButton } from "@/components/wellness/entry-button";
import { IntervalNav } from "@/components/wellness/interval-nav";
import { PrintGrid } from "@/components/wellness/print-grid";
import { listOpenAlerts, listRpeFor } from "@/components/wellness/queries";
import { RpeTable } from "@/components/wellness/rpe-table";
import { WeekGrid } from "@/components/wellness/week-grid";

const PRINT_CSS =
  "@media print{@page{size:A4 landscape;margin:10mm}div:has(>aside.no-print){display:block!important}main{max-width:none!important;padding:0!important}}";

type Search = { grupa?: string; saptamana?: string; zi?: string; interval?: string; alerte?: string };

/** Chestionarele grupei: grila săptămânii (sau lista unei zile), cine nu a completat, alerte, grafice, RPE. */
export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const { db, ctx } = await requireCapability("viewWellnessGrid");
  const sp = await searchParams;
  const t = getT().wellness;
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
  const today = ctx.today;
  const day = isIsoDate(sp.zi) ? sp.zi : null;
  const explicitWeek = !day && isIsoDate(sp.saptamana) ? weekStart(sp.saptamana) : null;
  /** „auto": grila pe ecran lat, ziua de azi pe telefon */
  const view = day ? "day" : explicitWeek ? "week" : "auto";
  const shownDay = day ?? today;
  const monday = explicitWeek ?? weekStart(shownDay);
  const dates = weekDates(monday);
  const sunday = dates[6];
  const interval = sp.interval === "28" ? 28 : 7;
  const allAlerts = sp.alerte === "club";
  const thresholds = { fatigue: ctx.settings.alerts.fatigue_threshold, muscle: ctx.settings.alerts.muscle_load_threshold };

  // preparatorul: alertele zilnice (chestionar lipsă, viză care expiră) se recalculează la deschidere
  if (canEdit) await db.rpc("refresh_daily_alerts", {});

  const players = await listPlayers(db, { groupId: group.id });
  const ids = players.map((p) => p.id);
  const chartEnd = sunday < today ? sunday : today;
  const chartFrom = addDays(chartEnd, -(interval - 1));
  const [week, chart, todayRows, rpe, alerts] = await Promise.all([
    listWellness(db, ids, monday, sunday),
    listWellness(db, ids, chartFrom, chartEnd),
    today >= monday && today <= sunday ? Promise.resolve(null) : listWellness(db, ids, today, today),
    listRpeFor(db, ids, monday, sunday),
    canEdit ? listOpenAlerts(db) : Promise.resolve([]),
  ]);
  const todayEntries = todayRows ?? week.filter((e) => e.entry_date === today);

  const roster = players.map((p) => ({ id: p.id, name: p.display_name, hasAccount: !!p.user_id }));
  const filledToday = new Set(todayEntries.filter(isFilled).map((e) => e.player_id));
  const missing = roster.filter((p) => !filledToday.has(p.id));
  const elapsed = dates.filter((d) => d <= today).length;
  const weekFilled = week.filter((e) => isFilled(e) && e.entry_date <= today).length;
  const weekRate = percent(weekFilled, roster.length * elapsed);
  const avgFatigue = average(week.map((e) => e.fatigue));
  const avgMuscle = average(week.map((e) => e.muscle_load));
  const review = week.filter((e) => e.needs_review);
  const nameOf = new Map(roster.map((p) => [p.id, p.name]));

  const href = (patch: Partial<Record<keyof Search, string | null>>) => {
    const next: Record<string, string | undefined> = {
      grupa: group.id === groups[0].id ? undefined : group.id,
      saptamana: explicitWeek ?? undefined,
      zi: day ?? undefined,
      interval: interval === 28 ? "28" : undefined,
      alerte: allAlerts ? "club" : undefined,
    };
    for (const [k, v] of Object.entries(patch)) next[k] = v ?? undefined;
    const q = new URLSearchParams(Object.entries(next).filter((e): e is [string, string] => !!e[1]));
    const s = q.toString();
    return s ? `/wellness?${s}` : "/wellness";
  };

  const groupTabs = groups.map((g) => ({ key: g.id, href: href({ grupa: g.id === groups[0].id ? null : g.id }), label: g.name }));

  // grafice pe grupă
  const xLabel = (d: string) => (interval === 7 ? `${WEEKDAYS_SHORT_RO[isoWeekday(d) - 1]} ${Number(d.slice(8))}` : formatDateShort(d, false));
  const byDate = new Map<string, WellnessEntry[]>();
  for (const e of chart) byDate.set(e.entry_date, [...(byDate.get(e.entry_date) ?? []), e]);
  const range = dateRange(chartFrom, chartEnd);
  const trend = range.map((d) => ({
    x: xLabel(d),
    fatigue: average((byDate.get(d) ?? []).map((e) => e.fatigue)),
    muscle: average((byDate.get(d) ?? []).map((e) => e.muscle_load)),
  }));
  const filledOn = (d: string) => (byDate.get(d) ?? []).filter(isFilled).length;
  // 7 zile: o bară pe zi; 28 de zile: o bară pe săptămână (28 de bare nu se pot citi pe telefon)
  const completion = interval === 7
    ? range.map((d) => ({ x: xLabel(d), value: percent(filledOn(d), roster.length) ?? 0 }))
    : [3, 2, 1, 0].map((w) => {
        const end = addDays(chartEnd, -7 * w);
        const start = addDays(end, -6);
        const filled = dateRange(start, end).reduce((s, d) => s + filledOn(d), 0);
        return { x: t.charts.weekFrom(formatDateShort(start, false)), value: percent(filled, roster.length * 7) ?? 0 };
      });

  const shownAlerts = alerts.filter((a) => allAlerts || a.players.group_id === group.id);
  const alertItems = shownAlerts.map((a) => ({
    id: a.id, kind: a.kind, severity: a.severity, date: a.alert_date, message: a.message,
    player: { id: a.players.id, name: a.players.display_name },
  }));

  const toggle = (active: "yes" | "no" | "desktop" | "mobile") =>
    cn(
      "inline-flex h-12 flex-1 items-center justify-center rounded-[var(--radius-control)] border px-4 font-semibold md:flex-none",
      active === "yes" && "border-ink bg-ink text-white",
      active === "no" && "border-line-strong bg-surface text-ink hover:bg-canvas",
      active === "desktop" && "border-line-strong bg-surface text-ink md:border-ink md:bg-ink md:text-white",
      active === "mobile" && "border-ink bg-ink text-white md:border-line-strong md:bg-surface md:text-ink",
    );

  return (
    <>
      <style>{PRINT_CSS}</style>
      <div className="print:hidden">
        <PageHeader
          title={t.title}
          description={t.description(group.name)}
          action={<PrintButton label={t.printWeek} />}
        />
        {groups.length > 1 ? <TabLinks tabs={groupTabs} current={group.id} className="mb-3" /> : null}

        {!roster.length ? (
          <EmptyState
            icon={<Users className="size-8" aria-hidden />}
            title={t.emptyGroupTitle}
            description={canEdit ? t.emptyGroupPhysio : t.emptyGroupCoach}
          />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Stat
                label={t.stats.missingToday}
                value={`${missing.length}/${roster.length}`}
                tone={missing.length ? "orange" : "green"}
                hint={missing.length ? t.stats.missingHint : t.stats.missingNone}
              />
              <Stat label={t.stats.weekRate} value={weekRate === null ? "—" : `${weekRate}%`} hint={t.stats.weekRateHint(weekFilled, roster.length * elapsed)} />
              <Stat label={t.stats.avgFatigue} value={fmt1(avgFatigue)} hint={t.stats.weekOf(weekLabel(monday))} />
              <Stat label={t.stats.avgMuscle} value={fmt1(avgMuscle)} hint={t.stats.weekOf(weekLabel(monday))} />
            </div>

            {missing.length ? (
              <details
                // pe telefon, lista zilei de azi arată deja cine nu a completat
                className={cn("rounded-[var(--radius-card)] border border-line bg-surface", (view === "auto" || day === today) && "max-md:hidden")}
                open={missing.length <= 8}
              >
                <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 py-2 font-semibold">
                  {t.missing.title(missing.length, formatDate(today, { weekday: true, year: false }))}
                </summary>
                <ul className="flex flex-wrap gap-2 border-t border-line p-4">
                  {missing.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/jucatori/${p.id}/wellness`}
                        className="inline-flex h-10 items-center gap-2 rounded-full border border-line-strong bg-surface px-3 font-semibold hover:bg-canvas"
                      >
                        {p.name}
                        {!p.hasAccount ? <Badge tone="outline">{t.missing.noAccount}</Badge> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="px-4 pb-4 text-sm text-ink-3">{canEdit ? t.missing.hintPhysio : t.missing.hintCoach}</p>
              </details>
            ) : null}

            <section aria-label={t.grid.caption} className="space-y-3">
              <nav aria-label={t.view.label} className="flex gap-2">
                <Link href={href({ zi: null, saptamana: monday })} aria-current={view === "week" ? "true" : undefined}
                  className={toggle(view === "week" ? "yes" : view === "auto" ? "desktop" : "no")}>
                  {t.view.week}
                </Link>
                <Link href={href({ saptamana: null, zi: shownDay })} aria-current={view === "day" ? "true" : undefined}
                  className={toggle(view === "day" ? "yes" : view === "auto" ? "mobile" : "no")}>
                  {t.view.day}
                </Link>
              </nav>

              {view !== "day" ? (
                <div className={cn("space-y-3", view === "auto" && "max-md:hidden")}>
                  <PrevNext
                    prevHref={href({ zi: null, saptamana: addDays(monday, -7) })}
                    nextHref={href({ zi: null, saptamana: addDays(monday, 7) })}
                    todayHref={href({ zi: null, saptamana: null })}
                    label={weekLabel(monday)}
                  />
                  <WeekGrid players={roster} dates={dates} entries={week} today={today} thresholds={thresholds} canEdit={canEdit} />
                  <p className="text-sm text-ink-3">
                    {t.grid.legend(thresholds.fatigue, thresholds.muscle)} {canEdit ? t.grid.editHint : t.grid.readOnlyHint}
                  </p>
                </div>
              ) : null}

              {view !== "week" ? (
                <div className={cn("space-y-3", view === "auto" && "md:hidden")}>
                  <PrevNext
                    prevHref={href({ saptamana: null, zi: addDays(shownDay, -1) })}
                    nextHref={href({ saptamana: null, zi: addDays(shownDay, 1) })}
                    todayHref={href({ zi: null, saptamana: null })}
                    label={formatDate(shownDay, { weekday: true, year: false })}
                  />
                  <DayList players={roster} entries={week} date={shownDay} today={today} thresholds={thresholds} canEdit={canEdit} />
                  <p className="text-sm text-ink-3">{t.day.legend(thresholds.fatigue, thresholds.muscle)}</p>
                </div>
              ) : null}
            </section>

            {review.length ? (
              <Card className="border-st-orange">
                <CardHeader
                  title={<span className="inline-flex items-center gap-2"><TriangleAlert className="size-5" aria-hidden />{t.review.title(review.length)}</span>}
                  description={canEdit ? t.review.hintPhysio : t.review.hintCoach}
                />
                <ul className="mt-3 divide-y divide-line border-t border-line">
                  {review.map((e) => {
                    const raw = rawValues(e.raw);
                    const player = { id: e.player_id, name: nameOf.get(e.player_id) ?? "—" };
                    return (
                      <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                        <div className="min-w-0 flex-1 basis-56">
                          <p>
                            <Link href={`/jucatori/${e.player_id}/wellness`} className="font-semibold underline underline-offset-4">{player.name}</Link>
                            <span className="text-ink-3"> · {formatDate(e.entry_date, { weekday: true, year: false })}</span>
                          </p>
                          {e.review_note ? <p className="text-ink-2">{e.review_note}</p> : null}
                          {raw ? (
                            <p className="text-sm text-ink-2">
                              {t.review.original}{" "}
                              {[
                                raw.fatigue ? `${t.review.fatigue} „${raw.fatigue}”` : null,
                                raw.muscle ? `${t.review.muscle} „${raw.muscle}”` : null,
                                raw.pain ? `${t.review.zone} „${raw.pain}”` : null,
                              ].filter(Boolean).join(", ")}
                            </p>
                          ) : null}
                        </div>
                        {canEdit ? <EntryButton player={player} date={e.entry_date} entry={e} today={today} label={t.review.fix} /> : null}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ) : null}

            {canEdit ? (
              <Card>
                <CardHeader
                  title={t.alerts.title(alertItems.length)}
                  description={allAlerts ? t.alerts.scopeClub : t.alerts.scopeGroup(group.name)}
                  action={
                    groups.length > 1 ? (
                      <Link href={href({ alerte: allAlerts ? null : "club" })} scroll={false} className="inline-flex h-10 items-center font-semibold underline underline-offset-4">
                        {allAlerts ? t.alerts.showGroup : t.alerts.showClub(alerts.length)}
                      </Link>
                    ) : undefined
                  }
                />
                {alertItems.length ? (
                  <div className="mt-3 border-t border-line"><AlertsList alerts={alertItems} today={today} /></div>
                ) : (
                  <CardBody><p className="text-ink-3">{t.alerts.empty}</p></CardBody>
                )}
              </Card>
            ) : null}

            <section className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="text-xl">{t.charts.title}</h2>
                <IntervalNav
                  label={t.charts.interval}
                  current={String(interval)}
                  options={[
                    { value: "7", label: t.charts.days(7), href: href({ interval: null }) },
                    { value: "28", label: t.charts.days(28), href: href({ interval: "28" }) },
                  ]}
                  className="w-full md:w-auto"
                />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader title={t.charts.trendTitle} description={t.charts.trendHint(formatDateShort(chartFrom, false), formatDateShort(chartEnd))} />
                  <CardBody className="relative overflow-hidden">
                    <TrendChart
                      data={trend}
                      series={[{ key: "fatigue", label: t.charts.fatigue }, { key: "muscle", label: t.charts.muscle }]}
                      caption={t.charts.trendCaption(group.name, interval)}
                      domain={[1, 10]}
                      threshold={{ value: thresholds.fatigue, label: t.charts.threshold(thresholds.fatigue) }}
                      connectNulls
                    />
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader title={t.charts.completionTitle} description={interval === 7 ? t.charts.completionHintDaily : t.charts.completionHintWeekly} />
                  <CardBody className="relative overflow-hidden">
                    <BarsChart data={completion} label={t.charts.completionLabel} caption={t.charts.completionCaption(group.name, interval)} />
                  </CardBody>
                </Card>
              </div>
            </section>

            <section className="space-y-3">
              <div>
                <h2 className="text-xl">{t.rpe.title}</h2>
                <p className="text-sm text-ink-3">{t.rpe.hint(weekLabel(monday))}</p>
              </div>
              {rpe.length ? (
                <RpeTable players={roster} dates={dates} rpe={rpe} />
              ) : (
                <EmptyState icon={<ClipboardList className="size-8" aria-hidden />} title={t.rpe.emptyTitle} description={t.rpe.empty} />
              )}
            </section>
          </div>
        )}
      </div>

      {/* tipărire: doar antetul și grila săptămânii */}
      <div className="hidden print:block">
        <p className="mb-2 text-[12pt] font-bold">
          {ctx.club.name} — {group.name} · {t.print.title(weekLabel(monday))}
        </p>
        <PrintGrid players={roster} dates={dates} entries={week} thresholds={thresholds} />
        <p className="mt-2 text-[9pt]">{t.print.legend(thresholds.fatigue, thresholds.muscle)}</p>
      </div>
    </>
  );
}
