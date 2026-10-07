import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SESSION_TYPES, WEEKDAYS_SHORT_RO, addDays, can, formatDateShort, isoWeekday, label } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { Sparkline, TrendChart } from "@/components/charts";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { TableWrap } from "@/components/ui/misc";
import { Badge } from "@/components/ui/status";
import { getT } from "@/messages";
import { getPlayerForRequest } from "@/components/players/queries";
import { Delta } from "@/components/physical/delta";
import { METRIC_DECIMALS, METRIC_KEYS, compare, formatNumber, formatValue, mean } from "@/components/physical/domain";
import { groupAverages, listPlayerSessions, listResults, listTests } from "@/components/physical/queries";
import { AddResultButton, DeleteResultButton } from "@/components/physical/result-buttons";
import { IntervalNav } from "@/components/wellness/interval-nav";

const WEEKS = [4, 8, 16] as const;

/** Fila „Date fizice" din fișa jucătorului: sesiunile lui, evoluția indicatorilor principali, testele fizice. */
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saptamani?: string }> }) {
  const { id } = await params;
  const { db, ctx } = await requireCapability("viewPlayerList");
  // directorul sportiv are doar fișa sumară
  if (!can(ctx.role, "viewPhysicalData")) redirect(`/jucatori/${id}`);
  const player = await getPlayerForRequest(id);
  if (!player) notFound();
  await db.rpc("log_medical_access", { p_player: id, p_section: "fizic" });

  const sp = await searchParams;
  const t = getT().physical;
  const p = t.player;
  const canEdit = can(ctx.role, "manage");
  const today = ctx.today;
  const weeks = WEEKS.find((w) => String(w) === sp.saptamani) ?? 8;
  const from = addDays(today, -(weeks * 7 - 1));

  const [sessions, allTests, results, averages] = await Promise.all([
    listPlayerSessions(db, id, from, today),
    listTests(db, { includeInactive: true }),
    listResults(db, [id]),
    groupAverages(db, player.group_id),
  ]);

  const chrono = [...sessions].reverse();
  const point = (key: "total_distance_m" | "hsr_distance_m" | "max_speed_kmh") =>
    chrono.map((s) => ({ x: formatDateShort(s.session.session_date, false), value: s.values[key] }));
  const columns = METRIC_KEYS.filter((k) => sessions.some((s) => s.values[k] !== null));
  const avgDistance = mean(sessions.map((s) => s.values.total_distance_m));
  const speeds = sessions.map((s) => s.values.max_speed_kmh).filter((v): v is number => v !== null);
  const topSpeed = speeds.length ? Math.max(...speeds) : null;
  const topSpeedOn = topSpeed === null ? null : sessions.find((s) => s.values.max_speed_kmh === topSpeed)?.session.session_date ?? null;

  const tests = allTests
    .map((test) => ({ test, results: results.filter((r) => r.test_id === test.id) }))
    .filter((x) => x.results.length);
  const activeTests = allTests.filter((x) => x.is_active);
  const group = ctx.groups.find((g) => g.id === player.group_id);

  return (
    <div className="space-y-4">
      <IntervalNav
        label={p.interval}
        current={String(weeks)}
        options={WEEKS.map((w) => ({ value: String(w), label: p.weeks(w), href: w === 8 ? `/jucatori/${id}/fizic` : `/jucatori/${id}/fizic?saptamani=${w}` }))}
        className="w-full md:w-auto"
      />

      <dl className="grid grid-cols-3 gap-2">
        {[
          { label: p.sessions, value: String(sessions.length), hint: p.inWeeks(weeks) },
          { label: p.avgDistance, value: avgDistance === null ? "—" : formatNumber(avgDistance), hint: p.perSession },
          { label: p.topSpeed, value: topSpeed === null ? "—" : formatNumber(topSpeed, 1), hint: topSpeedOn ? formatDateShort(topSpeedOn) : "" },
        ].map((s) => (
          <div key={s.label} className="flex min-w-0 flex-col rounded-[var(--radius-card)] border border-line bg-surface p-3">
            <dt className="text-sm leading-tight text-ink-3">{s.label}</dt>
            <dd className="mt-1 text-2xl font-bold leading-none">{s.value}</dd>
            <dd className="mt-1.5 text-sm leading-tight text-ink-3">{s.hint}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-4 lg:grid-cols-3">
        {([
          { key: "total_distance_m", title: p.chartTotal, unit: "m" },
          { key: "hsr_distance_m", title: p.chartHsr, unit: "m" },
          { key: "max_speed_kmh", title: p.chartSpeed, unit: "km/h" },
        ] as const).map((c) => (
          <Card key={c.key}>
            <CardHeader title={c.title} description={p.chartHint(c.unit)} />
            <CardBody className="relative overflow-hidden">
              <TrendChart data={point(c.key)} series={[{ key: "value", label: `${c.title} (${c.unit})` }]} caption={p.chartCaption(c.title, player.display_name)} height={180} connectNulls />
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title={p.sessionsTitle} description={p.sessionsHint(sessions.length, weeks)} />
        {sessions.length ? (
          <div className="mt-3 max-h-[34rem] overflow-y-auto border-t border-line">
            <TableWrap className="mx-0! md:rounded-none! md:border-0!">
              <thead>
                <tr>
                  <th scope="col">{p.colDate}</th>
                  <th scope="col">{p.colSession}</th>
                  {columns.map((k) => (
                    <th key={k} scope="col" className="px-2! text-right whitespace-nowrap" title={`${t.metrics[k].label} (${t.metrics[k].unit})`}>{t.metrics[k].short}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.session.id}>
                    <th scope="row" className="border-t border-line text-base! font-semibold! whitespace-nowrap text-ink!">
                      {WEEKDAYS_SHORT_RO[isoWeekday(s.session.session_date) - 1]} {formatDateShort(s.session.session_date, false)}
                    </th>
                    <td className="min-w-40">
                      <Link href={`/fizic/sesiuni/${s.session.id}`} className="font-semibold underline underline-offset-4">
                        {s.session.name || label(SESSION_TYPES, s.session.session_type)}
                      </Link>{" "}
                      {s.session.session_type === "match" ? <Badge tone="blue">{label(SESSION_TYPES, s.session.session_type)}</Badge> : null}
                    </td>
                    {columns.map((k) => (
                      <td key={k} className="px-2! text-right whitespace-nowrap">
                        {s.values[k] === null ? <span className="text-ink-3">·</span> : formatNumber(s.values[k], METRIC_DECIMALS[k])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </div>
        ) : (
          <CardBody><p className="text-ink-3">{p.sessionsEmpty}</p></CardBody>
        )}
      </Card>

      <Card>
        <CardHeader
          title={p.testsTitle}
          description={group ? p.testsHint(group.name) : p.testsHintNoGroup}
          action={canEdit ? <AddResultButton player={{ id, name: player.display_name }} tests={activeTests.map((x) => ({ id: x.id, name: x.name, unit: x.unit }))} today={today} /> : undefined}
        />
        <CardBody>
          {tests.length ? (
            <ul className="divide-y divide-line">
              {tests.map(({ test, results: rs }) => {
                const last = rs[0];
                const previous = rs[1] ?? null;
                const avg = averages.get(test.id) ?? null;
                return (
                  <li key={test.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <div className="min-w-0 flex-1 basis-40">
                        <p className="font-semibold">
                          {test.name} {!test.is_active ? <Badge tone="outline">{p.testInactive}</Badge> : null}
                        </p>
                        <p className="text-sm text-ink-3">{formatDateShort(last.tested_on)} · {test.lower_is_better ? t.tests.lowerBetter : t.tests.higherBetter}</p>
                      </div>
                      <Sparkline values={[...rs].reverse().map((r) => r.value)} label={p.sparkline(test.name, rs.length)} />
                      <p className="shrink-0 text-2xl font-bold">
                        {formatValue(last.value)} <span className="text-base font-normal text-ink-3">{test.unit}</span>
                      </p>
                    </div>
                    <dl className="mt-1 grid gap-x-6 gap-y-0.5 text-sm sm:grid-cols-2">
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="text-ink-3">{p.vsPrevious}</dt>
                        <dd>
                          {previous ? (
                            <>
                              <Delta cmp={compare(last.value, previous.value, test.lower_is_better)} unit={test.unit} />{" "}
                              <span className="text-ink-3">({formatValue(previous.value)} {test.unit}, {formatDateShort(previous.tested_on)})</span>
                            </>
                          ) : <span className="text-ink-3">{p.firstResult}</span>}
                        </dd>
                      </div>
                      <div className="flex flex-wrap gap-x-2">
                        <dt className="text-ink-3">{p.vsAverage}</dt>
                        <dd>
                          {avg ? (
                            <>
                              <Delta cmp={compare(last.value, avg.average, test.lower_is_better)} unit={test.unit} />{" "}
                              <span className="text-ink-3">({p.averageIs(formatValue(avg.average), test.unit, avg.players)})</span>
                            </>
                          ) : <span className="text-ink-3">{p.averageMissing}</span>}
                        </dd>
                      </div>
                    </dl>
                    {rs.length > 1 || canEdit ? (
                      <details className="mt-1">
                        <summary className="inline-flex h-10 cursor-pointer items-center text-sm font-semibold text-ink-2">{p.history(rs.length)}</summary>
                        <ul className="mb-1 divide-y divide-line rounded-lg border border-line">
                          {rs.map((r) => (
                            <li key={r.id} className="flex min-h-10 items-center gap-3 px-3">
                              <span className="w-24 shrink-0 text-ink-2">{formatDateShort(r.tested_on)}</span>
                              <span className="font-semibold whitespace-nowrap">{formatValue(r.value)} {test.unit}</span>
                              <span className="min-w-0 flex-1 truncate text-sm text-ink-3">{r.notes}</span>
                              {canEdit ? (
                                <DeleteResultButton
                                  id={r.id}
                                  label={p.deleteResult(test.name, formatDateShort(r.tested_on))}
                                  text={p.deleteResultText(test.name, formatValue(r.value), test.unit, formatDateShort(r.tested_on))}
                                />
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-ink-3">{canEdit ? p.testsEmptyPhysio : p.testsEmpty}</p>
          )}
        </CardBody>
      </Card>

      <p className="text-sm text-ink-3">
        {p.anthropometry}{" "}
        <Link href={`/jucatori/${id}`} className="font-semibold text-ink underline underline-offset-4">{p.anthropometryLink}</Link>.
      </p>
    </div>
  );
}
