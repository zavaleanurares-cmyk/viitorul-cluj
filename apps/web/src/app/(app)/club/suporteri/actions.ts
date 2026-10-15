"use server";
import { z } from "zod";
import { parseLei } from "@club/shared";
import { fail, run } from "@/lib/actions";
import { deleteFiles } from "@/lib/storage";

const OFFICE = ["admin", "secretary", "accountant"] as const;
const PATHS = ["/club/suporteri"];

export async function saveCampaign(input: { id?: string; incomeYear: number; title: string; goal: string; deadline: string; active: boolean }) {
  return run<{ id: string }>({ roles: [...OFFICE], revalidate: PATHS }, async ({ db }) => {
    const v = z.object({ id: z.uuid().optional(), incomeYear: z.number().int().min(2020).max(2100), title: z.string().trim().min(3).max(120),
      goal: z.string().max(6), deadline: z.union([z.iso.date(), z.literal("")]), active: z.boolean() }).parse(input);
    const { data, error } = await db.rpc("save_campaign", { p: { id: v.id ?? "", income_year: v.incomeYear, title: v.title, goal: v.goal, deadline: v.deadline, is_active: v.active } });
    if (error) throw error;
    return { id: data as string };
  });
}

export async function savePledge(input: { id?: string; name: string; email: string; phone: string; twoYears: boolean; status: "started" | "received" | "submitted"; notes: string }) {
  return run({ roles: [...OFFICE], revalidate: PATHS }, async ({ db }) => {
    const v = z.object({ id: z.uuid().optional(), name: z.string().trim().min(3).max(160), email: z.union([z.email(), z.literal("")]), phone: z.string().max(20),
      twoYears: z.boolean(), status: z.enum(["started", "received", "submitted"]), notes: z.string().max(500) }).parse(input);
    const { error } = await db.rpc("save_pledge", { p: { id: v.id ?? "", full_name: v.name, email: v.email, phone: v.phone, two_years: v.twoYears, status: v.status, notes: v.notes } });
    if (error) throw error;
    return null;
  });
}

export async function setPledgesStatus(input: { ids: string[]; status: "started" | "received" | "submitted" }) {
  return run<number>({ roles: [...OFFICE], revalidate: PATHS }, async ({ db }) => {
    const v = z.object({ ids: z.array(z.uuid()).min(1).max(2000), status: z.enum(["started", "received", "submitted"]) }).parse(input);
    const { data, error } = await db.rpc("set_pledges_status", { p_ids: v.ids, p_status: v.status });
    if (error) throw error;
    return data as number;
  });
}

export async function deletePledge(id: string) {
  return run({ roles: [...OFFICE], revalidate: PATHS }, async ({ db }) => {
    const { error } = await db.rpc("delete_pledge", { p_id: z.uuid().parse(id) });
    if (error) throw error;
    return null;
  });
}

const Sponsor = z.object({
  id: z.uuid().optional(), name: z.string().trim().min(2).max(160), fiscalCode: z.string().max(20), contactName: z.string().max(120),
  email: z.union([z.email(), z.literal("")]), phone: z.string().max(20), kind: z.enum(["money", "goods", "services"]), amount: z.string().max(20),
  status: z.enum(["prospect", "negotiating", "signed", "paid", "ended"]), startsOn: z.union([z.iso.date(), z.literal("")]), endsOn: z.union([z.iso.date(), z.literal("")]),
  tier: z.enum(["main", "partner", "supporter"]), url: z.union([z.string().regex(/^https:\/\//), z.literal("")]), logoPath: z.string().max(300).nullable(),
  showOnSite: z.boolean(), notes: z.string().max(2000),
});
export type SponsorInput = z.input<typeof Sponsor>;

export async function saveSponsor(input: SponsorInput) {
  return run<{ id: string }>({ roles: [...OFFICE], revalidate: [...PATHS, "/c"] }, async ({ db }) => {
    const r = Sponsor.safeParse(input);
    if (!r.success) fail(r.error.issues[0]?.path[0] === "url" ? "Adresa trebuie să înceapă cu https://" : "Completează numele firmei.");
    const v = r.data;
    const amount = v.amount.trim() ? parseLei(v.amount) : null;
    if (v.amount.trim() && (amount === null || amount < 0)) fail("Suma nu e validă.");
    const before = v.id ? (await db.from("sponsors").select("logo_path").eq("id", v.id).maybeSingle()).data : null;
    const { data, error } = await db.rpc("save_sponsor", { p: {
      id: v.id ?? "", name: v.name, fiscal_code: v.fiscalCode, contact_name: v.contactName, email: v.email, phone: v.phone, kind: v.kind,
      amount: amount ?? "", status: v.status, starts_on: v.startsOn, ends_on: v.endsOn, tier: v.tier, url: v.url, logo_path: v.logoPath ?? "",
      show_on_site: v.showOnSite, notes: v.notes,
    } });
    if (error) throw error;
    if (before?.logo_path && before.logo_path !== v.logoPath) await deleteFiles(db, "site", [before.logo_path]);
    return { id: data as string };
  });
}

export async function deleteSponsor(id: string) {
  return run({ roles: [...OFFICE], revalidate: PATHS }, async ({ db }) => {
    const { data: s } = await db.from("sponsors").select("logo_path").eq("id", z.uuid().parse(id)).maybeSingle();
    if (s?.logo_path) await deleteFiles(db, "site", [s.logo_path]);
    const { error } = await db.rpc("delete_sponsor", { p_id: id });
    if (error) throw error;
    return null;
  });
}
