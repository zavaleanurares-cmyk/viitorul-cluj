import "server-only";
import { PaymentConfigError, type PaymentAdapter } from "./types";
import { testAdapter } from "./test-adapter";

/**
 * Operatorii disponibili. Pentru un operator real (Stripe, Netopia, EuPlatesc): un fișier nou care
 * implementează PaymentAdapter, adăugat aici, plus cheile lui în variabilele de mediu. Registrul,
 * ecranele și testele rămân neschimbate.
 */
/**
 * Operatorul de test („plătește" cu un card inventat) e disponibil în dezvoltare și, în producție, DOAR cu
 * PAYMENTS_TEST_MODE=1 (pilot). Altfel un părinte ar putea marca o taxă plătită fără să plătească.
 */
export const testPaymentsEnabled = () => process.env.PAYMENTS_TEST_MODE === "1" || process.env.NODE_ENV !== "production";

const ADAPTERS = (): Record<string, PaymentAdapter> => (testPaymentsEnabled() ? { test: testAdapter } : {});

export function getAdapter(provider: string): PaymentAdapter {
  const a = ADAPTERS()[provider];
  if (!a) throw new PaymentConfigError(`Operatorul de plăți „${provider}" nu este configurat.`);
  return a;
}

export function providerAvailable(provider: string | null | undefined): boolean {
  return !!provider && provider in ADAPTERS();
}

export function availableProviders(): Array<{ id: string; label: string; test: boolean }> {
  return Object.values(ADAPTERS()).map((a) => ({ id: a.id, label: a.label, test: a.test }));
}
