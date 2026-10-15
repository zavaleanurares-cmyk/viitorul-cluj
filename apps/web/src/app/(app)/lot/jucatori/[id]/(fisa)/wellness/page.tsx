import { notFound, redirect } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import {
  SESSION_TYPES, WEEKDAYS_SHORT_RO, acuteChronicRatio, addDays, average, can, dateRange, formatDateShort, isoWeekday, label,
  listWellness, zoneLabel,
} from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { BarsChart, TrendChart } from "@/components/charts";
import { BodyMap, type BodyHighlight } from "@/components/ui/body-map";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { TableWrap } from "@/components/ui/misc";
import { ScoreCell } from "@/components/ui/scale";
import { Badge, ReviewBadge } from "@/components/ui/status";
import { getT } from "@/messages";
import { getPlayerForRequest } from "@/components/players/queries";
import { AlertsList } from "@/components/wellness/alerts-list";
import { fmt1, hasPain, importedPainText, isFilled, painFull, percent } from "@/components/wellness/domain";
import { EntryButton } from "@/components/wellness/entry-button";
import { IntervalNav } from "@/components/wellness/interval-nav";
import { listPlayerAlerts, listRpeFor } from "@/components/wellness/queries";

const INTERVALS = [7, 28, 90] as const;
const nf = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 });

