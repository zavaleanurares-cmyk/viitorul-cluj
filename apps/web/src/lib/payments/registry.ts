import "server-only";
import { PaymentConfigError, type PaymentAdapter } from "./types";
import { testAdapter } from "./test-adapter";

/**
 * Operatorii disponibili. Pentru un operator real (Stripe, Netopia, EuPlatesc): un fișier nou care
 * implementează PaymentAdapter, adăugat aici, plus cheile lui în variabilele de mediu. Registrul,
 * ecranele și testele rămân neschimbate.
 */
const ADAPTERS: Record<string, PaymentAdapter> = {
  test: testAdapter,
};

export function getAdapter(provider: string): PaymentAdapter {
  const a = ADAPTERS[provider];
  if (!a) throw new PaymentConfigError(`Operatorul de plăți „${provider}" nu este configurat.`);
  return a;
}

export function availableProviders(): Array<{ id: string; label: string; test: boolean }> {
  return Object.values(ADAPTERS).map((a) => ({ id: a.id, label: a.label, test: a.test }));
}
