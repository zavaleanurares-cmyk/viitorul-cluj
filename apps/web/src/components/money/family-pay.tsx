"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, CircleAlert, CircleCheck, Copy, CreditCard, FileDown, Landmark, Loader2 } from "lucide-react";
import { diffDays, formatDateShort, formatIban, formatLei } from "@club/shared";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Notice } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { cn } from "@/lib/cn";
import { intentStatus, removeCard, setAutoPay, startCheckout } from "@/app/(app)/plati/actions";
import { Money } from "./bits";

export type DueCharge = { id: string; title: string; child: string; balance: number; due_on: string; discount_note: string | null };
export type Info = { beneficiary: string; iban: string | null; bank_name: string | null; online_enabled: boolean; provider: string; refs: Array<{ guardian_id: string; name: string; ref: string | null }> };
export type SavedCard = { id: string; label: string; auto_pay: boolean } | null;

function CopyButton({ value, label }: { value: string; label: string }) {
  const toast = useToast();
  const t = useT().money.family;
  return (
    <button type="button" aria-label={`${t.copy}: ${label}`} onClick={() => navigator.clipboard?.writeText(value).then(() => toast(t.copied)).catch(() => {})}
      className="inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-line bg-sunken transition-colors">
      <Copy className="size-5" aria-hidden />
    </button>
  );
}

/** Rezultatul unei plăți online: așteptăm confirmarea operatorului (webhook), apoi arătăm reușita sau motivul. */
export function PaymentResult({ intentId }: { intentId: string }) {
  const t = useT().money.family;
  const router = useRouter();
  const [state, setState] = useState<{ status: string; failure: string | null; paymentId: string | null } | null>(null);
  const check = useAction(intentStatus, { successMessage: false, refresh: false });
  useEffect(() => {
    let alive = true;
    let tries = 0;
    const tick = async () => {
      const r = await check.run({ intentId });
      if (!alive || !r.ok) return;
      setState(r.data);
      if (r.data.status === "succeeded") router.refresh();
      else if (r.data.status === "pending" && ++tries < 20) setTimeout(tick, 1500);
    };
    tick();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intentId]);
  if (!state || state.status === "pending" || state.status === "created") {
    return <Notice tone="blue" title={t.resultPending}><Loader2 className="size-5 animate-spin" aria-hidden /></Notice>;
  }
  if (state.status === "succeeded") {
    return (
      <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] bg-st-green-soft px-4 py-6 text-center" role="status">
        <span aria-hidden className="inline-flex size-14 items-center justify-center rounded-full bg-st-green text-white"><CircleCheck className="size-8" /></span>
        <p className="text-xl font-bold">{t.resultOk}</p>
        <p className="text-ink-2">{t.resultOkText}</p>
        {state.paymentId ? <a href={`/api/bani/dovada/${state.paymentId}`} className="mt-1 inline-flex h-11 items-center gap-2 rounded-full bg-sunken px-4 font-medium"><FileDown className="size-5" aria-hidden />{t.confirmation}</a> : null}
      </div>
    );
  }
  return (
    <Notice tone="red" title={t.resultFailed}>{t.resultFailedText(state.failure ?? "")}</Notice>
  );
}

