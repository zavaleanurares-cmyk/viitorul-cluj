"use client";
import { useEffect, useState } from "react";
import { FileDown, Undo2 } from "lucide-react";
import { formatDateShort, formatLei, PAYMENT_METHOD_LABELS, suggestAllocation } from "@club/shared";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { DataList } from "@/components/ui/misc";
import { Field, FormError, Input } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { allocatePayment, loadPaymentForAllocation, refundPayment, voidPayment } from "@/app/(app)/bani/incasari/actions";
import { Money } from "./bits";
import { MoneyInput } from "./money-input";
import { AllocationEditor, FamilyPicker, type Family } from "./record-payment";

export type PaymentRow = {
  id: string; received_on: string; amount: number; method: string; status: string; refunded_amount: number; allocated: number; unallocated: number;
  payer: string; reference: string | null; note: string | null; provider: string | null; provider_ref: string | null;
  receiptId: string | null; receiptLabel: string | null; family: Family | null;
  allocations: Array<{ title: string; player: string; amount: number }>;
};

/** Împărțirea (din nou) a unei plăți: familia + sumele pe taxe. */
function AllocateForm({ payment, families, onDone }: { payment: PaymentRow; families: Family[]; onDone: () => void }) {
  const m = useT().money;
  const [family, setFamily] = useState<Family | null>(payment.family);
  const [charges, setCharges] = useState<Array<{ id: string; title: string; player: string; balance: number; due_on: string; period: string | null; issued_at: string; current: number }>>([]);
  const [available, setAvailable] = useState(payment.amount - payment.refunded_amount);
  const [rows, setRows] = useState<Record<string, number>>({});
  const load = useAction(loadPaymentForAllocation, { successMessage: false, refresh: false });
  const save = useAction(allocatePayment, { successMessage: m.payments.inbox.saved, onSuccess: onDone });
  useEffect(() => {
    let alive = true;
    load.run({ paymentId: payment.id, playerIds: family?.players ?? [] }).then((res) => {
      if (!alive || !res.ok) return;
      setCharges(res.data.charges);
      setAvailable(res.data.available);
      const keep = Object.fromEntries(res.data.charges.filter((c) => c.current > 0).map((c) => [c.id, c.current]));
      const used = Object.values(keep).reduce((s, v) => s + v, 0);
      const extra = suggestAllocation(res.data.available - used, res.data.charges.map((c) => ({ ...c, balance: c.balance - (keep[c.id] ?? 0) })));
      for (const r of extra.rows) keep[r.charge_id] = (keep[r.charge_id] ?? 0) + r.amount;
      setRows(keep);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family]);
  const used = Object.values(rows).reduce((s, v) => s + (v || 0), 0);
  return (
    <div className="space-y-4">
      <Field label={m.payments.form.who}><span className="block"><FamilyPicker families={families} value={family} onChange={setFamily} /></span></Field>
      {family ? <AllocationEditor open={charges} amount={available} rows={rows} onRows={setRows} /> : null}
      <p className="text-sm text-ink-3">{m.payments.inbox.leftover}</p>
      <FormError>{save.error}</FormError>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>{m.common.cancel}</Button>
        <Button pending={save.pending} disabled={!family || used > available}
          onClick={() => save.run({ paymentId: payment.id, guardianId: family?.guardianId ?? null, playerId: family?.playerId ?? null, rows: Object.entries(rows).map(([charge_id, amount]) => ({ charge_id, amount })) })}>
          {m.common.save}
        </Button>
      </div>
    </div>
  );
}

export function AssignPaymentButton({ payment, families, label }: { payment: PaymentRow; families: Family[]; label?: string }) {
  const m = useT().money;
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>{label ?? m.payments.inbox.assign}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={m.payments.inbox.assignTitle} wide>
        <p className="mb-4 font-semibold"><Money value={payment.unallocated} /> · {payment.payer}{payment.reference ? <span className="block text-sm font-normal text-ink-3">{payment.reference}</span> : null}</p>
        {open ? <AllocateForm payment={payment} families={families} onDone={() => setOpen(false)} /> : null}
      </Dialog>
    </>
  );
}

/** Fereastra unei plăți: detalii, împărțire, anulare (numerar/bancă) sau returnare (online). */
export function PaymentDialog({ payment, families, canRefund, onClose }: { payment: PaymentRow; families: Family[]; canRefund: boolean; onClose: () => void }) {
  const m = useT().money;
  const t = m.payments.detail;
  const [mode, setMode] = useState<"view" | "allocate" | "void" | "refund">("view");
  const [reason, setReason] = useState("");
  const [refund, setRefund] = useState<number | null>(payment.amount - payment.refunded_amount);
  const doVoid = useAction(voidPayment, { onSuccess: onClose });
  const doRefund = useAction(refundPayment, { onSuccess: onClose });
  const active = payment.status === "completed";
  return (
    <Dialog open onClose={onClose} title={`${t.title} · ${formatLei(payment.amount)}`} wide
      footer={mode === "view" ? (
        <>
          <a href={`/api/bani/dovada/${payment.id}`} className="inline-flex h-12 items-center gap-2 rounded-[var(--radius-control)] px-4 font-semibold hover:bg-sunken"><FileDown className="size-5" aria-hidden />{m.family.confirmation}</a>
          {payment.receiptId ? <a href={`/api/bani/chitanta/${payment.receiptId}`} className="inline-flex h-12 items-center gap-2 rounded-[var(--radius-control)] px-4 font-semibold hover:bg-sunken"><FileDown className="size-5" aria-hidden />{m.family.receipt}</a> : null}
          {active && payment.method !== "online" ? <Button variant="ghost" onClick={() => setMode("void")}>{t.void}</Button> : null}
          {active && payment.method === "online" && canRefund && payment.refunded_amount < payment.amount ? <Button variant="ghost" icon={<Undo2 className="size-5" aria-hidden />} onClick={() => setMode("refund")}>{t.refund}</Button> : null}
          {active ? <Button variant="secondary" onClick={() => setMode("allocate")}>{t.reallocate}</Button> : null}
        </>
      ) : mode === "void" ? (
        <>
          <Button variant="ghost" onClick={() => setMode("view")}>{m.common.cancel}</Button>
          <Button variant="danger" pending={doVoid.pending} disabled={reason.trim().length < 3} onClick={() => doVoid.run({ paymentId: payment.id, reason })}>{t.void}</Button>
        </>
      ) : mode === "refund" ? (
        <>
          <Button variant="ghost" onClick={() => setMode("view")}>{m.common.cancel}</Button>
          <Button variant="danger" pending={doRefund.pending} disabled={!refund} onClick={() => refund && doRefund.run({ paymentId: payment.id, amount: refund })}>{t.refund}</Button>
        </>
      ) : undefined}>
      {mode === "allocate" ? <AllocateForm payment={payment} families={families} onDone={onClose} /> : (
        <div className="space-y-4">
          <DataList items={[
            { label: m.common.date, value: formatDateShort(payment.received_on) },
            { label: m.payments.cols.payer, value: payment.payer },
            { label: m.common.method, value: PAYMENT_METHOD_LABELS[payment.method] ?? payment.method },
            { label: m.common.amount, value: <Money value={payment.amount} /> },
            ...(payment.refunded_amount ? [{ label: t.refundedLabel, value: <Money value={payment.refunded_amount} /> }] : []),
            ...(payment.reference ? [{ label: m.payments.form.reference, value: payment.reference }] : []),
            ...(payment.provider_ref ? [{ label: t.providerRef, value: payment.provider_ref }] : []),
            ...(payment.note ? [{ label: m.common.note, value: payment.note }] : []),
            ...(payment.receiptLabel ? [{ label: m.payments.cols.receipt, value: payment.receiptLabel }] : []),
          ]} />
          <section>
            <h3 className="mb-2 font-semibold">{t.allocations}</h3>
            {payment.allocations.length === 0 ? <p className="text-ink-3">{t.noAllocations}</p> : (
              <ul className="divide-y divide-line rounded-[var(--radius-control)] border border-line">
                {payment.allocations.map((a, i) => (
                  <li key={i} className="flex justify-between gap-3 px-3 py-2"><span>{a.title} · {a.player}</span><Money value={a.amount} className="font-semibold" /></li>
                ))}
              </ul>
            )}
            {payment.unallocated > 0 && active ? <p className="mt-2 font-semibold text-st-orange">{m.payments.unallocatedChip(formatLei(payment.unallocated))}</p> : null}
          </section>
          {mode === "void" ? (
            <div className="space-y-2">
              <p className="text-ink-3">{t.voidHint}</p>
              <Field label={t.voidReason}><Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} /></Field>
              <FormError>{doVoid.error}</FormError>
            </div>
          ) : null}
          {mode === "refund" ? (
            <div className="space-y-2">
              <p className="text-ink-3">{t.refundHint}</p>
              <Field label={t.refundAmount}><MoneyInput value={refund} onChange={setRefund} /></Field>
              <FormError>{doRefund.error}</FormError>
            </div>
          ) : null}
        </div>
      )}
    </Dialog>
  );
}

