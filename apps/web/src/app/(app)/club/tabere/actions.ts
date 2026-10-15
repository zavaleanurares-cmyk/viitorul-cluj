"use server";
import { z } from "zod";
import { parseLei } from "@club/shared";
import { fail, run } from "@/lib/actions";
import { getT } from "@/messages";

const t = getT().club.camps;
const OFFICE = ["admin", "secretary"] as const;
const paths = (id?: string) => ["/club/tabere", "/tabere", ...(id ? [`/club/tabere/${id}`] : [])];

const Camp = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(4000).optional(),
  location: z.string().trim().max(200).optional(),
  startsOn: z.iso.date(),
  endsOn: z.iso.date(),
  price: z.string().max(20),
  capacity: z.coerce.number().int().min(1).max(2000),
  yearFrom: z.union([z.coerce.number().int().min(1950).max(2100), z.literal("")]).optional(),
  yearTo: z.union([z.coerce.number().int().min(1950).max(2100), z.literal("")]).optional(),
  deadline: z.union([z.iso.date(), z.literal("")]).optional(),
  status: z.enum(["draft", "open", "closed", "cancelled"]),
  isPublic: z.boolean(),
});
export type CampInput = z.input<typeof Camp>;

export async function saveCamp(input: CampInput) {
  return run<{ id: string }>({ roles: [...OFFICE], revalidate: paths(input.id) }, async ({ db }) => {
    const r = Camp.safeParse(input);
    if (!r.success) fail(t.errors.invalid);
    const v = r.data;
    if (v.endsOn < v.startsOn) fail(t.errors.dates);
    const price = v.price.trim() ? parseLei(v.price) : 0;
    if (price === null || price < 0) fail(t.errors.price);
    const { data, error } = await db.rpc("save_camp", {
      p: {
        id: v.id ?? "", title: v.title, description: v.description ?? "", location: v.location ?? "", starts_on: v.startsOn, ends_on: v.endsOn,
        price, capacity: v.capacity, birth_year_from: v.yearFrom ?? "", birth_year_to: v.yearTo ?? "", deadline: v.deadline ?? "",
        status: v.status, is_public: v.isPublic,
      },
    });
    if (error) throw error;
    return { id: data as string };
  });
}

export async function confirmRegistration(input: { id: string; campId: string; playerId: string | null }) {
  return run({ roles: [...OFFICE], revalidate: paths(input.campId) }, async ({ db }) => {
    const v = z.object({ id: z.uuid(), campId: z.uuid(), playerId: z.uuid().nullable() }).parse(input);
    const { error } = await db.rpc("confirm_camp_registration", { p_id: v.id, p_player: v.playerId ?? undefined });
    if (error) throw error;
    return null;
  });
}

export async function waitlistRegistration(input: { id: string; campId: string }) {
  return run({ roles: [...OFFICE], revalidate: paths(input.campId) }, async ({ db }) => {
    const { error } = await db.rpc("waitlist_camp_registration", { p_id: z.uuid().parse(input.id) });
    if (error) throw error;
    return null;
  });
}

export async function setPaid(input: { id: string; campId: string; paid: boolean; note: string }) {
  return run({ roles: [...OFFICE], revalidate: paths(input.campId) }, async ({ db }) => {
    const v = z.object({ id: z.uuid(), paid: z.boolean(), note: z.string().max(200) }).parse(input);
    const { error } = await db.rpc("set_camp_paid", { p_id: v.id, p_paid: v.paid, p_note: v.note });
    if (error) throw error;
    return null;
  });
}

/** Anularea: biroul sau familia care a înscris (până la începerea taberei; verificat în baza de date). */
export async function cancelRegistration(input: { id: string; campId: string; reason: string }) {
  return run({ revalidate: [...paths(input.campId), "/azi", "/plati"] }, async ({ db }) => {
    const v = z.object({ id: z.uuid(), reason: z.string().max(500) }).parse(input);
    const { error } = await db.rpc("cancel_camp_registration", { p_id: v.id, p_reason: v.reason });
    if (error) throw error;
    return null;
  });
}

/** Familia (sau biroul, pentru un copil din club) înscrie la tabără. */
export async function registerCamp(input: { campId: string; playerId: string; notes: string }) {
  return run<string>({ revalidate: [...paths(input.campId), "/azi", "/plati"] }, async ({ db }) => {
    const v = z.object({ campId: z.uuid(), playerId: z.uuid(), notes: z.string().max(1000) }).parse(input);
    const { data, error } = await db.rpc("register_camp", { p_camp: v.campId, p_player: v.playerId, p_notes: v.notes });
    if (error) throw error;
    return data as string;
  });
}
