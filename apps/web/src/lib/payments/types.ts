/**
 * Stratul de plăți online. Registrul (charges / payments / allocations) nu știe nimic despre operator;
 * fiecare operator (Stripe, Netopia, EuPlatesc…) este un adaptor cu aceeași interfață, ales din setările
 * financiare ale clubului. Schimbarea operatorului = un adaptor nou + o setare, nu o rescriere.
 *
 * Sumele sunt în bani (întregi). Rezultatul unei plăți ajunge DOAR prin webhook (parseWebhook → apply_provider_event),
 * niciodată din redirecționarea browserului: părintele poate închide pagina, operatorul tot ne anunță.
 */
export type CheckoutInput = {
  intentId: string;
  amount: number;
  currency: string;
  description: string;
  payer: { name: string | null; email: string | null };
  saveMethod: boolean;
  /** unde se întoarce părintele după plată (operatorul adaugă starea, dacă vrea) */
  returnUrl: string;
};

export type CheckoutResult = { providerRef: string; url: string };

export type ProviderEventType = "payment.succeeded" | "payment.failed" | "refund.succeeded";

/** Evenimentul operatorului, verificat și tradus în forma standard (ce primește apply_provider_event). */
export type ProviderEvent = {
  provider: string;
  event_id: string;
  type: ProviderEventType;
  intent_id?: string;
  intent_ref?: string;
  payment_ref: string;
  amount: number;
  occurred_at: string;
  method?: { ref: string; label: string };
  reason?: string;
};

export type Payout = { id: string; amount: number; arrival_date: string; status: string };

export interface PaymentAdapter {
  /** cheia din finance_settings.provider */
  readonly id: string;
  readonly label: string;
  /** „mod de test": nu se mișcă bani reali */
  readonly test: boolean;
  /** poate salva un card / mandat pentru plata automată lunară */
  readonly supportsSavedMethods: boolean;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
  /** încasează cu metoda salvată; rezultatul vine prin webhook */
  chargeSaved(input: { intentId: string; amount: number; currency: string; methodRef: string; description: string }): Promise<{ providerRef: string }>;
  /** returnare totală sau parțială; rezultatul vine prin webhook */
  refund(input: { paymentRef: string; amount: number }): Promise<void>;
  /** verifică semnătura și întoarce evenimentele în forma standard; aruncă eroare dacă cererea nu e autentică */
  parseWebhook(request: Request): Promise<ProviderEvent[]>;
  /** transferurile operatorului în contul clubului, pentru potrivirea cu extrasul */
  payouts(range: { from: string; to: string }): Promise<Payout[]>;
}

export class PaymentConfigError extends Error {}
