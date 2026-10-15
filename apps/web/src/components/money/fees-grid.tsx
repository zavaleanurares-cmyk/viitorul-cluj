"use client";
import { useEffect, useState } from "react";
import { Ban, BadgePercent, CircleAlert, CircleCheck, CircleDashed, CircleDot, Clock, Download } from "lucide-react";
import { chargeDisplayState, formatDateShort, formatLei, monthLabel, monthShort, PAYMENT_METHOD_LABELS } from "@club/shared";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { DataList } from "@/components/ui/misc";
import { Field, FormError, Input } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { cn } from "@/lib/cn";
import { cancelCharge, loadCharge, setChargeDiscount } from "@/app/(app)/bani/taxe/actions";
import { ChargeStateChip, Money } from "./bits";
import { MoneyInput } from "./money-input";
import { RecordPaymentButton, type Family } from "./record-payment";

export type GridCell = { id: string; net: number; paid: number; state: string; due_on: string };
export type GridRow = { playerId: string; name: string; team: string; fee: number | null; inactive: boolean; family: Family | null; cells: Record<number, GridCell> };

const ICON = { paid: CircleCheck, partial: CircleDot, overdue: CircleAlert, open: Clock, waived: BadgePercent, cancelled: Ban, future: CircleDashed } as const;
const CLS = {
  paid: "bg-st-green-soft text-ink",
  partial: "bg-st-yellow-soft text-ink",
  overdue: "bg-st-red text-white",
  open: "bg-surface text-ink",
  waived: "bg-st-blue-soft text-ink",
  cancelled: "bg-sunken text-ink-3",
  future: "bg-sunken text-ink-3",
} as const;

