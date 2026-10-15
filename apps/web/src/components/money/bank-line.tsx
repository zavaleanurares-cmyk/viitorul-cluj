"use client";
import { useState } from "react";
import { formatDateShort } from "@club/shared";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Field, FormError, Input, Segmented, Select } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { expenseFromLine, resolveLine } from "@/app/(app)/bani/banca/actions";
import { Money } from "./bits";
import { FamilyPicker, type Family } from "./record-payment";

export type BankLineRow = { id: string; booked_on: string; amount: number; description: string | null; counterparty: string | null; status: string; note: string | null };
type Option = { id: string; label: string };

/** Rezolvarea unui rând din extras: de la o familie, plată de asociat, cheltuială (existentă sau nouă) sau ignorat. */
export function ResolveLineButton({ line, families, expenses, departments }: { line: BankLineRow; families: Family[]; expenses: Option[]; departments: Option[] }) {
  const m = useT().money;
  const t = m.bank.actions;
  const credit = line.amount > 0;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<string>(credit ? "family" : "newExpense");
  const [family, setFamily] = useState<Family | null>(null);
  const [expense, setExpense] = useState("");
  const [note, setNote] = useState("");
  const [desc, setDesc] = useState(line.description ?? "");
  const [dept, setDept] = useState("");
  const resolve = useAction(resolveLine, { onSuccess: () => setOpen(false) });
  const create = useAction(expenseFromLine, { onSuccess: () => setOpen(false) });
  const modes = credit
    ? [{ value: "family", label: t.family }, { value: "unassigned", label: t.unassigned }, { value: "ignore", label: t.ignore }]
    : [{ value: "newExpense", label: t.newExpense }, ...(expenses.length ? [{ value: "expense", label: t.expense }] : []), { value: "ignore", label: t.ignore }];
  const submit = () => {
    if (mode === "family" && family?.guardianId) resolve.run({ lineId: line.id, action: "match_guardian", guardianId: family.guardianId });
    else if (mode === "unassigned") resolve.run({ lineId: line.id, action: "unassigned_payment" });
    else if (mode === "expense" && expense) resolve.run({ lineId: line.id, action: "match_expense", expenseId: expense });
    else if (mode === "ignore") resolve.run({ lineId: line.id, action: "ignore", note });
    else if (mode === "newExpense") create.run({ lineId: line.id, description: desc, departmentId: dept || null });
  };
  const ready = mode === "family" ? !!family?.guardianId : mode === "expense" ? !!expense : mode === "newExpense" ? desc.trim().length > 0 : true;
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>{m.bank.resolve}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`${formatDateShort(line.booked_on)} · ${line.counterparty ?? ""}`}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>{m.common.cancel}</Button>
          <Button disabled={!ready} pending={resolve.pending || create.pending} onClick={submit}>{m.common.save}</Button></>}>
        <div className="space-y-4">
          <p><Money value={line.amount} sign className="text-xl font-bold" /><span className="block text-ink-2">{line.description}</span></p>
          <Segmented label={m.bank.cols.status} value={mode} onChange={setMode} options={modes} />
          {mode === "family" ? <FamilyPicker families={families.filter((f) => f.guardianId)} value={family} onChange={setFamily} autoFocus /> : null}
          {mode === "expense" ? (
            <Field label={t.expense}>
              <Select value={expense} onChange={(e) => setExpense(e.target.value)}>
                <option value="" />
                {expenses.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </Select>
            </Field>
          ) : null}
          {mode === "newExpense" ? (
            <>
              <Field label={m.expenses.fields.description}><Input value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={300} /></Field>
              <Field label={m.expenses.fields.department}>
                <Select value={dept} onChange={(e) => setDept(e.target.value)}>
                  <option value="">{m.expenses.fields.noDepartment}</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                </Select>
              </Field>
            </>
          ) : null}
          {mode === "ignore" ? <Field label={t.ignoreNote} optional><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} /></Field> : null}
          <FormError>{resolve.error ?? create.error}</FormError>
        </div>
      </Dialog>
    </>
  );
}

export function ReopenLineButton({ lineId }: { lineId: string }) {
  const t = useT().money.bank.actions;
  const a = useAction(resolveLine);
  return <Button variant="ghost" size="sm" pending={a.pending} onClick={() => a.run({ lineId, action: "reopen" })}>{t.reopen}</Button>;
}
