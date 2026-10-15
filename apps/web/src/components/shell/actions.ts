"use server";
import { z } from "zod";
import { run, fail } from "@/lib/actions";

export type SearchResults = {
  players: Array<{ id: string; display_name: string; full_name: string; shirt_number: number | null; team: string | null }>;
  teams: Array<{ id: string; name: string }>;
  events: Array<{ id: string; kind: string; title: string; starts_at: string }>;
  guardians: Array<{ id: string; full_name: string; phone: string | null }>;
};

const Query = z.string().trim().min(2).max(80);

/** Căutarea globală: rulează cu identitatea utilizatorului, deci întoarce doar ce poate vedea. */
export async function searchClub(query: string) {
  return run<SearchResults>({}, async ({ db }) => {
    const q = Query.parse(query);
    const { data, error } = await db.rpc("search_club", { p_query: q, p_limit: 6 });
    if (error) throw error;
    const r = (data ?? {}) as Partial<SearchResults>;
    return { players: r.players ?? [], teams: r.teams ?? [], events: r.events ?? [], guardians: r.guardians ?? [] };
  });
}

/** Trece contul pe alt club sau alt rol (dacă are mai multe). */
export async function switchMembership(membershipId: string) {
  return run({ revalidate: ["/", "/azi"] }, async ({ db }) => {
    const id = z.uuid().parse(membershipId);
    const { error } = await db.rpc("switch_membership", { p_membership: id });
    if (error) fail(error.message);
    return null;
  });
}
