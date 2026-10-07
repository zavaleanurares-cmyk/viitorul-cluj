"use client";
import { Fragment, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import {
  cell, describeZone, detectHealthColumns, norm, parseHealthSheet, suggestGroupForBlock,
  type HealthColumns, type ImportMeta, type Sheet,
} from "@club/shared";
import { Notice } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/form";
import { TableWrap } from "@/components/ui/misc";
import { ReviewBadge, StatusChip } from "@/components/ui/status";
import { useT } from "@/messages";
import { FilterTabs, FlagNote, Problems, Section, StepNav } from "./parts";
import { prepareHealth } from "./prepare";
import { columnLetter } from "./read-file";
import type { ImportContext, Prepared } from "./types";

const SKIP = "skip";

/** Pasul 2 pentru tabelul „STARE DE SANATATE": blocurile de grupe, coloanele și previzualizarea pe rânduri. */
export function HealthStep({ sheet, meta, context, onBack, onNext }: {
  sheet: Sheet; meta: ImportMeta; context: ImportContext; onBack: () => void; onNext: (prepared: Prepared) => void;
}) {
  const t = useT().imports;
  const h = t.health;
  const [columns, setColumns] = useState<Partial<HealthColumns>>({});
  const [blockChoice, setBlockChoice] = useState<Record<number, string>>({});
  const [show, setShow] = useState<"all" | "flagged">("all");

  const detected = useMemo(() => detectHealthColumns(sheet), [sheet]);
  const parsed = useMemo(() => parseHealthSheet(sheet, columns), [sheet, columns]);
  const hasHeader = useMemo(
    () => sheet.slice(0, 15).some((row) => (row ?? []).some((c) => /^STAREA? /.test(norm(c)) || norm(c) === "STARE")),
    [sheet],
  );
  const width = useMemo(() => Math.max(...sheet.map((r) => (r ?? []).length), 0), [sheet]);
  const columnOptions = useMemo(() => Array.from({ length: width }, (_, c) => {
    const sample = sheet.map((r) => cell((r ?? [])[c])).find(Boolean) ?? "";
    return { index: c, label: sample ? `${columnLetter(c)} — ${sample}` : columnLetter(c) };
  }), [sheet, width]);

  const blockGroupIds = parsed.blocks.map((b, i) => {
    const chosen = blockChoice[b.headerRow];
    if (chosen !== undefined) return chosen === SKIP ? null : chosen;
    return suggestGroupForBlock(b.label, context.groups, i)?.id ?? null;
  });
  const statusByCode = new Map(context.statuses.map((s) => [s.code, s]));
  const groupName = (id: string | null) => context.groups.find((g) => g.id === id)?.name ?? null;

  const all = parsed.blocks.flatMap((b) => b.rows);
  const unknown = all.filter((r) => r.status.flagged).length;
  const problems: string[] = [];
  if (!parsed.totalRows) problems.push(h.noRows);
  else if (!blockGroupIds.some(Boolean)) problems.push(h.noGroupChosen);
  const cols = { ...detected, ...columns };
  if (new Set([cols.name, cols.status, cols.zone]).size < 3) problems.push(h.sameColumn);

  const submit = () => onNext(prepareHealth({ parsed, blockGroupIds, groups: context.groups, meta }));

  return (
    <div>
      {!hasHeader ? <Notice tone="yellow" title={h.noHeaderTitle} className="mb-4">{h.noHeaderBody}</Notice> : null}
      {parsed.totalRows > 0 && unknown > parsed.totalRows / 2 ? (
        <Notice tone="yellow" title={h.wrongFileTitle} className="mb-4">{h.wrongFileBody(unknown, parsed.totalRows)}</Notice>
      ) : null}

      <Section title={h.columnsTitle} description={h.columnsDescription}>
        <div className="grid gap-3 md:grid-cols-3">
          {(["name", "status", "zone"] as const).map((key) => (
            <Field key={key} label={h.column[key]}>
              <Select value={cols[key]} onChange={(e) => setColumns({ ...columns, [key]: Number(e.target.value) })}>
                {columnOptions.map((o) => <option key={o.index} value={o.index}>{o.label}</option>)}
              </Select>
            </Field>
          ))}
        </div>
      </Section>

      {parsed.blocks.length ? (
        <Section title={h.blocksTitle(parsed.blocks.length)} description={h.blocksDescription}>
          <TableWrap>
            <thead>
              <tr>
                <th scope="col">{h.block}</th>
                <th scope="col" className="text-right">{h.blockPlayers}</th>
                <th scope="col" className="hidden text-right md:table-cell">{h.blockFlagged}</th>
                <th scope="col" className="w-36 md:w-72">{h.blockGroup}</th>
              </tr>
            </thead>
            <tbody>
              {parsed.blocks.map((b, i) => (
                <tr key={b.headerRow}>
                  <td>
                    <span className="font-semibold">{b.label || h.blockNoLabel}</span>
                    <span className="block text-sm text-ink-3">{b.headerRow ? h.blockRow(b.headerRow) : h.blockNoHeader}</span>
                  </td>
                  <td className="text-right font-semibold">{b.rows.length}</td>
                  <td className="hidden text-right md:table-cell">{b.rows.filter((r) => r.flagged).length || "—"}</td>
                  <td>
                    <Select
                      className="!h-10" aria-label={h.blockGroupFor(b.label || h.blockNoLabel)}
                      value={blockGroupIds[i] ?? SKIP}
                      onChange={(e) => setBlockChoice({ ...blockChoice, [b.headerRow]: e.target.value })}
                    >
                      {context.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                      <option value={SKIP}>{h.blockSkip}</option>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Section>
      ) : null}

      {parsed.totalRows ? (
        <Section
          title={h.previewTitle(parsed.totalRows)}
          description={h.previewDescription}
          action={parsed.flaggedRows ? (
            <FilterTabs
              label={h.filter} value={show} onChange={setShow}
              options={[{ value: "all", label: h.filterAll(parsed.totalRows) }, { value: "flagged", label: h.filterFlagged(parsed.flaggedRows) }]}
            />
          ) : null}
        >
          <TableWrap className="max-h-[70vh] overflow-y-auto">
            <thead className="sticky top-0 z-10">
              <tr>
                <th scope="col" className="w-10">{t.common.row}</th>
                <th scope="col">{h.column.name}</th>
                <th scope="col">{h.statusInFile}</th>
                <th scope="col">{h.statusMapped}</th>
                <th scope="col">{h.zoneInFile}</th>
                <th scope="col">{h.zoneMapped}</th>
                <th scope="col">{t.common.review}</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {parsed.blocks.map((b, i) => {
                const rows = show === "flagged" ? b.rows.filter((r) => r.flagged) : b.rows;
                if (!rows.length) return null;
                const skipped = !blockGroupIds[i];
                return (
                  <Fragment key={b.headerRow}>
                    <tr>
                      <th scope="colgroup" colSpan={7} className="!bg-sunken !text-ink">
                        <span className="inline-flex items-center gap-2">
                          {b.label || h.blockNoLabel}
                          <ArrowRight className="size-4 text-ink-3" aria-hidden />
                          {groupName(blockGroupIds[i]) ?? h.blockSkipped}
                        </span>
                      </th>
                    </tr>
                    {rows.map((r) => (
                      <tr key={r.row} className={skipped ? "text-ink-3" : undefined}>
                        <td className="text-ink-3">{r.row}</td>
                        <td className="font-semibold whitespace-nowrap">{r.name}</td>
                        <td className="min-w-36">{r.statusText || "—"}</td>
                        <td><StatusChip status={statusByCode.get(r.status.code)} size="sm" /></td>
                        <td>{r.zoneText || "—"}</td>
                        <td>{describeZone(r.zone) || "—"}</td>
                        <td className="min-w-48">
                          {r.flagged ? (
                            <div className="space-y-1">
                              <ReviewBadge />
                              {r.reasons.map((reason) => <div key={reason}><FlagNote>{reason}</FlagNote></div>)}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </TableWrap>
        </Section>
      ) : null}

      <Problems items={problems} />
      <StepNav back={t.nav.back} onBack={onBack} next={t.nav.toMatching} onNext={submit} disabled={problems.length > 0} />
    </div>
  );
}