/** Lista de plăți (rânduri care deschid fereastra plății). */
export function PaymentList({ rows, families, canRefund }: { rows: PaymentRow[]; families: Family[]; canRefund: boolean }) {
  const m = useT().money;
  const t = m.payments;
  const [open, setOpen] = useState<PaymentRow | null>(null);
  return (
    <>
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        {rows.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => setOpen(p)} className="grid min-h-16 w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 px-4 py-2 text-left hover:bg-canvas sm:grid-cols-[6rem_1fr_auto_auto_7rem]">
              <span className="tabular-nums text-ink-2">{formatDateShort(p.received_on)}</span>
              <Money value={p.amount} className="text-right font-bold sm:order-5" />
              <span className="col-span-2 min-w-0 sm:order-2 sm:col-span-1">
                <span className={p.status === "void" ? "block truncate font-semibold text-ink-3 line-through" : "block truncate font-semibold"}>{p.payer}</span>
                <span className="block truncate text-sm text-ink-3">{p.allocations.length ? p.allocations.map((a) => `${a.title} · ${a.player}`).join("; ") : t.detail.noAllocations}</span>
              </span>
              <span className="text-sm text-ink-2 sm:order-3">{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</span>
              <span className="flex flex-wrap justify-end gap-1 sm:order-4">
                {p.status === "void" ? <span className="inline-flex h-6 items-center rounded-md bg-sunken px-1.5 text-xs font-semibold text-ink-3">{t.voidChip}</span> : null}
                {p.status !== "void" && p.unallocated > 0 ? <span className="inline-flex h-6 items-center rounded-md bg-st-yellow px-1.5 text-xs font-semibold">{t.unallocatedChip(formatLei(p.unallocated))}</span> : null}
                {p.refunded_amount > 0 ? <span className="inline-flex h-6 items-center rounded-md bg-st-blue-soft px-1.5 text-xs font-semibold">{t.refundedChip(formatLei(p.refunded_amount))}</span> : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {open ? <PaymentDialog key={open.id} payment={open} families={families} canRefund={canRefund} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