/** Fila „Chestionare" din fișa jucătorului: evoluție, zone dureroase, RPE și încărcare, alerte. */
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ interval?: string }> }) {
  const { id } = await params;
  const { db, ctx } = await requireCapability("viewPlayerList");
  // directorul sportiv are doar fișa sumară
  if (!can(ctx.role, "viewWellnessGrid")) redirect(`/lot/jucatori/${id}/stare`);
  const player = await getPlayerForRequest(id);
  if (!player) notFound();
  await db.rpc("log_medical_access", { p_player: id, p_section: "wellness" });

  const sp = await searchParams;
  const t = getT().wellness;
  const p = t.player;
  const canEdit = can(ctx.role, "manage");
  const today = ctx.today;
  const days = INTERVALS.find((d) => String(d) === sp.interval) ?? 28;
  const from = addDays(today, -(days - 1));
  const rpeFrom = days < 28 ? addDays(today, -27) : from;
  const thresholds = { fatigue: ctx.settings.alerts.fatigue_threshold, muscle: ctx.settings.alerts.muscle_load_threshold };

  const [entries, rpeAll, alerts] = await Promise.all([
    listWellness(db, [id], from, today),
    listRpeFor(db, [id], rpeFrom, today),
    canEdit ? listPlayerAlerts(db, id) : Promise.resolve([]),
  ]);
  const who = { id, name: player.display_name };
  const byDate = new Map(entries.map((e) => [e.entry_date, e]));
  const range = dateRange(from, today);
  const xLabel = (d: string) => (days === 7 ? `${WEEKDAYS_SHORT_RO[isoWeekday(d) - 1]} ${Number(d.slice(8))}` : formatDateShort(d, false));

  const filled = entries.filter(isFilled).length;
  const painDays = entries.filter(hasPain);
  const hasIntensity = painDays.some((e) => e.pain_intensity !== null);
  const trend = range.map((d) => {
    const e = byDate.get(d);
    return { x: xLabel(d), fatigue: e?.fatigue ?? null, muscle: e?.muscle_load ?? null, pain: e && hasPain(e) ? e.pain_intensity : null };
  });
  const sameThreshold = thresholds.fatigue === thresholds.muscle;

  // zone dureroase raportate în interval
  const zoneCount = new Map<string, { zone: string; side: string | null; days: number; last: string }>();
  for (const e of painDays) {
    if (!e.pain_zone) continue;
    const key = `${e.pain_zone}:${e.pain_side ?? ""}`;
    const z = zoneCount.get(key) ?? { zone: e.pain_zone, side: e.pain_side, days: 0, last: e.entry_date };
    z.days++;
    if (e.entry_date > z.last) z.last = e.entry_date;
    zoneCount.set(key, z);
  }
  const zones = [...zoneCount.values()].sort((a, b) => b.days - a.days || b.last.localeCompare(a.last));
  const highlights: BodyHighlight[] = zones.map((z) => ({
    zone: z.zone, side: z.side, tone: "red", label: `${zoneLabel(z.zone, z.side)} — ${p.zoneDays(z.days)}`,
  }));
  const painNoZone = painDays.filter((e) => !e.pain_zone).length;

  // RPE și încărcare
  const rpe = rpeAll.filter((r) => r.entry_date >= from);
  const loadByDate: Record<string, number> = {};
  for (const r of rpeAll) loadByDate[r.entry_date] = (loadByDate[r.entry_date] ?? 0) + (r.load ?? r.rpe * r.duration_min);
  const acwr = acuteChronicRatio(loadByDate, today);
  const weeks = Math.ceil(days / 7);
  const loads = days === 7
    ? range.map((d) => ({ x: xLabel(d), value: loadByDate[d] ?? 0 }))
    : Array.from({ length: weeks }, (_, i) => weeks - 1 - i).map((w) => {
        const end = addDays(today, -7 * w);
        const start = addDays(end, -6) < from ? from : addDays(end, -6);
        return { x: p.weekFrom(formatDateShort(start, false)), value: dateRange(start, end).reduce((s, d) => s + (loadByDate[d] ?? 0), 0) };
      });
  const rpeRows = [...rpe].sort((a, b) => b.entry_date.localeCompare(a.entry_date));

  const sorted = [...entries].sort((a, b) => b.entry_date.localeCompare(a.entry_date));
  const showSleep = entries.some((e) => e.sleep_quality !== null || e.sleep_hours !== null);
  const showStress = entries.some((e) => e.stress !== null);
  const showMood = entries.some((e) => e.mood !== null);
  const sourceLabel = (s: string) => p.sources[s as keyof typeof p.sources] ?? s;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <IntervalNav
          label={p.interval}
          current={String(days)}
          options={INTERVALS.map((d) => ({ value: String(d), label: p.days(d), href: d === 28 ? `/lot/jucatori/${id}/wellness` : `/lot/jucatori/${id}/wellness?interval=${d}` }))}
          className="w-full md:w-auto"
        />
        {canEdit ? (
          <EntryButton
            variant="primary"
            player={who}
            date={today}
            entry={null}
            entries={entries}
            pickDate
            today={today}
            label={p.add}
            icon={<Plus className="size-5" aria-hidden />}
            className="w-full md:w-auto"
          />
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat label={p.avgFatigue} value={fmt1(average(entries.map((e) => e.fatigue)))} hint={p.threshold(thresholds.fatigue)} />
        <Stat label={p.avgMuscle} value={fmt1(average(entries.map((e) => e.muscle_load)))} hint={p.threshold(thresholds.muscle)} />
        <Stat label={p.completion} value={`${percent(filled, days) ?? 0}%`} hint={p.completionHint(filled, days)} />
        <Stat label={p.painDays} value={painDays.length} tone={painDays.length ? "orange" : undefined} hint={p.painDaysHint(days)} />
      </div>

      <Card>
        <CardHeader title={p.chartTitle} description={p.chartHint} />
        <CardBody className="relative overflow-hidden">
          <TrendChart
            data={trend}
            series={[
              { key: "fatigue", label: p.fatigue },
              { key: "muscle", label: p.muscleLoad },
              ...(hasIntensity ? [{ key: "pain", label: p.painIntensity }] : []),
            ]}
            caption={p.chartCaption(player.display_name, days)}
            domain={[1, 10]}
            threshold={{ value: thresholds.fatigue, label: sameThreshold ? p.thresholdLine(thresholds.fatigue) : p.thresholdLineFatigue(thresholds.fatigue) }}
            connectNulls
          />
          {painDays.length ? (
            <div className="mt-3">
              <p className="mb-1.5 text-sm font-semibold text-ink-2">{p.painDaysList}</p>
              <ul className="flex flex-wrap gap-1.5">
                {[...painDays].sort((a, b) => b.entry_date.localeCompare(a.entry_date)).map((e) => (
                  <li key={e.id}>
                    <Badge tone="orange">
                      {formatDateShort(e.entry_date, false)} · {painFull(e) || importedPainText(e)}
                      {e.pain_intensity ? ` ${e.pain_intensity}/10` : ""}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <Card>
          <CardHeader title={p.mapTitle} description={p.mapHint(days)} />
          <CardBody>
            <BodyMap highlights={highlights} />
            {zones.length ? (
              <ul className="mt-3 space-y-1">
                {zones.map((z) => (
                  <li key={`${z.zone}:${z.side}`} className="flex items-baseline justify-between gap-3">
                    <span className="font-semibold">{zoneLabel(z.zone, z.side)}</span>
                    <span className="shrink-0 text-sm text-ink-3">{p.zoneDays(z.days)} · {p.lastOn(formatDateShort(z.last, false))}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-center text-sm text-ink-3">{p.mapEmpty}</p>
            )}
            {painNoZone ? <p className="mt-2 text-sm text-ink-3">{p.painNoZone(painNoZone)}</p> : null}
          </CardBody>
        </Card>

        <Card className="min-w-0">
          <CardHeader title={p.tableTitle} description={p.tableHint(filled, days)} />
          {sorted.length ? (
            <div className="mt-3 max-h-[34rem] overflow-y-auto border-t border-line">
              <TableWrap className="mx-0! md:rounded-none! md:border-0!">
                <thead>
                  <tr>
                    <th scope="col" className="sticky top-0 z-10">{p.colDate}</th>
                    <th scope="col" className="sticky top-0 z-10 px-1! text-center" title={p.fatigue}>{t.grid.fatigueAbbr}</th>
                    <th scope="col" className="sticky top-0 z-10 px-1! text-center" title={p.muscleLoad}>{t.grid.muscleAbbr}</th>
                    <th scope="col" className="sticky top-0 z-10">{p.colPain}</th>
                    {showSleep ? <th scope="col" className="sticky top-0 z-10">{p.colSleep}</th> : null}
                    {showStress ? <th scope="col" className="sticky top-0 z-10">{p.colStress}</th> : null}
                    {showMood ? <th scope="col" className="sticky top-0 z-10">{p.colMood}</th> : null}
                    <th scope="col" className="sticky top-0 z-10">{p.colSource}</th>
                    {canEdit ? <th scope="col" className="sticky top-0 z-10" aria-label={p.colActions} /> : null}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((e) => {
                    const imported = importedPainText(e);
                    return (
                      <tr key={e.id} className={e.needs_review ? "bg-st-orange-soft" : undefined}>
                        <th scope="row" className="border-t border-line text-base! font-semibold! whitespace-nowrap text-ink!">
                          {WEEKDAYS_SHORT_RO[isoWeekday(e.entry_date) - 1]} {formatDateShort(e.entry_date, false)}
                        </th>
                        <td className="px-1! text-center"><ScoreCell value={e.fatigue} threshold={thresholds.fatigue} /></td>
                        <td className="px-1! text-center"><ScoreCell value={e.muscle_load} threshold={thresholds.muscle} /></td>
                        <td className="min-w-40">
                          {hasPain(e) ? (
                            <>
                              <span className="font-semibold">{painFull(e)}</span>
                              {e.pain_intensity ? <span className="whitespace-nowrap"> · {e.pain_intensity}/10</span> : null}
                              {e.pain_zone && e.pain_note ? <span className="block text-sm text-ink-2">{imported && imported === e.pain_note ? p.importedText(e.pain_note) : e.pain_note}</span> : null}
                            </>
                          ) : <span className="text-ink-3">—</span>}
                          {e.needs_review ? <span className="mt-1 block"><ReviewBadge note={e.review_note} />{e.review_note ? <span className="mt-0.5 block text-sm text-ink-2">{e.review_note}</span> : null}</span> : null}
                        </td>
                        {showSleep ? (
                          <td className="whitespace-nowrap">
                            {[e.sleep_quality !== null ? `${e.sleep_quality}/10` : null, e.sleep_hours !== null ? p.hours(nf.format(Number(e.sleep_hours))) : null].filter(Boolean).join(" · ") || "—"}
                          </td>
                        ) : null}
                        {showStress ? <td>{e.stress ?? "—"}</td> : null}
                        {showMood ? <td>{e.mood ?? "—"}</td> : null}
                        <td className="text-sm text-ink-2">{sourceLabel(e.source)}</td>
                        {canEdit ? (
                          <td className="p-0! text-right">
                            <EntryButton iconOnly player={who} date={e.entry_date} entry={e} today={today} label={p.edit(formatDateShort(e.entry_date))} icon={<Pencil className="size-5" aria-hidden />} />
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </TableWrap>
            </div>
          ) : (
            <CardBody><p className="text-ink-3">{player.user_id ? p.tableEmpty : p.tableEmptyNoAccount}</p></CardBody>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title={p.rpeTitle} description={days === 7 ? p.rpeHintDaily : p.rpeHintWeekly} />
        <CardBody className="space-y-4">
          <div className="relative overflow-hidden">
            <BarsChart data={loads} label={p.rpeLabel} caption={p.rpeCaption(player.display_name, days)} horizontal={days === 90} />
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Stat label={p.acute} value={nf.format(acwr.acute)} hint={p.acuteHint} />
            <Stat label={p.chronic} value={nf.format(acwr.chronic)} hint={p.chronicHint} />
            {acwr.ratio !== null ? <Stat label={p.ratio} value={nf.format(acwr.ratio)} hint={p.ratioShort} /> : null}
          </div>
          <p className="text-sm text-ink-3">{acwr.ratio !== null ? p.ratioExplain : p.ratioMissing}</p>
          {rpeRows.length ? (
            <details>
              <summary className="flex h-12 cursor-pointer items-center font-semibold text-ink-2">{p.rpeRows(rpeRows.length)}</summary>
              <TableWrap>
                <thead>
                  <tr>
                    <th scope="col">{p.colDate}</th>
                    <th scope="col">{p.colType}</th>
                    <th scope="col" className="text-right">{p.colRpe}</th>
                    <th scope="col" className="text-right">{p.colMinutes}</th>
                    <th scope="col" className="text-right">{p.colLoad}</th>
                  </tr>
                </thead>
                <tbody>
                  {rpeRows.map((r) => (
                    <tr key={r.id}>
                      <th scope="row" className="border-t border-line text-base! font-semibold! whitespace-nowrap text-ink!">{formatDateShort(r.entry_date, false)}</th>
                      <td>{label(SESSION_TYPES, r.session_type)}</td>
                      <td className="text-right">{r.rpe}</td>
                      <td className="text-right">{r.duration_min}</td>
                      <td className="text-right font-bold">{nf.format(r.load ?? r.rpe * r.duration_min)}</td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </details>
          ) : (
            <p className="text-ink-3">{p.rpeEmpty}</p>
          )}
        </CardBody>
      </Card>

      {canEdit ? (
        <Card>
          <CardHeader title={t.alerts.title(alerts.length)} description={p.alertsHint} />
          {alerts.length ? (
            <div className="mt-3 border-t border-line">
              <AlertsList today={today} alerts={alerts.map((a) => ({ id: a.id, kind: a.kind, severity: a.severity, date: a.alert_date, message: a.message }))} />
            </div>
          ) : (
            <CardBody><p className="text-ink-3">{p.alertsEmpty}</p></CardBody>
          )}
        </Card>
      ) : null}

    </div>
  );
}
