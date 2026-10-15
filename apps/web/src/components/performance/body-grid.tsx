"use client";
import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import { useT } from "@/messages";
import { saveBodyMeasurements } from "@/app/(app)/performanta/corp/actions";

type Row = { id: string; name: string; weight: number | null; height: number | null; fat: number | null; prevWeight: number | null };

const parse = (s: string) => {
  const v = s.trim().replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};
const show = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));

/** Grila pe echipă: o linie pe jucător, Tab între câmpuri, o singură salvare. */
export function BodyGrid({ rows, date, today, dateHref }: { rows: Row[]; date: string; today: string; dateHref: string }) {
  const t = useT().performance.body;
  const toast = useToast();
  const router = useRouter();
  const [vals, setVals] = useState(() => Object.fromEntries(rows.map((r) => [r.id, { weight: show(r.weight), height: show(r.height), fat: show(r.fat) }])));
  const save = useAction(saveBodyMeasurements, { successMessage: false, onSuccess: (r) => toast(t.saved(r.saved)) });
  const set = (id: string, k: "weight" | "height" | "fat", v: string) => setVals({ ...vals, [id]: { ...vals[id], [k]: v } });
  const changed = rows.filter((r) => {
    const v = vals[r.id];
    return v.weight !== show(r.weight) || v.height !== show(r.height) || v.fat !== show(r.fat);
  });
  const invalid = changed.some((r) => [vals[r.id].weight, vals[r.id].height, vals[r.id].fat].some((x) => Number.isNaN(parse(x))));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Field label={t.date} className="w-48">
          <Input type="date" value={date} max={today} onChange={(e) => e.target.value && router.push(`${dateHref}${dateHref.includes("?") ? "&" : "?"}data=${e.target.value}`)} />
        </Field>
        <p className="max-w-prose text-sm text-ink-3">{t.entryHint}</p>
      </div>
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
        <table className="w-full min-w-[34rem] text-left">
          <thead className="border-b border-line bg-canvas text-sm text-ink-2">
            <tr>
              <th scope="col" className="px-3 py-2">{t.cols.player}</th>
              <th scope="col" className="w-32 px-2 py-2">{t.cols.weight}</th>
              <th scope="col" className="w-32 px-2 py-2">{t.cols.height}</th>
              <th scope="col" className="w-28 px-2 py-2">{t.cols.fat}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id}>
                <th scope="row" className="px-3 py-1.5 font-semibold">
                  {r.name}
                  {r.prevWeight !== null ? <span className="block text-sm font-normal text-ink-3">{t.cols.last}: {show(r.prevWeight)} kg</span> : null}
                </th>
                {(["weight", "height", "fat"] as const).map((k) => (
                  <td key={k} className="px-2 py-1.5">
                    <Input inputMode="decimal" aria-label={`${t.cols[k]} — ${r.name}`} value={vals[r.id][k]} onChange={(e) => set(r.id, k, e.target.value)}
                      className={Number.isNaN(parse(vals[r.id][k])) ? "border-st-red" : undefined} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <FormError>{invalid ? t.errors.range : save.error}</FormError>
      <div className="flex justify-end">
        <Button icon={<Save className="size-5" aria-hidden />} disabled={!changed.length || invalid} pending={save.pending} onClick={() => save.run({
          date,
          rows: changed.map((r) => ({ playerId: r.id, weight: parse(vals[r.id].weight), height: parse(vals[r.id].height), fat: parse(vals[r.id].fat) })),
        })}>{t.save}</Button>
      </div>
    </div>
  );
}
