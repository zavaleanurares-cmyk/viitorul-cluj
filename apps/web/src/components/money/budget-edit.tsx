"use client";
import { useState } from "react";
import { Pencil } from "lucide-react";
import { MONTHS_RO } from "@club/shared";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Field, FormError } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { saveBudget } from "@/app/(app)/bani/buget/actions";
import { MoneyInput } from "./money-input";

export function BudgetEditButton({ year, kind, departmentId, name, planned }: { year: number; kind: "income" | "expense"; departmentId: string | null; name: string; planned: number[] }) {
  const m = useT().money;
  const t = m.budget;
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState<Array<number | null>>(planned);
  const [same, setSame] = useState<number | null>(null);
  const a = useAction(saveBudget, { onSuccess: () => setOpen(false) });
  return (
    <>
      <Button variant="ghost" size="sm" icon={<Pencil className="size-4" aria-hidden />} onClick={() => { setVals(planned); setOpen(true); }}>{t.edit}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t.editTitle(name, year)} wide
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>{m.common.cancel}</Button>
          <Button pending={a.pending} onClick={() => a.run({ year, kind, departmentId, amounts: vals.map((v) => v ?? 0) })}>{m.common.save}</Button></>}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <Field label={t.sameEveryMonth} className="w-48"><MoneyInput value={same} onChange={setSame} /></Field>
            <Button variant="secondary" disabled={same === null} onClick={() => setVals(Array(12).fill(same))}>{t.sameEveryMonth}</Button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {MONTHS_RO.map((mo, i) => (
              <Field key={mo} label={mo}><MoneyInput value={vals[i]} onChange={(v) => setVals(vals.map((x, j) => (j === i ? v : x)))} /></Field>
            ))}
          </div>
          <FormError>{a.error}</FormError>
        </div>
      </Dialog>
    </>
  );
}
