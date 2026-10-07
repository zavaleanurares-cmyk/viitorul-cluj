import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import {
  WEEKDAYS_SHORT_RO, addDays, average, dateRange, formatDateShort, isoWeekday, listWellness,
  type Db, type Player,
} from "@club/shared";
import { BarsChart, TrendChart } from "@/components/charts";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { getT } from "@/messages";
import { getPlayerAdherence, getPlayerTests, listRpe, type TestRow } from "./queries";

const nf = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 2 });

/** „Evoluția mea": chestionar pe 7 / 28 de zile, încărcare sRPE, aderență pe 4 săptămâni, teste fizice. */
export async function Evolution({ db, player, today, days, hrefFor }: {
  db: Db; player: Player; today: string; days: 7 | 28; hrefFor: (days: 7 | 28) => string;
}) {
  const t = getT().player.evolution;
  const from = addDays(today, -(days - 1));
  const from28 = addDays(today, -27);
  const [wellness, rpe, adh, tests] = await Promise.all([
    listWellness(db, [player.id], from, today),
    listRpe(db, player.id, from28, today),
    getPlayerAdherence(db, player.id, from28, today, t.adherencePlans),
    getPlayerTests(db, player.id, player.group_id),
  ]);

  const byDate = new Map(wellness.map((w) => [w.entry_date, w]));
  const range = dateRange(from, today);
  const xLabel = (d: string) => (days === 7 ? `${WEEKDAYS_SHORT_RO[isoWeekday(d) - 1]} ${Number(d.slice(8))}` : formatDateShort(d, false));
  const trend = range.map((d) => ({ x: xLabel(d), fatigue: byDate.get(d)?.fatigue ?? null, muscle: byDate.get(d)?.muscle_load ?? null }));

  const loadByDate = new Map<string, number>();
  for (const r of rpe) loadByDate.set(r.entry_date, (loadByDate.get(r.entry_date) ?? 0) + (r.load ?? r.rpe * r.duration_min));
  // 7 zile: o bară pe zi. 28 de zile: o bară pe săptămână (28 de bare nu se pot citi pe telefon).
  const loads = days === 7
    ? range.map((d) => ({ x: xLabel(d), value: loadByDate.get(d) ?? 0 }))
    : [3, 2, 1, 0].map((w) => {
        const end = addDays(today, -7 * w);
        const start = addDays(end, -6);
        return {
          x: t.weekFrom(formatDateShort(start, false)),
          value: dateRange(start, end).reduce((s, d) => s + (loadByDate.get(d) ?? 0), 0),
        };
      });

  const filled = wellness.filter((w) => w.fatigue !== null).length;

  return (
    <div className="space-y-4">
      <nav aria-label={t.period} className="flex gap-2">
        {([7, 28] as const).map((d) => (
          <Link
            key={d}
            href={hrefFor(d)}
            scroll={false}
            aria-current={d === days ? "true" : undefined}
            className={cn(
              "inline-flex h-12 flex-1 items-center justify-center rounded-[var(--radius-control)] border px-3 font-semibold",
              d === days ? "border-brand bg-brand text-brand-ink" : "border-line-strong bg-surface text-ink hover:bg-canvas",
            )}
          >
            {t.days(d)}
          </Link>
        ))}
      </nav>

      <dl className="grid grid-cols-3 gap-2">
        {[
          { label: t.avgFatigue, value: fmt(average(wellness.map((w) => w.fatigue))) },
          { label: t.avgMuscle, value: fmt(average(wellness.map((w) => w.muscle_load))) },
          { label: t.filled, value: `${filled}/${days}` },
        ].map((s) => (
          <div key={s.label} className="flex min-w-0 flex-col-reverse justify-end rounded-[var(--radius-card)] border border-line bg-surface p-3">
            <dt className="mt-1 text-sm leading-tight text-ink-3">{s.label}</dt>
            <dd className="text-2xl font-bold leading-none">{s.value}</dd>
          </div>
        ))}
      </dl>

      <Card>
        <CardHeader title={t.wellnessTitle} description={t.wellnessHint} />
        {/* `relative overflow-hidden`: tabelul pentru cititoare de ecran din grafic (sr-only) nu trebuie să lățească pagina */}
        <CardBody className="relative overflow-hidden">
          <TrendChart
            data={trend}
            series={[{ key: "fatigue", label: t.fatigue }, { key: "muscle", label: t.muscleLoad }]}
            caption={t.wellnessCaption(days)}
            domain={[1, 10]}
            connectNulls
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t.loadTitle} description={days === 7 ? t.loadHintDaily : t.loadHintWeekly} />
        <CardBody className="relative overflow-hidden">
          <BarsChart data={loads} label={t.loadLabel} caption={t.loadCaption(days)} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t.adherenceTitle} description={t.adherenceHint} />
        <CardBody className="space-y-4">
          {adh.percent === null ? (
            <p className="text-ink-3">{t.adherenceEmpty}</p>
          ) : (
            <>
              <div>
                <p className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="text-3xl font-bold leading-none">{adh.percent}%</span>
                  <span className="text-ink-3">{t.adherenceCount(adh.done, adh.expected)}</span>
                </p>
                <ProgressBar value={adh.done} max={adh.expected} label={t.adherenceTitle} />
              </div>
              {adh.rows.length > 1 ? (
                <ul className="space-y-3">
                  {adh.rows.map((r) => (
                    <li key={r.key}>
                      <p className="mb-1 flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate font-semibold">{r.name}</span>
                        <span className="shrink-0 text-ink-3">{r.done}/{r.expected}</span>
                      </p>
                      <ProgressBar value={r.done} max={r.expected} label={r.name} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t.testsTitle} description={t.testsHint} />
        <CardBody>
          {tests.length ? (
            <ul className="divide-y divide-line">
              {tests.map((r) => <TestItem key={r.test_id} row={r} />)}
            </ul>
          ) : (
            <p className="text-ink-3">{t.testsEmpty}</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function fmt(v: number | null): string {
  return v === null ? "—" : nf.format(v);
}

function TestItem({ row }: { row: TestRow }) {
  const t = getT().player.evolution;
  const diff = row.groupAverage === null ? null : Math.round((row.value - row.groupAverage) * 100) / 100;
  const better = diff === null || diff === 0 ? null : row.lower_is_better ? diff < 0 : diff > 0;
  const Icon = better === null ? Minus : better ? ArrowUpRight : ArrowDownRight;
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 font-semibold">{row.name}</p>
        <p className="shrink-0 text-xl font-bold">
          {nf.format(row.value)} <span className="text-base font-normal text-ink-3">{row.unit}</span>
        </p>
      </div>
      <p className="text-sm text-ink-3">
        {formatDateShort(row.tested_on)}
        {row.previous !== null ? ` · ${t.testPrevious(nf.format(row.previous), row.unit)}` : ""}
      </p>
      {diff === null ? (
        <p className="mt-1 text-sm text-ink-3">{t.testNoAverage}</p>
      ) : (
        <p className="mt-1 flex items-start gap-1.5 text-ink-2">
          <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
          <span>
            {t.testAverage(nf.format(row.groupAverage!), row.unit)}
            {" — "}
            <span className="font-semibold">
              {better === null ? t.testEqual : better ? t.testBetter(nf.format(Math.abs(diff)), row.unit) : t.testWorse(nf.format(Math.abs(diff)), row.unit)}
            </span>
          </span>
        </p>
      )}
    </li>
  );
}
