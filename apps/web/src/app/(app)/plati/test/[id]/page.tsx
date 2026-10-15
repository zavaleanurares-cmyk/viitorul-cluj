import { notFound } from "next/navigation";
import { formatLei } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { Notice } from "@/components/ui/card";
import { TestCheckoutForm } from "@/components/money/test-checkout";
import { getT } from "@/messages";
import { testPaymentsEnabled } from "@/lib/payments/registry";

export const metadata = { title: "Plată de test" };

/** Pagina operatorului de test (în producție, aici ar fi pagina operatorului real). */
export default async function TestCheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { db } = await requireCapability("familyPayments");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const t = getT().money.testCheckout;
  const { data: intent } = await db.from("payment_intents").select("id, amount, status, provider").eq("id", id).maybeSingle();
  if (!intent || intent.provider !== "test" || !testPaymentsEnabled()) notFound();
  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl">{t.title}</h1>
      <Notice tone="yellow">{t.banner}</Notice>
      {intent.status !== "pending" ? <Notice tone="gray">{t.alreadyDone}</Notice> : (
        <>
          <p className="text-ink-3">{t.amount}</p>
          <p className="-mt-3 text-3xl font-bold tabular-nums">{formatLei(intent.amount, { decimals: "always" })}</p>
          <TestCheckoutForm intentId={intent.id} amount={intent.amount} />
        </>
      )}
    </div>
  );
}
