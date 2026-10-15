"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Trash2 } from "lucide-react";
import { deleteMetricRow } from "@/app/(app)/fizic/actions";
import { ConfirmDialog } from "@/components/players/confirm-dialog";
import { IconButton } from "@/components/ui/button";
import { TableWrap } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { METRIC_DECIMALS, METRIC_KEYS, formatNumber, mean, type MetricKey, type MetricValues } from "./domain";

export type MetricsRow = { player_id: string; name: string; values: MetricValues; extra: Record<string, string | number> };

type Column = { id: string; label: string; title: string; decimals: number; get: (r: MetricsRow) => number | string | null };

/**
 * Tabelul unei sesiuni: jucători × indicatori. Se sortează pe orice coloană; ultima linie este media,
 * iar maximul fiecărei coloane este scos în evidență. Coloanele fără nicio valoare nu se afișează.
 */
export function MetricsTable({ rows, sessionId, canEdit }: { rows: MetricsRow[]; sessionId: string; canEdit: boolean }) {
  const t = useT().physical;
  const [sort, setSort] = useState<{ id: string; dir: 1 | -1 }>({ id: "name", dir: 1 });
  const [removing, setRemoving] = useState<MetricsRow | null>(null);
  const remove = useAction(deleteMetricRow, { onSuccess: () => setRemoving(null) });

  const columns = useMemo<Column[]>(() => {
    const base: Column[] = METRIC_KEYS.filter((k) => rows.some((r) => r.values[k] !== null)).map((k: MetricKey) => ({
      id: k, label: t.metrics[k].short, title: `${t.metrics[k].label} (${t.metrics[k].unit})`, decimals: METRIC_DECIMALS[k], get: (r) => r.values[k],
    }));
    const extraKeys = [...new Set(rows.flatMap((r) => Object.keys(r.extra)))].sort((a, b) => a.localeCompare(b, "ro"));
    const extra: Column[] = extraKeys.map((k) => {
      const numeric = rows.map((r) => r.extra[k]).filter((v): v is number => typeof v === "number");
      const decimals = numeric.some((v) => !Number.isInteger(v)) ? 1 : 0;
      return { id: `extra:${k}`, label: k, title: t.session.extraColumn(k), decimals, get: (r) => r.extra[k] ?? null };
    });
    return [...base, ...extra];
  }, [rows, t]);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.id === sort.id);
    return [...rows].sort((a, b) => {
      if (!col) return a.name.localeCompare(b.name, "ro") * sort.dir;
      const x = col.get(a);
      const y = col.get(b);
      // valorile lipsă rămân la coadă, indiferent de sens
      if (x === null && y === null) return a.name.localeCompare(b.name, "ro");
      if (x === null) return 1;
      if (y === null) return -1;
      const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "ro");
      return cmp * sort.dir || a.name.localeCompare(b.name, "ro");
    });
  }, [rows, columns, sort]);

  const stats = columns.map((c) => {
    const nums = rows.map((r) => c.get(r)).filter((v): v is number => typeof v === "number");
    return { max: nums.length > 1 ? Math.max(...nums) : null, avg: mean(nums) };
  });

  const toggle = (id: string) =>
    // prima apăsare pe un indicator: de la cel mai mare; pe nume: alfabetic
    setSort((s) => (s.id === id ? { id, dir: s.dir === 1 ? -1 : 1 } : { id, dir: id === "name" ? 1 : -1 }));

  const ariaSort = (id: string) => (sort.id === id ? (sort.dir === 1 ? "ascending" : "descending") : undefined);
  const sticky = "sticky left-0 z-10 border-r border-line";

  return (
    <>
      <TableWrap>
        <caption className="sr-only">{t.session.tableCaption}</caption>
        <thead>
          <tr>
            <th scope="col" aria-sort={ariaSort("name")} className={cn(sticky, "min-w-32 max-w-40 bg-canvas py-0! md:max-w-none")}>
              <SortHead id="name" label={t.session.player} align="left" sort={sort} onToggle={toggle} />
            </th>
            {columns.map((c) => (
              <th key={c.id} scope="col" aria-sort={ariaSort(c.id)} className="px-2! py-0! text-right">
                <SortHead id={c.id} label={c.label} title={c.title} align="right" sort={sort} onToggle={toggle} />
              </th>
            ))}
            {canEdit ? <th scope="col" className="w-12 p-0!" aria-label={t.session.actions} /> : null}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.player_id}>
              <th scope="row" className={cn(sticky, "min-w-32 max-w-40 bg-surface py-1.5! border-t border-line text-base! font-semibold! text-ink! md:max-w-none")}>
                <Link href={`/lot/jucatori/${r.player_id}/fizic`} className="block truncate hover:underline" title={r.name}>{r.name}</Link>
              </th>
              {columns.map((c, i) => {
                const v = c.get(r);
                const isMax = typeof v === "number" && stats[i].max !== null && v === stats[i].max;
                return (
                  <td key={c.id} className="px-2! py-1.5! text-right whitespace-nowrap">
                    {v === null ? <span className="text-ink-3">·</span> : typeof v === "number" ? (
                      isMax ? (
                        <strong className="-mr-1.5 inline-block rounded-md bg-sunken px-1.5 font-bold" title={t.session.maxOfColumn}>
                          {formatNumber(v, c.decimals)}
                        </strong>
                      ) : formatNumber(v, c.decimals)
                    ) : v}
                  </td>
                );
              })}
              {canEdit ? (
                <td className="p-0! text-right">
                  <IconButton label={t.session.deleteRow(r.name)} onClick={() => setRemoving(r)}><Trash2 className="size-5" aria-hidden /></IconButton>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className={cn(sticky, "bg-canvas")}>{t.session.average(rows.length)}</th>
            {columns.map((c, i) => (
              <td key={c.id} className="bg-canvas px-2! text-right text-sm font-semibold whitespace-nowrap">
                {stats[i].avg === null ? "" : formatNumber(stats[i].avg, Math.max(c.decimals, c.id === "max_speed_kmh" ? 1 : 0))}
              </td>
            ))}
            {canEdit ? <td className="bg-canvas p-0!" /> : null}
          </tr>
        </tfoot>
      </TableWrap>
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={t.session.deleteRowTitle}
        confirmLabel={t.session.deleteRowConfirm}
        pending={remove.pending}
        error={remove.error}
        onConfirm={() => removing && remove.run({ sessionId, playerId: removing.player_id })}
      >
        {removing ? t.session.deleteRowText(removing.name) : null}
      </ConfirmDialog>
    </>
  );
}

function SortHead({ id, label, title, align, sort, onToggle }: {
  id: string; label: string; title?: string; align: "left" | "right"; sort: { id: string; dir: 1 | -1 }; onToggle: (id: string) => void;
}) {
  const active = sort.id === id;
  const Icon = !active ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onToggle(id)}
      title={title}
      className={cn("inline-flex min-h-10 items-center gap-1 font-semibold whitespace-nowrap hover:text-ink", align === "right" && "flex-row-reverse", active && "text-ink")}
    >
      {label}
      <Icon className={cn("size-3.5 shrink-0", !active && "opacity-50")} aria-hidden />
    </button>
  );
}
