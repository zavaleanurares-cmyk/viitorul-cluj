"use client";
import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormError, Input } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { useToast } from "@/components/ui/toast";
import { useT } from "@/messages";
import { saveTestGrid } from "@/app/(app)/fizic/teste/actions";

type Test = { id: string; name: string; unit: string };
type Row = { id: string; name: string; values: Record<string, number | null>; previous: Record<string, number | null> };

const parse = (s: string) => {
  const v = s.trim().replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};
const show = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","));

/** Grila unei testări: un jucător pe rând, un test pe coloană; Tab merge pe rând, ca într-un tabel. */
export function TestGrid({ tests, rows, date }: { tests: Test[]; rows: Row[]; date: string }) {
  const t = useT().performance.tests;
  const toast = useToast();
  const key = (p: string, x: string) => `${p}:${x}`;
  const initial = Object.fromEntries(rows.flatMap((r) => tests.map((x) => [key(r.id, x.id), show(r.values[x.id])])));
  const [vals, setVals] = useState<Record<string, string>>(initial);
  const save = useAction(saveTestGrid, { successMessage: false, onSuccess: (r) => toast(t.saved(r.saved)) });
  const changed = Object.keys(vals).filter((k) => vals[k] !== initial[k]);
  const invalid = changed.some((k) => Number.isNaN(parse(vals[k])));
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
        <table className="w-full text-left" style={{ minWidth: `${12 + tests.length * 8}rem` }}>
          <thead className="border-b border-line bg-canvas text-sm text-ink-2">
            <tr>
              <th scope="col" className="sticky left-0 bg-canvas px-3 py-2">{t.player}</th>
              {tests.map((x) => <th key={x.id} scope="col" className="px-2 py-2">{x.name} <span className="font-normal text-ink-3">({x.unit})</span></th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id}>
                <th scope="row" className="sticky left-0 bg-surface px-3 py-1.5 font-semibold whitespace-nowrap">{r.name}</th>
                {tests.map((x) => {
                  const k = key(r.id, x.id);
                  const prev = r.previous[x.id];
                  return (
                    <td key={x.id} className="px-2 py-1.5 align-top">
                      <Input inputMode="decimal" aria-label={`${x.name} — ${r.name}`} value={vals[k] ?? ""} onChange={(e) => setVals({ ...vals, [k]: e.target.value })}
                        className={Number.isNaN(parse(vals[k] ?? "")) ? "w-24 border-st-red" : "w-24"} />
                      {prev !== null && prev !== undefined ? <span className="mt-0.5 block text-xs text-ink-3">{t.previous(show(prev))}</span> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <FormError>{invalid ? t.invalid : save.error}</FormError>
      <div className="flex justify-end">
        <Button icon={<Save className="size-5" aria-hidden />} disabled={!changed.length || invalid} pending={save.pending} onClick={() => save.run({
          date,
          rows: changed.map((k) => { const [playerId, testId] = k.split(":"); return { playerId, testId, value: parse(vals[k]) }; }),
        })}>{t.save}</Button>
      </div>
    </div>
  );
}
