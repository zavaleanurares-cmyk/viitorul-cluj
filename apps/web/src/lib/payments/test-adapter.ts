import "server-only";
import crypto from "node:crypto";
import type { CheckoutInput, PaymentAdapter, ProviderEvent } from "./types";

/**
 * Operatorul de test: aceeași cale ca un operator real (pagină de plată → webhook semnat → registru),
 * fără bani reali. Pagina de plată este /plati/test/<intenție>; cardurile de test:
 *   4242 4242 4242 4242 → plată reușită
 *   4000 0000 0000 0002 → card refuzat
 *   4000 0000 0000 9995 → fonduri insuficiente
 * Webhook-ul este semnat HMAC-SHA256 cu PAYMENTS_WEBHOOK_SECRET (sau un secret aleator al procesului,
 * dacă lipsește: atunci doar procesul însuși poate livra evenimente, nimeni din afară).
 */
const SECRET = process.env.PAYMENTS_WEBHOOK_SECRET || crypto.randomBytes(32).toString("hex");
const SIGNATURE_HEADER = "x-test-signature";

export const TEST_CARDS: Record<string, { ok: boolean; reason?: string }> = {
  "4242424242424242": { ok: true },
  "4000000000000002": { ok: false, reason: "Cardul a fost refuzat de bancă." },
  "4000000000009995": { ok: false, reason: "Fonduri insuficiente." },
};

const id = (prefix: string) => `${prefix}_${crypto.randomBytes(9).toString("base64url")}`;

export function signTestPayload(body: string): string {
  return crypto.createHmac("sha256", SECRET).update(body).digest("hex");
}

/** Livrează evenimentele ca un operator: cerere semnată către propriul webhook (în același proces). */
async function deliver(events: ProviderEvent[]): Promise<void> {
  const body = JSON.stringify({ events });
  const request = new Request("http://intern/api/plati/webhook/test", {
    method: "POST",
    headers: { "content-type": "application/json", [SIGNATURE_HEADER]: signTestPayload(body) },
    body,
  });
  const { processWebhook } = await import("./webhook");
  const res = await processWebhook("test", request);
  if (!res.ok) throw new Error(`Webhook-ul de test a eșuat: ${res.error}`);
}

/** Folosit de pagina de plată de test: părintele „plătește" cu un card de test. */
export async function completeTestCheckout(input: { intentId: string; intentRef: string; amount: number; card: string; saveMethod: boolean }): Promise<{ ok: boolean; reason?: string }> {
  const digits = input.card.replace(/\D/g, "");
  const outcome = TEST_CARDS[digits] ?? { ok: false, reason: "Folosește unul dintre cardurile de test." };
  const now = new Date().toISOString();
  const event: ProviderEvent = outcome.ok
    ? {
        provider: "test", event_id: id("evt"), type: "payment.succeeded", intent_id: input.intentId, intent_ref: input.intentRef,
        payment_ref: id("pay"), amount: input.amount, occurred_at: now,
        method: input.saveMethod ? { ref: id("pm"), label: `Card •••• ${digits.slice(-4)}` } : undefined,
      }
    : {
        provider: "test", event_id: id("evt"), type: "payment.failed", intent_id: input.intentId, intent_ref: input.intentRef,
        payment_ref: id("pay"), amount: input.amount, occurred_at: now, reason: outcome.reason,
      };
  await deliver([event]);
  return outcome;
}

export const testAdapter: PaymentAdapter = {
  id: "test",
  label: "Operator de test",
  test: true,
  supportsSavedMethods: true,

  async createCheckout(input: CheckoutInput) {
    const providerRef = id("cs");
    return { providerRef, url: `/plati/test/${input.intentId}?ref=${encodeURIComponent(providerRef)}` };
  },

  async chargeSaved(input) {
    const providerRef = id("cs");
    const declined = input.methodRef.includes("decline");
    await deliver([{
      provider: "test", event_id: id("evt"), type: declined ? "payment.failed" : "payment.succeeded",
      intent_id: input.intentId, intent_ref: providerRef, payment_ref: id("pay"), amount: input.amount,
      occurred_at: new Date().toISOString(), reason: declined ? "Cardul salvat a fost refuzat." : undefined,
    }]);
    return { providerRef };
  },

  async refund(input) {
    await deliver([{
      provider: "test", event_id: id("evt"), type: "refund.succeeded", payment_ref: input.paymentRef,
      amount: input.amount, occurred_at: new Date().toISOString(),
    }]);
  },

  async parseWebhook(request) {
    const body = await request.text();
    const given = request.headers.get(SIGNATURE_HEADER) ?? "";
    const expected = signTestPayload(body);
    const a = Buffer.from(given, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error("Semnătură invalidă.");
    const parsed = JSON.parse(body) as { events?: ProviderEvent[] };
    return (parsed.events ?? []).filter((e) => e.provider === "test");
  },

  async payouts() {
    return [];
  },
};
