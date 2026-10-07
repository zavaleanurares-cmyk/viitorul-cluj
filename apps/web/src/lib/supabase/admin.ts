import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@club/shared";
import { SUPABASE_URL } from "./env";

/**
 * Client cu cheia de serviciu: OCOLEȘTE RLS. Se folosește numai pentru:
 *   - crearea / invitarea / dezactivarea conturilor (după ce am verificat că apelantul este preparator);
 *   - sarcinile programate (/api/cron).
 * Nu se importă niciodată într-o componentă client.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY lipsește din variabilele de mediu.");
  return createClient<Database>(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
