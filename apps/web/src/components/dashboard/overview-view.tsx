import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatDate, formatDateShort, MONTHS_RO, zoneLabel } from "@club/shared";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { BarsChart } from "@/components/charts";
import { AvailabilityTrend } from "./trend-chart";
import { getT } from "@/messages";
import { AvailabilityBar, AvailabilityLegend } from "./availability-bar";
import { percent, seasonMonths, type Overview } from "./overview";

/**
 * Cifrele de ansamblu ale clubului. Primește DOAR rezultatul RPC-ului `club_overview()`:
 * nu există aici niciun nume de jucător și niciun diagnostic.
 */
export function OverviewView({ overview, groupLinks }: { overview: Overview; groupLinks: boolean }) {
  const t = getT().dashboard;
  const o = t.overview;
  const { totals } = overview;
  const share = percent(totals.available, totals.players);

  const barTitles = { full: o.full.toLowerCase(), limited: o.limited.toLowerCase(), out: o.out.toLowerCase() };

  const trend = overview.trend.filter((w) => w.total > 0);
  const first = trend[0];
  const last = trend[trend.length - 1];
  const delta = first && last ? percent(last.available, last.total) - percent(first.available, first.total) : 0;

  const zones = overview.injuries_by_zone.map((z) => ({
    x: z.zone === "unknown" ? t.zones.unknown : zoneLabel(z.zone, null, true),
    value: z.count,
  }));
  const byMonth = new Map(overview.injuries_by_month.map((m) => [m.month, m.count]));
  const months = seasonMonths(overview.season_start, overview.today).map((m) => ({
    x: MONTHS_RO[Number(m.slice(5, 7)) - 1].slice(0, 3),
    value: byMonth.get(m) ?? 0,
  }));

  return (
    <div className="grid gap-4">
      {/* Cifra principală: câți jucători sunt disponibili azi */}
      <Card>
        <CardBody>
          <p className="text-sm text-ink-3">{o.availableShare}</p>
          {totals.players > 0 ? (
            <>
              <p className="mt-1 flex flex-wrap items-baseline gap-x-3">
                <span className="text-6xl font-bold leading-none [font-variant-numeric:normal] md:text-7xl">{share}%</span>
                <span className="text-lg text-ink-2">{o.availableOf(totals.available, totals.players)}</span>
              </p>
              <AvailabilityBar
                className="mt-4 h-5"
                titles={barTitles}
                counts={{ full: totals.available, limited: totals.limited, out: totals.out }}
                label={t.groups.barLabel(o.availableShare, totals.available, totals.limited, totals.out)}
              />
              <AvailabilityLegend
                className="mt-3 text-base"
                items={[
                  { key: "full", value: totals.available, label: o.full.toLowerCase(), extra: `${percent(totals.available, totals.players)}%` },
                  { key: "limited", value: totals.limited, label: o.limited.toLowerCase(), extra: `${percent(totals.limited, totals.players)}%` },
                  { key: "out", value: totals.out, label: o.out.toLowerCase(), extra: `${percent(totals.out, totals.players)}%` },
                ]}
              />
            </>
          ) : (
            <p className="mt-1 text-lg text-ink-2">{o.noPlayers}</p>
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={o.activeInjuries} value={totals.active_injuries} tone={totals.active_injuries > 0 ? "red" : undefined}
          hint={totals.active_injuries > 0 ? o.injuredNow(totals.active_injuries) : undefined}
        />
        <Stat label={o.injuriesSeason} value={totals.injuries_season} hint={o.seasonSince(formatDate(overview.season_start))} />
        <Stat
          label={o.recurrences} value={totals.recurrences_season}
          hint={totals.injuries_season > 0 ? o.recurrencesOf(totals.injuries_season) : undefined}
        />
        <Stat
          label={o.daysLost} value={totals.days_lost_season}
          hint={totals.injuries_season > 0 ? o.perInjury(Math.round(totals.days_lost_season / totals.injuries_season)) : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t.groups.title} description={t.groups.description} />
          <CardBody className="grid gap-5">
            {overview.groups.length === 0 ? <p className="text-ink-3">{t.groups.empty}</p> : null}
            {overview.groups.map((g) => {
              const head = (
                <span className="flex items-baseline justify-between gap-3">
                  <span className="inline-flex min-w-0 items-center gap-1 text-lg font-bold">
                    <span className="truncate">{g.name}</span>
                    {groupLinks ? <ChevronRight className="size-4 shrink-0 text-ink-3" aria-hidden /> : null}
                  </span>
                  <span className="shrink-0 text-sm text-ink-3">
                    {g.total > 0 ? `${t.groups.players(g.total)} · ${t.groups.available(percent(g.available, g.total))}` : t.groups.emptyGroup}
                  </span>
                </span>
              );
              return (
                <div key={g.id}>
                  {groupLinks ? (
                    <Link href={`/disponibilitate?grupa=${g.id}`} className="-my-1 block rounded-md py-1 hover:bg-canvas">{head}</Link>
                  ) : head}
                  <AvailabilityBar
                    className="mt-2"
                    titles={barTitles}
                    counts={{ full: g.available, limited: g.limited, out: g.out }}
                    label={t.groups.barLabel(g.name, g.available, g.limited, g.out)}
                  />
                  {g.total > 0 ? (
                    <AvailabilityLegend
                      className="mt-2"
                      items={[
                        { key: "full", value: g.available, label: g.available === 1 ? o.fullOne : o.fullMany },
                        { key: "limited", value: g.limited, label: o.limitedShort },
                        { key: "out", value: g.out, label: g.out === 1 ? o.outOne : o.outMany },
                      ]}
                    />
                  ) : null}
                  {g.active_injuries > 0 || g.days_lost > 0 ? (
                    <p className="mt-1 text-sm text-ink-3">
                      {[g.active_injuries > 0 ? t.groups.injuries(g.active_injuries) : null, g.days_lost > 0 ? t.groups.daysLost(g.days_lost) : null]
                        .filter(Boolean).join(" · ")}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t.trend.title} description={t.trend.description} />
          <CardBody>
            {trend.length >= 2 ? (
              <>
                <p className="mb-3 text-ink-2">
                  <strong className="font-bold text-ink">{t.trend.now(percent(last.available, last.total))}</strong>
                  {", "}{t.trend.change(delta, trend.length - 1)}
                </p>
                <AvailabilityTrend
                  caption={t.trend.caption}
                  labels={{ full: o.full, limited: o.limited, out: o.out }}
                  data={trend.map((w) => ({ x: formatDateShort(w.date, false), full: w.available, limited: w.limited, out: w.out }))}
                />
              </>
            ) : (
              <p className="rounded-lg bg-canvas px-4 py-8 text-center text-ink-3">{t.trend.notEnough}</p>
            )}
          </CardBody>
        </Card>

        {totals.injuries_season > 0 ? (
          <>
            <Card>
              <CardHeader title={t.zones.title} description={t.zones.description} />
              <CardBody>
                <BarsChart horizontal data={zones} label={t.zones.series} caption={t.zones.caption} height={120} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader title={t.months.title} description={t.months.description} />
              <CardBody>
                <BarsChart data={months} label={t.months.series} caption={t.months.caption} height={220} />
              </CardBody>
            </Card>
          </>
        ) : (
          <Card className="lg:col-span-2">
            <CardHeader title={t.zones.seasonTitle} description={o.seasonSince(formatDate(overview.season_start))} />
            <CardBody><p className="text-ink-2">{t.zones.empty}</p></CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
