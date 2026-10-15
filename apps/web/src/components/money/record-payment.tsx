"use client";
import { useEffect, useMemo, useState } from "react";
import { Banknote, CreditCard, Landmark, Plus, Search, X } from "lucide-react";
import { formatDateShort, formatLei, norm, suggestAllocation } from "@club/shared";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Field, FormError, Input, Segmented } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { useToast } from "@/components/ui/toast";
import { useT } from "@/messages";
import { loadOpenCharges, recordPayment } from "@/app/(app)/bani/incasari/actions";
import { MoneyInput } from "./money-input";

export type Family = { guardianId: string | null; playerId: string | null; label: string; detail: string; ref: string | null; players: string[] };
type Open = { id: string; title: string; player: string; balance: number; due_on: string; period: string | null; issued_at: string };

/** Căutare de familie: nume părinte, nume copil sau cod de plată. */
export function FamilyPicker({ families, value, onChange, autoFocus }: { families: Family[]; value: Family | null; onChange: (f: Family | null) => void; autoFocus?: boolean }) {
  const t = useT().money.payments.form;
  const [q, setQ] = useState("");
  const hits = useMemo(() => {
    const n = norm(q);
    if (n.length < 2) return [];
    return families.filter((f) => norm(`${f.label} ${f.detail} ${f.ref ?? ""}`).includes(n)).slice(0, 8);
  }, [q, families]);
  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-[var(--radius-control)] border border-border-control bg-canvas px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{value.label}{value.ref ? <span className="ml-2 text-sm font-normal text-ink-3">{value.ref}</span> : null}</p>
          {value.detail ? <p className="truncate text-sm text-ink-3">{value.detail}</p> : null}
        </div>
        <button type="button" onClick={() => onChange(null)} aria-label={t.who} className="inline-flex size-10 items-center justify-center rounded-lg hover:bg-sunken">
          <X className="size-5" aria-hidden />
        </button>
      </div>
    );
  }
  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-ink-3" aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.whoPlaceholder} className="pl-10" autoFocus={autoFocus} aria-label={t.who} />
      </div>
      {q.trim().length >= 2 ? (
        <ul className="mt-2 divide-y divide-line overflow-hidden rounded-[var(--radius-control)] border border-line">
          {hits.length === 0 ? <li className="px-3 py-3 text-ink-3">{t.noResults}</li> : hits.map((f) => (
            <li key={f.guardianId ?? f.playerId}>
              <button type="button" onClick={() => { onChange(f); setQ(""); }} className="flex min-h-12 w-full flex-col items-start px-3 py-2 text-left hover:bg-canvas">
                <span className="font-semibold">{f.label}{f.ref ? <span className="ml-2 text-sm font-normal text-ink-3">{f.ref}</span> : null}</span>
                {f.detail ? <span className="text-sm text-ink-3">{f.detail}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Împărțirea unei sume pe taxele deschise (propunere automată, sume editabile). */
export function AllocationEditor({ open, amount, rows, onRows }: { open: Open[]; amount: number | null; rows: Record<string, number>; onRows: (r: Record<string, number>) => void }) {
  const t = useT().money.payments.form;
  const used = Object.values(rows).reduce((s, v) => s + (v || 0), 0);
  const left = (amount ?? 0) - used;
  if (!open.length) return <p className="text-ink-3">{t.noOpen}</p>;
  return (
    <div>
      <ul className="divide-y divide-line rounded-[var(--radius-control)] border border-line">
        {open.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{c.title}</p>
              <p className="text-sm text-ink-3">{c.player} · {formatDateShort(c.due_on)} · {formatLei(c.balance)}</p>
            </div>
            <MoneyInput value={rows[c.id] ?? 0} onChange={(v) => onRows({ ...rows, [c.id]: Math.min(v ?? 0, c.balance) })} className="w-36" aria-label={`${c.title}, ${c.player}`} />
          </li>
        ))}
      </ul>
      <p className={left < 0 ? "mt-2 font-semibold text-st-red" : "mt-2 text-ink-3"} role="status">
        {left < 0 ? t.over : left > 0 ? t.left(formatLei(left)) : null}
      </p>
    </div>
  );
}

/** Butonul + fereastra „Înregistrează o plată" (numerar, transfer, POS). */
export function RecordPaymentButton({ families, today, preset, label, variant = "primary", size = "md" }: {
  families: Family[]; today: string; preset?: Family | null; label?: string; variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md";
}) {
  const m = useT().money;
  const t = m.payments.form;
  const toast = useToast();
  const [openDlg, setOpenDlg] = useState(false);
  const [family, setFamily] = useState<Family | null>(preset ?? null);
  const [amount, setAmount] = useState<number | null>(null);
  const [method, setMethod] = useState<"cash" | "bank" | "card">("cash");
  const [date, setDate] = useState(today);
  const [payer, setPayer] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [charges, setCharges] = useState<Open[]>([]);
  const [rows, setRows] = useState<Record<string, number>>({});
  const load = useAction(loadOpenCharges, { successMessage: false, refresh: false });
  const save = useAction(recordPayment, {
    successMessage: false,
    onSuccess: (r) => {
      toast(r.receipt ? t.savedReceipt(r.receipt) : t.saved);
      setOpenDlg(false);
    },
  });

  useEffect(() => {
    if (!openDlg || !family) return;
    let alive = true;
    load.run({ playerIds: family.players }).then((res) => {
      if (!alive || !res.ok) return;
      setCharges(res.data);
      if (!payer) setPayer(family.label);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDlg, family]);

  const reset = () => {
    setFamily(preset ?? null); setAmount(null); setMethod("cash"); setDate(today); setPayer(""); setReference(""); setNote(""); setCharges([]); setRows({});
  };
  const onAmount = (v: number | null) => {
    setAmount(v);
    const s = suggestAllocation(v ?? 0, charges);
    setRows(Object.fromEntries(s.rows.map((r) => [r.charge_id, r.amount])));
  };
  const used = Object.values(rows).reduce((s, v) => s + (v || 0), 0);
  const valid = !!family && !!amount && amount > 0 && used <= amount;

  return (
    <>
      <Button variant={variant} size={size} icon={<Plus className="size-5" aria-hidden />} onClick={() => { reset(); setOpenDlg(true); }}>{label ?? m.payments.record}</Button>
      <Dialog open={openDlg} onClose={() => setOpenDlg(false)} title={t.title} wide
        footer={<>
          <Button variant="ghost" onClick={() => setOpenDlg(false)}>{m.common.cancel}</Button>
          <Button pending={save.pending} disabled={!valid} onClick={() => family && amount && save.run({
            method, amount, received_on: date, guardian_id: family.guardianId, player_id: family.playerId,
            payer_name: payer || undefined, reference: reference || undefined, note: note || undefined,
            allocations: Object.entries(rows).filter(([, v]) => v > 0).map(([charge_id, v]) => ({ charge_id, amount: v })),
          })}>{m.common.save}</Button>
        </>}>
        <div className="space-y-4">
          <Field label={t.who} hint={family ? undefined : t.whoHint}>
            <span className="block"><FamilyPicker families={families} value={family} onChange={(f) => { setFamily(f); setCharges([]); setRows({}); }} autoFocus={!preset} /></span>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.amount}><MoneyInput value={amount} onChange={onAmount} /></Field>
            <Field label={t.date}><Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} /></Field>
          </div>
          <div>
            <p className="mb-1 text-sm font-semibold text-ink-2">{t.method}</p>
            <Segmented label={t.method} value={method} onChange={setMethod} options={[
              { value: "cash", label: <span className="inline-flex items-center gap-2"><Banknote className="size-5" aria-hidden />{t.methods.cash}</span> },
              { value: "bank", label: <span className="inline-flex items-center gap-2"><Landmark className="size-5" aria-hidden />{t.methods.bank}</span> },
              { value: "card", label: <span className="inline-flex items-center gap-2"><CreditCard className="size-5" aria-hidden />{t.methods.card}</span> },
            ]} />
          </div>
          {method === "cash" ? (
            <Field label={t.payerName}><Input value={payer} onChange={(e) => setPayer(e.target.value)} maxLength={120} /></Field>
          ) : (
            <Field label={t.reference} optional><Input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={300} /></Field>
          )}
          {family ? (
            <section>
              <h3 className="font-semibold">{t.allocationTitle}</h3>
              <p className="mb-2 text-sm text-ink-3">{t.allocationHint}</p>
              {load.pending ? <p className="text-ink-3">…</p> : <AllocationEditor open={charges} amount={amount} rows={rows} onRows={setRows} />}
            </section>
          ) : null}
          <Field label={t.note} optional><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></Field>
          <FormError>{save.error}</FormError>
        </div>
      </Dialog>
    </>
  );
}
