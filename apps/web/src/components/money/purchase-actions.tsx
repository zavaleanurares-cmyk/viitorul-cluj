"use client";
import { useState } from "react";
import { Ban, Check, ShoppingBag, X } from "lucide-react";
import { PAYMENT_METHOD_LABELS } from "@club/shared";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { cancelPurchaseRequest, completePurchaseRequest, decidePurchaseRequest } from "@/app/(app)/bani/referate/actions";
import { MoneyInput } from "./money-input";

export function DecideButtons({ id }: { id: string }) {
  const m = useT().money;
  const t = m.purchases.detail;
  const [mode, setMode] = useState<"approved" | "rejected" | null>(null);
  const [note, setNote] = useState("");
  const a = useAction(decidePurchaseRequest, { onSuccess: () => setMode(null) });
  return (
    <>
      <Button variant="secondary" icon={<X className="size-5" aria-hidden />} onClick={() => setMode("rejected")}>{t.reject}</Button>
      <Button icon={<Check className="size-5" aria-hidden />} onClick={() => setMode("approved")}>{t.approve}</Button>
      <Dialog open={mode !== null} onClose={() => setMode(null)} title={mode === "approved" ? t.approve : t.reject}
        footer={<><Button variant="ghost" onClick={() => setMode(null)}>{m.common.cancel}</Button>
          <Button variant={mode === "rejected" ? "danger" : "primary"} pending={a.pending} disabled={mode === "rejected" && !note.trim()} onClick={() => mode && a.run({ id, decision: mode, note })}>{mode === "approved" ? t.approve : t.reject}</Button></>}>
        <Field label={mode === "rejected" ? t.rejectReason : t.approveNote} optional={mode === "approved"}><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} autoFocus /></Field>
        <FormError>{a.error}</FormError>
      </Dialog>
    </>
  );
}

export function CompleteButton({ id, total, today }: { id: string; total: number; today: string }) {
  const m = useT().money;
  const t = m.purchases.detail;
  const [open, setOpen] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [invoice, setInvoice] = useState("");
  const [amount, setAmount] = useState<number | null>(total);
  const [date, setDate] = useState(today);
  const [method, setMethod] = useState<"bank" | "card" | "cash">("bank");
  const a = useAction(completePurchaseRequest, { onSuccess: () => setOpen(false) });
  return (
    <>
      <Button icon={<ShoppingBag className="size-5" aria-hidden />} onClick={() => setOpen(true)}>{t.complete}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t.completeTitle}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>{m.common.cancel}</Button>
          <Button pending={a.pending} disabled={!amount} onClick={() => amount && a.run({ id, spent_on: date, supplier, invoice_no: invoice, amount, method, document_path: null })}>{m.common.save}</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={m.expenses.fields.supplier}><Input value={supplier} onChange={(e) => setSupplier(e.target.value)} maxLength={200} /></Field>
          <Field label={m.expenses.fields.invoice} optional><Input value={invoice} onChange={(e) => setInvoice(e.target.value)} maxLength={60} /></Field>
          <Field label={m.expenses.fields.amount}><MoneyInput value={amount} onChange={setAmount} /></Field>
          <Field label={m.expenses.fields.date}><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label={m.expenses.fields.method}>
            <Select value={method} onChange={(e) => setMethod(e.target.value as "bank")}>
              {(["bank", "card", "cash"] as const).map((k) => <option key={k} value={k}>{PAYMENT_METHOD_LABELS[k]}</option>)}
            </Select>
          </Field>
        </div>
        <FormError>{a.error}</FormError>
      </Dialog>
    </>
  );
}

export function CancelRequestButton({ id }: { id: string }) {
  const t = useT().money.purchases.detail;
  const a = useAction(cancelPurchaseRequest);
  return <Button variant="ghost" icon={<Ban className="size-5" aria-hidden />} pending={a.pending} onClick={() => a.run({ id })}>{t.cancel}</Button>;
}
