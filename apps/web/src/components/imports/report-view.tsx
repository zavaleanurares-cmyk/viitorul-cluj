"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { IMPORT_KINDS, formatDateShort } from "@club/shared";
import { Button, LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { TableWrap } from "@/components/ui/misc";
import { Badge, ReviewBadge } from "@/components/ui/status";
import { useT } from "@/messages";
import { FilterTabs, Section, StatRow } from "./parts";
import { downloadCsv } from "./read-file";
import type { ImportKind, ImportRecord, ReportRow } from "./types";

type Filter = "all" | "imported" | "skipped" | "error" | "flagged";
const DONE: ReportRow["result"][] = ["created", "updated", "imported"];
const LIMIT = 500;

const VERIFY: Record<ImportKind, Array<{ href: string; key: "review" | "players" | "wellness" | "physical" }>> = {
  health_status: [{ href: "/disponibilitate?filtru=verificare", key: "review" }, { href: "/lot", key: "players" }],
  fatigue_grid: [{ href: "/wellness", key: "wellness" }, { href: "/disponibilitate?filtru=verificare", key: "review" }],
  roster: [{ href: "/lot", key: "players" }],
  physical: [{ href: "/fizic", key: "physical" }],
  tests: [{ href: "/fizic", key: "physical" }],
};

/** Raportul unui import: cifre, lista detaliată pe rânduri (filtrabilă), descărcare CSV și linkuri de verificare. */
export function ReportView({ record }: { record: ImportRecord }) {
  const t = useT().imports;
  const r = t.report;
  const [filter, setFilter] = useState<Filter>("all");
  const rows = record.report.rows;
  const is = {
    all: () => true,
    imported: (x: ReportRow) => DONE.includes(x.result),
    skipped: (x: ReportRow) => x.result === "skipped",
    error: (x: ReportRow) => x.result === "error",
    flagged: (x: ReportRow) => !!x.flagged,
  } satisfies Record<Filter, (x: ReportRow) => boolean>;
  const counts = Object.fromEntries((Object.keys(is) as Filter[]).map((k) => [k, rows.filter(is[k]).length])) as Record<Filter, number>;
  const shown = rows.filter(is[filter]);
  const withDate = rows.some((x) => x.date);
  const num = (key: string) => (typeof record.report[key] === "number" ? (record.report[key] as number) : null);
  const details = Object.entries(r.detail[record.kind] as Record<string, (n: number) => string>)
    .flatMap(([key, text]) => (num(key) === null ? [] : [text(num(key) as number)]));

  const csv = () => downloadCsv(
    `raport-import-${record.created_at.slice(0, 10)}-${record.id.slice(0, 8)}.csv`,
    [
      [r.csv.row, r.csv.name, r.csv.date, r.csv.result, r.csv.review, r.csv.note],
      ...rows.map((x) => [x.row, x.name, x.date ?? "", r.result[x.result], x.flagged ? r.csv.yes : "", x.note ?? ""]),
    ],
  );

  return (
    <div>
      <StatRow stats={[
        { label: r.imported, value: record.rows_imported, tone: "green" },
        { label: r.skipped, value: counts.skipped, tone: "gray" },
        { label: r.errors, value: counts.error, tone: "red" },
        { label: r.flagged, value: record.rows_flagged, tone: "orange" },
      ]} />
      {details.length ? <p className="mt-2 text-sm text-ink-2">{IMPORT_KINDS[record.kind]}: {details.join(" · ")}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {VERIFY[record.kind].map((v) => <LinkButton key={v.key} href={v.href}>{r.verify[v.key]}</LinkButton>)}
        <Button variant="secondary" icon={<Download className="size-5" aria-hidden />} onClick={csv} disabled={!rows.length}>{r.download}</Button>
      </div>

      <Section
        title={r.rowsTitle}
        action={rows.length ? (
          <FilterTabs
            label={r.filter} value={filter} onChange={setFilter}
            options={(["all", "imported", "skipped", "error", "flagged"] as const)
              .filter((k) => k === "all" || counts[k] > 0)
              .map((k) => ({ value: k, label: `${r.filters[k]} ${counts[k]}` }))}
          />
        ) : null}
      >
        {!rows.length ? <EmptyState title={r.emptyTitle} description={r.emptyDescription} /> : (
          <>
            <TableWrap className="max-h-[70vh] overflow-y-auto">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th scope="col" className="w-12">{t.common.row}</th>
                  <th scope="col">{r.csv.name}</th>
                  {withDate ? <th scope="col">{r.csv.date}</th> : null}
                  <th scope="col">{r.csv.result}</th>
                  <th scope="col">{r.csv.note}</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {shown.slice(0, LIMIT).map((x, i) => (
                  <tr key={`${x.row}-${x.date ?? ""}-${i}`}>
                    <td className="text-ink-3">{x.row ?? "—"}</td>
                    <td className="font-semibold">{x.name || "—"}</td>
                    {withDate ? <td className="whitespace-nowrap">{x.date ? formatDateShort(x.date) : ""}</td> : null}
                    <td className="whitespace-nowrap">
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        <Badge tone={x.result === "error" ? "red" : x.result === "skipped" ? "gray" : "green"}>{r.result[x.result]}</Badge>
                        {x.flagged ? <ReviewBadge /> : null}
                      </span>
                    </td>
                    <td className="min-w-48 text-ink-2">{x.note ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            {shown.length > LIMIT ? <p className="mt-2 text-sm text-ink-3">{r.limited(LIMIT, shown.length)}</p> : null}
          </>
        )}
      </Section>
    </div>
  );
}
