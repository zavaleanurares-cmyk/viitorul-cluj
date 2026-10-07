"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@club/shared";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

/** Client Supabase pentru browser (încărcări de fișiere, linkuri semnate, schimbarea parolei). */
export function createClient() {
  client ??= createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
  return client;
}
