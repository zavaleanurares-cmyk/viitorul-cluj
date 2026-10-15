"use server";
import { z } from "zod";
import { fail, run } from "@/lib/actions";
import { getT } from "@/messages";

const ROLES = ["admin", "accountant"] as const;
const paths = ["/bani/prime"];

const Rule = z.object({
  name: z.string().trim().min(1, "Scrie numele regulii.").max(80),
  target: z.enum(["player", "staff"]),
  trigger: z.enum(["win", "draw", "goal", "clean_sheet", "appearance", "starter"]),
  amount: z.number().int().positive("Scrie suma.").max(100_000_000),
  group_id: z.uuid().nullable(),
  competition_id: z.uuid().nullable(),
});

export async function saveBonusRule(input: z.input<typeof Rule>) {
  return run({ roles: [...ROLES], revalidate: paths, message: getT().money.plans.saved }, async ({ db, ctx }) => {
    const r = Rule.parse(input);
    if (r.target === "staff" && !["win", "draw", "clean_sheet"].includes(r.trigger)) fail("Pentru antrenori, primele se dau pe rezultat (victorie, egal, fără gol primit).");
    const { error } = await db.from("bonus_rules").insert({ ...r, club_id: ctx.club.id });
    if (error) fail(error.message);
    return null;
  });
}

export async function deleteBonusRule(input: { id: string }) {
  return run({ roles: [...ROLES], revalidate: paths }, async ({ db }) => {
    const { error } = await db.from("bonus_rules").update({ deleted_at: new Date().toISOString(), is_active: false }).eq("id", z.uuid().parse(input.id));
    if (error) fail(error.message);
    return null;
  });
}

export async function computeBonuses(input: { from: string; to: string }) {
  return run<number>({ roles: [...ROLES], revalidate: paths }, async ({ db }) => {
    const { data, error } = await db.rpc("compute_bonuses", { p_from: z.iso.date().parse(input.from), p_to: z.iso.date().parse(input.to) });
    if (error) fail(error.message);
    return (data as number) ?? 0;
  });
}

export async function decideBonuses(input: { ids: string[]; status: "approved" | "paid" | "cancelled" }) {
  return run<number>({ roles: [...ROLES], revalidate: paths }, async ({ db }) => {
    const { data, error } = await db.rpc("decide_bonus_entries", { p_ids: z.array(z.uuid()).min(1).max(500).parse(input.ids), p_status: input.status });
    if (error) fail(error.message);
    return (data as number) ?? 0;
  });
}
