"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard } from "lucide-react";
import { formatLei } from "@club/shared";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { payWithTestCard } from "@/app/(app)/plati/actions";

export function TestCheckoutForm({ intentId, amount }: { intentId: string; amount: number }) {
  const t = useT().money.testCheckout;
  const router = useRouter();
  const [card, setCard] = useState("4242 4242 4242 4242");
  const pay = useAction(payWithTestCard, { successMessage: false, refresh: false, onSuccess: () => router.push(`/plati?plata=${intentId}`) });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); pay.run({ intentId, card }); }}>
      <Field label={t.card} hint={t.cards}><Input inputMode="numeric" autoComplete="off" value={card} onChange={(e) => setCard(e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label={t.expiry}><Input defaultValue="12/30" autoComplete="off" /></Field>
        <Field label={t.cvc}><Input defaultValue="123" inputMode="numeric" autoComplete="off" /></Field>
      </div>
      <FormError>{pay.error}</FormError>
      <Button type="submit" size="lg" className="w-full" pending={pay.pending} icon={<CreditCard className="size-5" aria-hidden />}>{t.pay(formatLei(amount))}</Button>
      <a href="/plati" className="block text-center font-semibold underline">{t.cancel}</a>
    </form>
  );
}
