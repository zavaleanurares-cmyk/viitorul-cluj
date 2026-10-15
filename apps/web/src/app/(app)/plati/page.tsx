import { FileDown } from "lucide-react";
import { formatDateShort, PAYMENT_METHOD_LABELS } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { Card, CardBody, CardHeader, Notice, PageHeader } from "@/components/ui/card";
import { Money } from "@/components/money/bits";
import { DueNow, HowToPay, PaymentResult, type DueCharge, type Info } from "@/components/money/family-pay";
import { getAdapter, providerAvailable } from "@/lib/payments/registry";
import { getT } from "@/messages";

export const metadata = { title: "Plăți" };

/** Plățile familiei: ce e de plată, cum se plătește, ce s-a plătit (cu chitanțe și dovezi). */
export default async function FamilyPaymentsPage({ searchParams }: { searchParams: Promise<{ plata?: string }> }) {
  const { db, ctx } = await requireCapability("familyPayments");
  const sp = await searchParams;
  const t = getT().money.family;
  const [info, charges, payments, methods] = await Promise.all([
    db.rpc("family_payment_info"),
    db.from("charge_balances").select("id, title, balance, due_on, discount_note, players(full_name)").eq("status", "open").gt("balance", 0).order("due_on"),
    db.from("payments").select("id, received_on, amount, method, status, refunded_amount, receipts(id, series, number, cancelled_at)").eq("status", "completed").order("received_on", { ascending: false }).limit(50),
    db.from("payment_methods").select("id, label, auto_pay, provider").is("revoked_at", null).limit(1),
  ]);
  const raw = (info.data ?? { beneficiary: ctx.club.name, iban: null, bank_name: null, online_enabled: false, provider: "test", refs: [] }) as Info;
  // plata online apare doar dacă operatorul clubului e instalat pe server
  const i: Info = { ...raw, online_enabled: raw.online_enabled && providerAvailable(raw.provider) };
  const due: DueCharge[] = (charges.data ?? []).map((c) => ({ id: c.id, title: c.title, child: (c.players as { full_name: string } | null)?.full_name ?? "", balance: c.balance, due_on: c.due_on, discount_note: c.discount_note }));
  const card = methods.data?.[0] ? { id: methods.data[0].id, label: methods.data[0].label, auto_pay: methods.data[0].auto_pay } : null;
  let canSaveCard = false;
  try { canSaveCard = ctx.role === "guardian" && getAdapter(i.provider).supportsSavedMethods; } catch { canSaveCard = false; }
  const intent = /^[0-9a-f-]{36}$/i.test(sp.plata ?? "") ? sp.plata! : null;
  const noFamily = ctx.role === "guardian" && i.refs.length === 0;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={t.title} />
      {intent ? <PaymentResult intentId={intent} /> : null}
      {noFamily ? <Notice tone="yellow">{t.noFamily}</Notice> : (
        <>
          <DueNow charges={due} today={ctx.today} info={i} savedCard={card} canSaveCard={canSaveCard} />
          <HowToPay info={i} savedCard={card} />
          <Card>
            <CardHeader title={t.history} />
            <CardBody>
              {(payments.data ?? []).length === 0 ? <p className="text-ink-3">{t.historyEmpty}</p> : (
                <ul className="divide-y divide-line">
                  {(payments.data ?? []).map((p) => {
                    type R = { id: string; series: string; number: number; cancelled_at: string | null };
                    const raw = p.receipts as unknown as R | R[] | null;
                    const r = (Array.isArray(raw) ? raw : raw ? [raw] : []).find((x) => !x.cancelled_at);
                    return (
                      <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold tabular-nums">{formatDateShort(p.received_on)}</span>
                          <span className="block text-sm text-ink-3">{PAYMENT_METHOD_LABELS[p.method] ?? p.method}</span>
                        </span>
                        <Money value={p.amount - p.refunded_amount} className="font-bold" />
                        <a href={r ? `/api/bani/chitanta/${r.id}` : `/api/bani/dovada/${p.id}`} className="inline-flex h-11 items-center gap-1 rounded-full px-3 text-sm font-medium hover:bg-line bg-sunken transition-colors">
                          <FileDown className="size-4" aria-hidden />{r ? t.receipt : t.confirmation}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
