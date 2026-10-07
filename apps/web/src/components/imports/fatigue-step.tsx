"use client";
import { useMemo, useState } from "react";
import {
  METRIC_LABELS, WEEKDAYS_RO, WEEKDAYS_SHORT_RO, addDays, describeZone, formatDateShort, parseFatigueGrid, weekStart,
  type ImportMeta, type Sheet, type WellnessMetric,
} from "@club/shared";
import { Notice } from "@/components/ui/card";
import { Checkbox, Field, Input, Select } from "@/components/ui/form";
import { TableWrap } from "@/components/ui/misc";
import { Badge, ReviewBadge } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import { useT } from "@/messages";
import { FlagNote, Problems, Section, StepNav } from "./parts";
import { prepareFatigue } from "./prepare";
import { columnLetter, sampleValues } from "./read-file";
import type { ImportContext, Prepared } from "./types";

type Choice = { metric: WellnessMetric | null; day: number | null };
const METRICS: WellnessMetric[] = ["fatigue", "muscle_load", "pain"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const GRID = "md:grid-cols-[3rem_minmax(0,1.2fr)_minmax(0,1fr)_14rem_10rem]";

/** Pasul 2 pentru grila săptămânală: grupa, săptămâna și confirmarea coloanelor (metrică + zi). */
export function FatigueStep({ sheet, meta, context, onBack, onNext }: {
  sheet: Sheet; meta: ImportMeta; context: ImportContext; onBack: () => void; onNext: (prepared: Prepared) => void;
}) {
  const t = useT().imports;
  const f = t.fatigue;
  const [groupId, setGroupId] = useState(context.groups[0]?.id ?? "");
  const [weekInput, setWeekInput] = useState(addDays(weekStart(context.today), -7));
  const [choices, setChoices] = useState<Record<number, Choice>>({});
  const [confirmed, setConfirmed] = useState(false);

  const grid = useMemo(() => parseFatigueGrid(sheet), [sheet]);
  const columns = useMemo(
    () => grid.columns
      .filter((c) => c.hasData || c.metric)
      .map((c) => (choices[c.index] ? { ...c, ...choices[c.index], inferred: false } : c)),
    [grid, choices],
  );
  const week = ISO_DATE.test(weekInput) ? weekStart(weekInput) : null;
  const inferred = columns.filter((c) => c.inferred && c.metric && c.hasData).length;

  const prepared = useMemo(
    () => (week && groupId ? prepareFatigue({ grid, columns, weekStart: week, groupId, meta }) : null),
    [grid, columns, week, groupId, meta],
  );

  const mapped = columns.filter((c) => c.metric && c.day !== null && c.hasData);
  const days = [...new Set(mapped.map((c) => c.day as number))].sort((a, b) => a - b);
  const duplicates = mapped.filter((c, i) => mapped.findIndex((o) => o.metric === c.metric && o.day === c.day) !== i);
  const halfMapped = columns.filter((c) => c.hasData && ((c.metric && c.day === null) || (!c.metric && c.day !== null)));

  const problems: string[] = [];
  if (!grid.rows.length) problems.push(f.noRows);
  else if (!mapped.length) problems.push(f.noColumns);
  else if (prepared && !prepared.entries.length) problems.push(f.noEntries);
  if (!context.groups.length) problems.push(f.noGroups);
  if (!week) problems.push(f.noWeek);
  for (const c of duplicates) problems.push(f.duplicate(METRIC_LABELS[c.metric as WellnessMetric], WEEKDAYS_RO[c.day as number]));
  for (const c of halfMapped) problems.push(f.halfMapped(columnLetter(c.index)));

  const needsConfirm = inferred > 0 && !confirmed;
  const set = (index: number, patch: Partial<Choice>) => {
    const current = columns.find((c) => c.index === index);
    setChoices({ ...choices, [index]: { metric: current?.metric ?? null, day: current?.day ?? null, ...patch } });
  };

  const byRow = new Map<number, Map<number, NonNullable<typeof prepared>["entries"][number]>>();
  for (const e of prepared?.entries ?? []) {
    if (!byRow.has(e.row)) byRow.set(e.row, new Map());
    byRow.get(e.row)!.set(e.day, e);
  }
  const hasMetric = (m: WellnessMetric) => mapped.some((c) => c.metric === m);
  const shownMetrics = METRICS.filter(hasMetric);

  return (
    <div>
      <Section title={f.targetTitle} description={f.targetDescription}>
        <div className="grid gap-3 md:grid-cols-[16rem_14rem_1fr]">
          <Field label={f.group}>
            <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              {context.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </Field>
          <Field label={f.week} hint={week ? f.weekRange(formatDateShort(week, false), formatDateShort(addDays(week, 6))) : undefined}>
            <Input type="date" value={weekInput} max={context.today} onChange={(e) => setWeekInput(e.target.value)} aria-invalid={!week} />
          </Field>
        </div>
      </Section>

      {grid.rows.length ? (
        <Section title={f.columnsTitle} description={f.columnsDescription}>
          {!grid.columns.some((c) => c.metric) ? <Notice tone="yellow" title={f.noSectionsTitle} className="mb-3">{f.noSectionsBody}</Notice>
            : !grid.columns.some((c) => c.metric === "fatigue" || c.metric === "muscle_load") ? <Notice tone="yellow" title={f.wrongFileTitle} className="mb-3">{f.wrongFileBody}</Notice>
            : null}
          <div className="rounded-[var(--radius-card)] border border-line bg-surface">
            <div className={cn("hidden gap-3 border-b border-line bg-canvas px-3 py-2 text-sm font-semibold text-ink-3 md:grid", GRID)}>
              <span>{t.common.column}</span><span>{t.common.header}</span><span>{t.common.samples}</span><span>{f.metric}</span><span>{f.day}</span>
            </div>
            <ul>
              {columns.filter((c) => c.hasData).map((c) => (
                <li
                  key={c.index}
                  className={cn(
                    "grid grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-3 gap-y-1 border-t border-line px-3 py-2 first:border-t-0",
                    GRID, c.inferred && !confirmed && "bg-st-yellow-soft",
                  )}
                >
                  <span className="font-semibold text-ink-3">{columnLetter(c.index)}</span>
                  <span className="col-span-2 min-w-0 md:col-span-1">
                    <span className="font-semibold">{c.header || <span className="font-normal text-ink-3">{t.common.noHeader}</span>}</span>
                    {c.inferred ? <Badge tone="yellow" className="ml-2">{f.inferred}</Badge> : null}
                  </span>
                  <span className="col-span-2 col-start-2 min-w-0 truncate text-sm text-ink-2 md:col-span-1 md:col-start-auto">{sampleValues(grid.rows, c.index).join(" · ")}</span>
                  <Select
                    className="col-span-2 col-start-1 !h-10 md:col-span-1 md:col-start-auto" aria-label={f.metricFor(columnLetter(c.index))} value={c.metric ?? ""}
                    onChange={(e) => set(c.index, { metric: (e.target.value || null) as WellnessMetric | null })}
                  >
                    <option value="">{t.common.ignore}</option>
                    {METRICS.map((m) => <option key={m} value={m}>{METRIC_LABELS[m]}</option>)}
                  </Select>
                  <Select
                    className="!h-10" aria-label={f.dayFor(columnLetter(c.index))} value={c.day ?? ""}
                    onChange={(e) => set(c.index, { day: e.target.value === "" ? null : Number(e.target.value) })}
                  >
                    <option value="">—</option>
                    {WEEKDAYS_RO.map((d, i) => <option key={d} value={i}>{d}</option>)}
                  </Select>
                </li>
              ))}
            </ul>
          </div>
          {inferred > 0 ? (
            <div className="mt-3 rounded-[var(--radius-control)] border-l-4 border-st-yellow bg-st-yellow-soft px-4 py-1">
              <Checkbox
                checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)}
                label={f.confirmInferred(inferred)} description={f.confirmInferredHint}
              />
            </div>
          ) : null}
        </Section>
      ) : null}

      {prepared && days.length ? (
        <Section title={f.previewTitle(prepared.entries.length)} description={f.previewDescription}>
          <TableWrap className="max-h-[70vh] overflow-y-auto">
            <thead className="sticky top-0 z-10">
              <tr>
                <th scope="col" rowSpan={2} className="w-10">{t.common.row}</th>
                <th scope="col" rowSpan={2}>{f.player}</th>
                {days.map((d) => (
                  <th key={d} scope="colgroup" colSpan={shownMetrics.length} className="border-l border-line text-center">
                    <span className="md:hidden">{WEEKDAYS_SHORT_RO[d]}</span>
                    <span className="hidden md:inline">{WEEKDAYS_RO[d]}</span>
                    {week ? <span className="ml-1 font-normal">{formatDateShort(addDays(week, d), false)}</span> : null}
                  </th>
                ))}
                <th scope="col" rowSpan={2}>{t.common.review}</th>
              </tr>
              <tr>
                {days.flatMap((d) => shownMetrics.map((m, i) => (
                  <th key={`${d}-${m}`} scope="col" className={cn("font-normal", i === 0 && "border-l border-line", m !== "pain" && "text-center")}>
                    {f.metricShort[m]}
                  </th>
                )))}
              </tr>
            </thead>
            <tbody className="text-sm">
              {grid.rows.map((r) => {
                const entries = byRow.get(r.row);
                const flagged = [...(entries?.values() ?? [])].filter((e) => e.flagged);
                return (
                  <tr key={r.row} className={entries ? undefined : "text-ink-3"}>
                    <td className="text-ink-3">{r.row}</td>
                    <td className="font-semibold whitespace-nowrap">{r.name}</td>
                    {entries ? days.flatMap((d) => shownMetrics.map((m, i) => {
                      const e = entries.get(d);
                      const first = i === 0 ? "border-l border-line" : "";
                      if (m === "pain") {
                        const zone = e ? describeZone({ zone: e.pain_zone, side: e.pain_side }) : "";
                        return (
                          <td key={`${d}-${m}`} className={first}>
                            {zone || (e?.pain_note ? <span className="text-ink-3">{e.pain_note}</span> : "")}
                          </td>
                        );
                      }
                      const value = e ? (m === "fatigue" ? e.fatigue : e.muscle_load) : null;
                      const raw = e?.raw[m];
                      return (
                        <td key={`${d}-${m}`} className={cn("text-center font-semibold", first)}>
                          {value ?? (raw ? "?" : "")}
                          {raw && String(value) !== raw ? <span className="ml-1 font-normal text-ink-3">({raw})</span> : null}
                        </td>
                      );
                    })) : (
                      <td colSpan={days.length * shownMetrics.length} className="border-l border-line">{f.rowWithoutData}</td>
                    )}
                    <td className="min-w-44">
                      {flagged.length ? (
                        <div className="space-y-1">
                          <ReviewBadge />
                          {flagged.flatMap((e) => e.reasons.map((reason) => (
                            <div key={`${e.day}-${reason}`}><FlagNote>{WEEKDAYS_SHORT_RO[e.day]}: {reason}</FlagNote></div>
                          )))}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        </Section>
      ) : null}

      <Problems items={problems} />
      <StepNav
        back={t.nav.back} onBack={onBack} next={t.nav.toMatching}
        onNext={() => prepared && onNext(prepared)}
        disabled={problems.length > 0 || needsConfirm || !prepared}
        hint={needsConfirm && !problems.length ? f.confirmFirst : undefined}
      />
    </div>
  );
}
