"use server";
import { z } from "zod";
import { createServiceDb } from "@club/db";
import { fail, run } from "@/lib/actions";
import { SITE_URL } from "@/lib/env";
import { getAdapter } from "@/lib/payments/registry";
import { completeTestCheckout } from "@/lib/payments/test-adapter";
import { getT } from "@/messages";

const FAMILY = ["guardian", "player"] as const;

/** Părintele alege taxele și pornește plata: intenția în registru, apoi pagina operatorului. */
export async function startCheckout(input: { chargeIds: string[]; saveMethod: boolean }) {
  return run<{ url: string }>({ roles: [...FAMILY] }, async ({ db, ctx }) => {
    const ids = z.array(z.uuid()).min(1, "Alege ce plătești.").max(40).parse(input.chargeIds);
    const { data, error } = await db.rpc("create_payment_intent", { p_charge_ids: ids, p_save_method: !!input.saveMethod });
    if (error) fail(error.message);
    const intent = data as { id: string; amount: number; provider: string; currency: string };
    const adapter = getAdapter(intent.provider);
    const checkout = await adapter.createCheckout({
      intentId: intent.id, amount: intent.amount, currency: intent.currency, description: getT().money.family.title,
      payer: { name: ctx.profile.full_name, email: ctx.profile.email ?? null }, saveMethod: !!input.saveMethod && adapter.supportsSavedMethods,
      returnUrl: `${SITE_URL}/plati?plata=${intent.id}`,
    });
    const { error: e2 } = await createServiceDb().rpc("attach_intent_checkout", { p_intent: intent.id, p_provider_ref: checkout.providerRef, p_url: checkout.url });
    if (e2) fail(e2.message);
    return { url: checkout.url };
  });
}

export async function intentStatus(input: { intentId: string }) {
  return run<{ status: string; failure: string | null; paymentId: string | null }>({ roles: [...FAMILY] }, async ({ db }) => {
    const { data } = await db.from("payment_intents").select("status, failure, payment_id").eq("id", z.uuid().parse(input.intentId)).maybeSingle();
    if (!data) fail("Plată necunoscută.");
    return { status: data.status, failure: data.failure, paymentId: data.payment_id };
  });
}

export async function setAutoPay(input: { methodId: string; on: boolean }) {
  const t = getT().money.family;
  return run({ roles: ["guardian"], revalidate: ["/plati"], message: input.on ? t.autoPayOn : t.autoPayOff }, async ({ db }) => {
    const { error } = await db.rpc("set_auto_pay", { p_method: z.uuid().parse(input.methodId), p_on: !!input.on });
    if (error) fail(error.message);
    return null;
  });
}

export async function removeCard(input: { methodId: string }) {
  return run({ roles: ["guardian"], revalidate: ["/plati"], message: getT().money.family.cardRemoved }, async ({ db }) => {
    const { error } = await db.rpc("revoke_payment_method", { p_method: z.uuid().parse(input.methodId) });
    if (error) fail(error.message);
    return null;
  });
}

/** Pagina operatorului de test: „plătește" cu un card de test. Rezultatul ajunge prin webhook, ca la un operator real. */
export async function payWithTestCard(input: { intentId: string; card: string }) {
  return run<{ ok: boolean; reason?: string }>({ roles: [...FAMILY] }, async ({ db }) => {
    const id = z.uuid().parse(input.intentId);
    const { data: intent } = await db.from("payment_intents").select("id, provider, provider_ref, amount, status, save_method").eq("id", id).maybeSingle();
    if (!intent) fail("Plată necunoscută.");
    if (intent.provider !== "test" || !intent.provider_ref) fail("Plata nu este la operatorul de test.");
    if (intent.status !== "pending") fail(getT().money.testCheckout.alreadyDone);
    return completeTestCheckout({ intentId: intent.id, intentRef: intent.provider_ref, amount: intent.amount, card: z.string().max(30).parse(input.card), saveMethod: intent.save_method });
  });
}