/** „De plată acum": taxele de bifat și plata online într-un singur buton. */
export function DueNow({ charges, today, info, savedCard, canSaveCard }: { charges: DueCharge[]; today: string; info: Info; savedCard: SavedCard; canSaveCard: boolean }) {
  const m = useT().money;
  const t = m.family;
  const [picked, setPicked] = useState<Set<string>>(() => new Set(charges.map((c) => c.id)));
  const [save, setSave] = useState(false);
  const total = useMemo(() => charges.filter((c) => picked.has(c.id)).reduce((s, c) => s + c.balance, 0), [charges, picked]);
  const pay = useAction(startCheckout, { successMessage: false, refresh: false, onSuccess: (r) => { window.location.href = r.url; } });
  if (!charges.length) {
    return (
      <Card>
        <CardBody className="flex items-center gap-3">
          <span aria-hidden className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-st-green text-white"><CircleCheck className="size-7" /></span>
          <div><p className="text-lg font-bold">{t.allPaid}</p><p className="text-ink-3">{t.allPaidText}</p></div>
        </CardBody>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader title={t.dueNow} description={<span className="text-2xl font-bold text-ink"><Money value={charges.reduce((s, c) => s + c.balance, 0)} /></span>} />
      <CardBody className="space-y-3">
        <ul className="divide-y divide-line border-y border-line">
          {charges.map((c) => {
            const late = c.due_on < today ? diffDays(c.due_on, today) : null;
            return (
              <li key={c.id}>
                <label className="flex min-h-16 cursor-pointer items-center gap-3 py-2">
                  <input type="checkbox" className="size-6 shrink-0 accent-[var(--color-brand)]" checked={picked.has(c.id)}
                    onChange={(e) => { const n = new Set(picked); if (e.target.checked) n.add(c.id); else n.delete(c.id); setPicked(n); }} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{c.title}</span>
                    <span className="block text-sm text-ink-3">{c.child}{c.discount_note ? ` · ${c.discount_note}` : ""}</span>
                    <span className={cn("mt-0.5 inline-flex items-center gap-1 text-sm font-semibold", late !== null ? "text-st-red" : "text-ink-2")}>
                      {late !== null ? <CircleAlert className="size-4" aria-hidden /> : null}
                      {late !== null ? t.overdueDays(late) : t.dueOn(formatDateShort(c.due_on))}
                    </span>
                  </span>
                  <Money value={c.balance} className="font-bold" />
                </label>
              </li>
            );
          })}
        </ul>
        {info.online_enabled ? (
          <>
            {canSaveCard && !savedCard ? <Checkbox label={t.saveCard} checked={save} onChange={(e) => setSave(e.target.checked)} /> : null}
            <Button size="lg" className="w-full" disabled={total <= 0} pending={pay.pending} icon={<CreditCard className="size-5" aria-hidden />}
              onClick={() => pay.run({ chargeIds: [...picked], saveMethod: save })}>
              {total > 0 ? t.payButton(formatLei(total)) : t.paySelected}
            </Button>
            {info.provider === "test" ? <p className="text-center text-sm text-ink-3">{m.common.testMode}</p> : null}
          </>
        ) : <Notice tone="gray">{t.onlineOff}</Notice>}
      </CardBody>
    </Card>
  );
}

export function HowToPay({ info, savedCard }: { info: Info; savedCard: SavedCard }) {
  const t = useT().money.family;
  const auto = useAction(setAutoPay);
  const remove = useAction(removeCard);
  return (
    <Card>
      <CardHeader title={t.howToPay} />
      <CardBody className="space-y-5">
        {info.online_enabled ? (
          <section className="space-y-2">
            <h3 className="flex items-center gap-2 font-semibold"><CreditCard className="size-5" aria-hidden />{t.online}</h3>
            {savedCard ? (
              <div className="space-y-2 rounded-[var(--radius-control)] border border-line p-3">
                <p className="font-semibold">{t.savedCard(savedCard.label)}</p>
                <label className="flex min-h-12 cursor-pointer items-start gap-3">
                  <input type="checkbox" role="switch" className="mt-1 size-6 shrink-0 accent-[var(--color-brand)]" checked={savedCard.auto_pay} disabled={auto.pending}
                    onChange={(e) => auto.run({ methodId: savedCard.id, on: e.target.checked })} />
                  <span><span className="block font-semibold">{t.autoPay}</span><span className="block text-sm text-ink-3">{t.autoPayText}</span></span>
                </label>
                <Button variant="ghost" size="sm" pending={remove.pending} onClick={() => remove.run({ methodId: savedCard.id })}>{t.removeCard}</Button>
              </div>
            ) : null}
          </section>
        ) : null}
        {info.iban ? (
          <section className="space-y-2">
            <h3 className="flex items-center gap-2 font-semibold"><Landmark className="size-5" aria-hidden />{t.bank}</h3>
            <dl className="space-y-2">
              <div><dt className="text-sm text-ink-3">{t.beneficiary}</dt><dd className="font-semibold">{info.beneficiary}</dd></div>
              <div>
                <dt className="text-sm text-ink-3">{t.iban}{info.bank_name ? ` · ${info.bank_name}` : ""}</dt>
                <dd className="flex items-center gap-2"><span className="min-w-0 break-all font-semibold tabular-nums">{formatIban(info.iban)}</span><CopyButton value={info.iban} label={t.iban} /></dd>
              </div>
              {info.refs.filter((r) => r.ref).map((r) => (
                <div key={r.guardian_id}>
                  <dt className="text-sm text-ink-3">{t.reference}</dt>
                  <dd className="flex items-center gap-2"><span className="text-xl font-bold tracking-wide">{r.ref}</span><CopyButton value={r.ref!} label={t.reference} /></dd>
                  <dd className="text-sm text-ink-3">{t.referenceHint}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
        <section className="space-y-1">
          <h3 className="flex items-center gap-2 font-semibold"><Banknote className="size-5" aria-hidden />{t.cash}</h3>
          <p className="text-sm text-ink-3">{t.cashText}</p>
        </section>
      </CardBody>
    </Card>
  );
}