export function FeesGrid({ year, rows, today, families }: { year: number; rows: GridRow[]; today: string; families: Family[] }) {
  const m = useT().money;
  const t = m.grid;
  const [open, setOpen] = useState<{ row: GridRow; month: number; cell: GridCell } | null>(null);
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const period = (mo: number) => `${year}-${String(mo).padStart(2, "0")}-01`;
  const totals = months.map((mo) => rows.reduce((acc, r) => {
    const c = r.cells[mo];
    if (c && c.state !== "cancelled") { acc.net += c.net; acc.paid += c.paid; }
    return acc;
  }, { net: 0, paid: 0 }));

  const exportCsv = () => {
    const head = ["Jucător", "Echipă", "Taxa", ...months.map((mo) => monthLabel(period(mo)))];
    const lines = rows.map((r) => [r.name, r.team, r.fee !== null ? formatLei(r.fee, { currency: false }) : "",
      ...months.map((mo) => {
        const c = r.cells[mo];
        if (!c) return "";
        return `${formatLei(c.paid, { currency: false })} / ${formatLei(c.net, { currency: false })}`;
      })]);
    const csv = [head, ...lines].map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `taxe-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul aria-label={t.legend} className="flex flex-wrap gap-2 text-sm">
          {(["paid", "partial", "overdue", "open", "waived", "future"] as const).map((s) => {
            const Icon = ICON[s];
            return <li key={s} className={cn("inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-semibold", CLS[s], s === "open" && "ring-1 ring-inset ring-line-strong")}><Icon className="size-4" aria-hidden />{m.states[s]}</li>;
          })}
        </ul>
        <Button variant="secondary" size="sm" icon={<Download className="size-4" aria-hidden />} onClick={exportCsv}>{t.exportCsv}</Button>
      </div>
      <div className="-mx-4 overflow-x-auto md:mx-0 md:rounded-[var(--radius-card)] md:border md:border-line">
        <table className="w-full min-w-[960px] border-collapse bg-surface text-sm">
          <thead>
            <tr className="bg-canvas text-left text-xs font-semibold text-ink-3">
              <th scope="col" className="sticky left-0 z-10 bg-canvas px-3 py-2">{m.common.player}</th>
              <th scope="col" className="px-2 py-2 text-right">{t.fee}</th>
              {months.map((mo) => <th key={mo} scope="col" className="px-1 py-2 text-center">{monthShort(period(mo))}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.playerId} className="border-t border-line">
                <th scope="row" className="sticky left-0 z-10 max-w-56 bg-surface px-3 py-1.5 text-left font-normal">
                  <span className={cn("block truncate font-semibold", r.inactive && "text-ink-3")}>{r.name}</span>
                  <span className="block truncate text-xs text-ink-3">{r.team}</span>
                </th>
                <td className="px-2 py-1.5 text-right tabular-nums text-ink-2">{r.fee !== null ? formatLei(r.fee, { currency: false }) : "—"}</td>
                {months.map((mo) => {
                  const c = r.cells[mo];
                  const state = c ? chargeDisplayState(c.state, c.due_on, today) : "future";
                  const Icon = ICON[state as keyof typeof ICON] ?? Clock;
                  const label = t.cell(r.name, monthLabel(period(mo)), m.states[state as keyof typeof m.states] ?? state);
                  return (
                    <td key={mo} className="p-0.5">
                      {c ? (
                        <button type="button" aria-label={`${label}, ${formatLei(c.paid)} din ${formatLei(c.net)}`} onClick={() => setOpen({ row: r, month: mo, cell: c })}
                          className={cn("flex h-10 w-full min-w-14 items-center justify-center gap-1 rounded-md px-1 text-xs font-semibold tabular-nums hover:outline hover:outline-2 hover:outline-ink",
                            CLS[state as keyof typeof CLS], state === "open" && "ring-1 ring-inset ring-line-strong")}>
                          <Icon className="size-3.5 shrink-0" aria-hidden />
                          {state === "waived" ? "0" : formatLei(state === "paid" ? c.paid : c.net - c.paid, { currency: false })}
                        </button>
                      ) : (
                        <span aria-label={label} className="flex h-10 items-center justify-center rounded-md bg-sunken/60 text-ink-3">·</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line-strong bg-canvas text-xs">
              <th scope="row" className="sticky left-0 z-10 bg-canvas px-3 py-2 text-left">{t.totals}</th>
              <td />
              {totals.map((x, i) => (
                <td key={i} className="px-1 py-2 text-center tabular-nums">
                  {x.net ? <><span className="block font-semibold">{formatLei(x.paid, { currency: false })}</span><span className="block text-ink-3">{formatLei(x.net, { currency: false })}</span></> : "—"}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      {open ? <ChargeDialog key={open.cell.id} row={open.row} cell={open.cell} today={today} families={families} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

type Detail = { charge: { id: string; title: string; amount: number; discount: number; discount_note: string | null; net: number; paid: number; balance: number; state: string; due_on: string; issued_at: string; guardians: { full_name: string; payment_ref: string | null } | null }; payments: Array<{ id: string; amount: number; received_on: string; method: string; payer_name: string | null; status: string }> };

/** Fereastra unei taxe: sume, plăți, reducere, anulare, înregistrarea plății. */
export function ChargeDialog({ row, cell, today, families, onClose }: { row: GridRow; cell: GridCell; today: string; families: Family[]; onClose: () => void }) {
  const m = useT().money;
  const t = m.charge;
  const [detail, setDetail] = useState<Detail | null>(null);
  const [mode, setMode] = useState<"view" | "discount" | "cancel">("view");
  const [discount, setDiscount] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const load = useAction(loadCharge, { successMessage: false, refresh: false, onSuccess: (d) => { setDetail(d as unknown as Detail); setDiscount((d as unknown as Detail).charge.discount); setNote((d as unknown as Detail).charge.discount_note ?? ""); } });
  const saveDisc = useAction(setChargeDiscount, { onSuccess: onClose });
  const cancel = useAction(cancelCharge, { onSuccess: onClose });
  useEffect(() => {
    void load.run({ chargeId: cell.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cell.id]);
  const c = detail?.charge;

  return (
    <Dialog open onClose={onClose} title={c?.title ?? row.name}
      footer={mode === "view" ? (
        <>
          {c && c.paid === 0 && c.state !== "cancelled" ? <Button variant="ghost" onClick={() => setMode("cancel")}>{t.cancel}</Button> : null}
          {c && c.state !== "cancelled" ? <Button variant="secondary" onClick={() => setMode("discount")}>{t.setDiscount}</Button> : null}
          {c && c.balance > 0 && row.family ? <RecordPaymentButton families={families} today={today} preset={row.family} label={t.recordPayment} /> : null}
        </>
      ) : mode === "discount" ? (
        <>
          <Button variant="ghost" onClick={() => setMode("view")}>{m.common.cancel}</Button>
          <Button pending={saveDisc.pending} disabled={discount === null} onClick={() => saveDisc.run({ chargeId: cell.id, discount: discount ?? 0, note })}>{m.common.save}</Button>
        </>
      ) : (
        <>
          <Button variant="ghost" onClick={() => setMode("view")}>{m.common.cancel}</Button>
          <Button variant="danger" pending={cancel.pending} onClick={() => cancel.run({ chargeId: cell.id, reason })}>{t.cancel}</Button>
        </>
      )}>
      {!c ? <p className="text-ink-3">…</p> : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold">{row.name}</p>
            <ChargeStateChip state={c.state} dueOn={c.due_on} today={today} size="md" />
          </div>
          <DataList items={[
            { label: t.gross, value: <Money value={c.amount} /> },
            ...(c.discount ? [{ label: t.discount, value: <span><Money value={-c.discount} />{c.discount_note ? <span className="ml-2 font-normal text-ink-3">{c.discount_note}</span> : null}</span> }] : []),
            { label: t.net, value: <Money value={c.net} /> },
            { label: t.paid, value: <Money value={c.paid} /> },
            { label: t.balance, value: <Money value={c.balance} /> },
            { label: m.common.due, value: formatDateShort(c.due_on) },
            { label: t.payer, value: c.guardians ? `${c.guardians.full_name}${c.guardians.payment_ref ? ` · ${c.guardians.payment_ref}` : ""}` : m.common.none },
          ]} />
          {mode === "view" ? (
            <section>
              <h3 className="mb-2 font-semibold">{t.payments}</h3>
              {detail.payments.length === 0 ? <p className="text-ink-3">{t.noPayments}</p> : (
                <ul className="divide-y divide-line rounded-[var(--radius-control)] border border-line">
                  {detail.payments.map((p) => (
                    <li key={p.id} className="flex justify-between gap-3 px-3 py-2">
                      <span>{formatDateShort(p.received_on)} · {PAYMENT_METHOD_LABELS[p.method] ?? p.method}{p.payer_name ? ` · ${p.payer_name}` : ""}</span>
                      <Money value={p.amount} className="font-semibold" />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : mode === "discount" ? (
            <div className="space-y-3">
              <Field label={t.discountLabel}><MoneyInput value={discount} onChange={setDiscount} /></Field>
              <Field label={t.discountNote} optional><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} /></Field>
              <FormError>{saveDisc.error}</FormError>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-ink-3">{t.cancelHint}</p>
              <Field label={t.cancelReason}><Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} /></Field>
              <FormError>{cancel.error}</FormError>
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
