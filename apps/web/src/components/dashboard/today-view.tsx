import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, CircleAlert, Info, TriangleAlert } from "lucide-react";
import { formatDateShort, relativeDay, type AppContext } from "@club/shared";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/misc";
import { Badge, StatusChip } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import { getT } from "@/messages";
import { SEVERITIES, type PhysioDay, type Severity } from "./queries";

const ALERT_PREVIEW = 8;
const LIST_PREVIEW = 6;

const SEVERITY_TONE: Record<Severity, "red" | "orange" | "gray"> = { critical: "red", warning: "orange", info: "gray" };
const SEVERITY_ICON: Record<Severity, typeof Info> = { critical: CircleAlert, warning: TriangleAlert, info: Info };

function Tile({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="block rounded-[var(--radius-card)] hover:brightness-[0.98] [&>div]:h-full">{children}</Link>;
}

function Row({ href, children, label: aria }: { href: string; children: ReactNode; label?: string }) {
  return (
    <li className="border-t border-line first:border-t-0">
      <Link href={href} aria-label={aria} className="flex min-h-12 items-center gap-3 px-4 py-2 hover:bg-canvas">
        <span className="min-w-0 flex-1">{children}</span>
        <ChevronRight className="size-5 shrink-0 text-ink-3" aria-hidden />
      </Link>
    </li>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 pb-4 pt-2 text-ink-3">{children}</p>;
}

/** Ce are de făcut preparatorul azi: alerte, chestionare lipsă, reveniri, vize, aderență, verificări. */
export function TodayView({ day, ctx, showAllAlerts }: { day: PhysioDay; ctx: AppContext; showAllAlerts: boolean }) {
  const t = getT().dashboard;
  const today = ctx.today;

  const critical = day.alerts.filter((a) => a.severity === "critical").length;
  const wellnessTotal = day.wellness.reduce((s, g) => s + g.total, 0);
  const wellnessDone = day.wellness.reduce((s, g) => s + g.done, 0);
  const review = day.reviewPlayers + day.reviewWellness;
  const shownAlerts = showAllAlerts ? day.alerts : day.alerts.slice(0, ALERT_PREVIEW);

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile href="#alerte">
          <Stat
            label={t.today.tiles.alerts} value={day.alerts.length}
            tone={critical > 0 ? "red" : day.alerts.length > 0 ? "orange" : undefined}
            hint={critical > 0 ? t.today.tiles.alertsCritical(critical) : day.alerts.length ? undefined : t.today.tiles.alertsNone}
          />
        </Tile>
        <Tile href="#chestionare">
          <Stat
            label={t.today.tiles.wellness}
            value={<>{wellnessDone}<span className="text-lg font-semibold text-ink-3"> / {wellnessTotal}</span></>}
            hint={wellnessTotal ? t.today.tiles.wellnessMissing(wellnessTotal - wellnessDone) : undefined}
          />
        </Tile>
        <Tile href={review > 0 ? "#verificare" : "/disponibilitate"}>
          <Stat
            label={t.today.tiles.review} value={review} tone={review > 0 ? "orange" : undefined}
            hint={review > 0 ? t.today.tiles.reviewHint : t.today.tiles.reviewNone}
          />
        </Tile>
        <Tile href="/administrare/gdpr">
          <Stat
            label={t.today.tiles.gdpr} value={day.gdprOpen} tone={day.gdprOpen > 0 ? "orange" : undefined}
            hint={day.gdprOpen > 0 ? t.today.tiles.gdprHint : t.today.tiles.gdprNone}
          />
        </Tile>
      </div>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
          <div className="contents lg:grid lg:content-start lg:gap-4">
            {/* Alertele zilei */}
            <Card id="alerte" className="order-1 scroll-mt-20 lg:order-none">
              <CardHeader title={t.alerts.title} description={t.alerts.description} />
              {day.alerts.length === 0 ? <Empty>{t.alerts.empty}</Empty> : (
                <div className="pb-2 pt-3">
                  {SEVERITIES.map((sev) => {
                    const all = day.alerts.filter((a) => a.severity === sev);
                    const items = shownAlerts.filter((a) => a.severity === sev);
                    if (!items.length) return null;
                    const Icon = SEVERITY_ICON[sev];
                    return (
                      <section key={sev} className="mb-2 last:mb-0">
                        <h3 className="flex items-center gap-2 px-4 py-1.5 text-sm">
                          <Badge tone={SEVERITY_TONE[sev]}><Icon className="size-3.5" aria-hidden />{t.alerts.severity[sev]}</Badge>
                          <span className="font-normal text-ink-3">{t.alerts.count(all.length)}</span>
                        </h3>
                        <ul>
                          {items.map((a) => (
                            <Row key={a.id} href={`/lot/jucatori/${a.playerId}/stare`}>
                              <span className="flex items-baseline justify-between gap-3">
                                <span className="truncate font-bold">{a.playerName}</span>
                                <span className="shrink-0 text-sm text-ink-3">{relativeDay(a.date, today)}</span>
                              </span>
                              <span className="block text-sm text-ink-2">
                                {a.message}
                              </span>
                            </Row>
                          ))}
                        </ul>
                      </section>
                    );
                  })}
                  {day.alerts.length > ALERT_PREVIEW ? (
                    <div className="px-4 pb-2 pt-1">
                      <LinkButton href={showAllAlerts ? "/tablou#alerte" : "/tablou?alerte=toate#alerte"} scroll={false} className="w-full">
                        {showAllAlerts ? t.alerts.showLess : t.alerts.showAll(day.alerts.length)}
                      </LinkButton>
                    </div>
                  ) : null}
                </div>
              )}
            </Card>

            {/* Aderența la programe */}
            <Card className="order-5 lg:order-none">
              <CardHeader title={t.adherence.title} description={t.adherence.description} />
              {day.adherence.length === 0 ? (
                <CardBody className="pt-2">
                  <p className="mb-3 text-ink-3">{t.adherence.empty}</p>
                  <LinkButton href="/programe">{t.adherence.emptyAction}</LinkButton>
                </CardBody>
              ) : (
                <ul className="pt-2">
                  {day.adherence.map((a) => {
                    const target =
                      a.targetType === "group" && a.groupName ? t.adherence.targetGroup(a.groupName)
                      : a.targetType === "player" ? t.adherence.targetPlayer
                      : a.targetType === "position" ? t.adherence.targetPosition
                      : t.adherence.targetManual;
                    return (
                      <Row key={a.assignmentId} href={`/programe/${a.programId}`}>
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="truncate font-bold">{a.programName}</span>
                          <strong className="shrink-0 text-lg leading-none">{a.percent === null ? "—" : `${a.percent}%`}</strong>
                        </span>
                        <span className="block text-sm text-ink-3">
                          {target} · {t.adherence.players(a.players)} · {a.percent === null ? t.adherence.notScheduled : (
                            <span className={a.under50 > 0 ? "font-semibold text-ink" : undefined}>{t.adherence.under(a.under50)}</span>
                          )}
                        </span>
                        {a.percent !== null ? <ProgressBar className="mt-1.5" value={a.percent} max={100} label={t.adherence.progress(a.programName)} /> : null}
                      </Row>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
          <div className="contents lg:grid lg:content-start lg:gap-4">
            {/* Chestionare lipsă azi */}
            <Card id="chestionare" className="order-2 scroll-mt-20 lg:order-none">
              <CardHeader title={t.wellness.title} description={t.wellness.description} />
              {day.wellness.length === 0 ? <Empty>{t.wellness.empty}</Empty> : (
                <ul className="pt-2">
                  {day.wellness.map((g) => (
                    <Row key={g.id} href={`/wellness?grupa=${g.id}`} label={t.wellness.open(g.name)}>
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate font-bold">{g.name}</span>
                        <span className="shrink-0 text-sm text-ink-2">
                          <strong className="text-base text-ink">{t.wellness.done(g.done, g.total)}</strong>
                          <span className="text-ink-3"> · {t.wellness.missing(g.total - g.done)}</span>
                        </span>
                      </span>
                      <ProgressBar className="mt-1.5" value={g.done} max={g.total} label={t.wellness.progress(g.name)} />
                    </Row>
                  ))}
                </ul>
              )}
            </Card>

            {/* Reveniri apropiate */}
            <Card className="order-3 lg:order-none">
              <CardHeader title={t.returns.title} description={t.returns.description} />
              {day.returns.length === 0 ? <Empty>{t.returns.empty}</Empty> : (
                <ul className="pt-2">
                  {day.returns.slice(0, LIST_PREVIEW).map((r) => (
                    <Row key={r.id} href={`/lot/jucatori/${r.id}/stare`}>
                      <span className="flex items-center justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate font-bold">{r.name}</span>
                          <span className="block text-sm text-ink-3">{r.groupName ?? "—"}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2 text-right">
                          <span className={cn("text-sm", r.daysLeft < 0 ? "font-bold text-ink" : "text-ink-2")}>
                            {formatDateShort(r.returnOn, false)} · {r.daysLeft < 0 ? `${t.returns.overdue}, ${relativeDay(r.returnOn, today)}` : relativeDay(r.returnOn, today)}
                          </span>
                          <StatusChip status={r.status} size="sm" />
                        </span>
                      </span>
                    </Row>
                  ))}
                  {day.returns.length > LIST_PREVIEW ? (
                    <li className="border-t border-line px-4 py-3 text-sm text-ink-3">
                      <Link href="/disponibilitate?grupa=toate&filtru=nu-apti" className="font-semibold text-ink underline underline-offset-4">
                        {t.returns.more(day.returns.length - LIST_PREVIEW)}
                      </Link>
                    </li>
                  ) : null}
                </ul>
              )}
            </Card>

            {/* Vize medicale */}
            <Card className="order-4 lg:order-none">
              <CardHeader title={t.visas.title} description={t.visas.description(ctx.settings.alerts.visa_days_before)} />
              {day.visas.length === 0 ? <Empty>{t.visas.empty}</Empty> : (
                <ul className="pt-2">
                  {day.visas.slice(0, LIST_PREVIEW).map((v) => (
                    <Row key={v.id} href={`/lot/jucatori/${v.id}/stare`}>
                      <span className="flex items-center justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate font-bold">{v.name}</span>
                          <span className="block text-sm text-ink-3">{v.groupName ?? "—"}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2 text-sm text-ink-2">
                          {formatDateShort(v.expiresOn)}
                          {v.daysLeft < 0
                            ? <Badge tone="red"><CircleAlert className="size-3.5" aria-hidden />{t.visas.expired}</Badge>
                            : <Badge tone="orange">{relativeDay(v.expiresOn, today)}</Badge>}
                        </span>
                      </span>
                    </Row>
                  ))}
                  {day.visas.length > LIST_PREVIEW ? (
                    <li className="border-t border-line px-4 py-3 text-sm text-ink-3">
                      {t.visas.more(day.visas.length - LIST_PREVIEW)} ·{" "}
                      <Link href="/lot/vize" className="font-semibold text-ink underline underline-offset-4">{t.visas.all}</Link>
                    </li>
                  ) : null}
                </ul>
              )}
            </Card>
          </div>

        {/* De verificat */}
        {review > 0 ? (
          <Card id="verificare" className="order-6 scroll-mt-20 lg:order-none lg:col-span-2">
            <CardHeader title={t.review.title} description={t.review.description} />
            <ul className="pt-2">
              {day.reviewPlayers > 0 ? (
                <Row href="/disponibilitate?grupa=toate&filtru=verificare" label={t.review.openPlayers}>
                  <span className="font-semibold">{t.review.players(day.reviewPlayers)}</span>
                </Row>
              ) : null}
              {day.reviewWellness > 0 ? (
                <Row href="/wellness" label={t.review.openWellness}>
                  <span className="font-semibold">{t.review.wellness(day.reviewWellness)}</span>
                </Row>
              ) : null}
            </ul>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
