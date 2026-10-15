import "server-only";
import { createServiceDb } from "@club/db";
import { getAdapter } from "./registry";

/**
 * Primește evenimentele unui operator: verifică semnătura (adaptorul), apoi le aplică în registru,
 * fiecare idempotent (provider_events). Un răspuns de eroare face operatorul să reîncerce mai târziu.
 */
export async function processWebhook(provider: string, request: Request): Promise<{ ok: true; applied: number } | { ok: false; status: number; error: string }> {
  let events;
  try {
    events = await getAdapter(provider).parseWebhook(request);
  } catch (e) {
    return { ok: false, status: 400, error: (e as Error).message };
  }
  const admin = createServiceDb();
  let applied = 0;
  for (const event of events) {
    const { error } = await admin.rpc("apply_provider_event", { p: event });
    if (error) {
      console.error("[plăți] eveniment neaplicat:", event.type, event.event_id, error.message);
      return { ok: false, status: 500, error: error.message };
    }
    applied++;
  }
  return { ok: true, applied };
}
