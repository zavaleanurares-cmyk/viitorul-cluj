import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { createAnonDb } from "@club/db";

export type PublicClub = {
  id: string; slug: string; name: string; short_name: string; has_logo: boolean;
  primary_color: string; accent_color: string;
  site: Record<string, unknown>;
  groups: Array<{ id: string; name: string; from: number | null; to: number | null }>;
};

/** Clubul pentru paginile publice (fără sesiune), o dată pe cerere. */
export const getPublicClub = cache(async (slug: string): Promise<PublicClub | null> => {
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) return null;
  const { data } = await createAnonDb().rpc("public_club", { p_slug: slug });
  return (data as PublicClub | null) ?? null;
});

/** Secțiunile site-ului: implicit pornite, mai puțin cele care cer conținut. */
export function siteOn(club: PublicClub, key: string, fallback = true): boolean {
  const v = club.site[key];
  return typeof v === "boolean" ? v : fallback;
}

/** IP-ul vizitatorului (pentru limitarea trimiterilor; în baza de date ajunge doar amprentat). */
export async function visitorIp(): Promise<string | null> {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || null;
}

/** Clubul are o politică de confidențialitate publicată (linkul din subsol și din formulare). */
export const hasPolicy = cache(async (slug: string): Promise<boolean> => {
  const { data } = await createAnonDb().rpc("public_policy", { p_slug: slug });
  return ((data ?? []) as unknown[]).length > 0;
});
