import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@club/shared";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/** Client Supabase pentru componente server, acțiuni și rute — rulează cu sesiunea utilizatorului (RLS). */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        } catch {
          // apelat dintr-o componentă server: cookie-urile se reîmprospătează în proxy.ts
        }
      },
    },
  });
}
