"use server";
import { z } from "zod";
import type { Db } from "@club/shared";
import { fail, run } from "@/lib/actions";
import { getT } from "@/messages";

const FINANCE = ["admin", "secretary", "accountant"] as const;
const paths = ["/bani", "/bani/taxe", "/bani/incasari", "/azi", "/plati"];
const month = z.string().regex(/^\d{4}-\d{2}-01$/, "Alege luna.");
const bani = z.number().int().min(0).max(100_000_000);

export async function issueCharges(input: { period: string }) {
  return run<{ created: number; total: number }>({ roles: [...FINANCE], revalidate: paths }, async ({ db }) => {
    const { data, error } = await db.rpc("issue_monthly_charges", { p_period: month.parse(input.period) });
    if (error) fail(error.message);
    return data as { created: number; total: number };
  });
}

export async function remindOverdue() {
  return run<number>({ roles: [...FINANCE] }, async ({ db }) => {
    const { data, error } = await db.rpc("remind_overdue_families");
    if (error) fail(error.message);
    return (data as number) ?? 0;
  });
}

/** Detaliile unei taxe, pentru fereastra din grilă. */
export async function loadCharge(input: { chargeId: string }) {
  return run({ roles: [...FINANCE] }, async ({ db }) => {
    const id = z.uuid().parse(input.chargeId);
    const [c, allocs] = await Promise.all([
      db.from("charge_balances").select("*, players(full_name), guardians(full_name, payment_ref)").eq("id", id).maybeSingle(),
      db.from("allocations").select("amount, payments(id, received_on, method, payer_name, status)").eq("charge_id", id),
    ]);
    if (!c.data) fail("Taxă necunoscută.");
    return {
      charge: c.data,
      payments: (allocs.data ?? []).map((a) => ({ amount: a.amount, ...(a.payments as { id: string; received_on: string; method: string; payer_name: string | null; status: string }) })),
    };
  });
}

export async function cancelCharge(input: { chargeId: string; reason: string }) {
  return run({ roles: [...FINANCE], revalidate: paths, message: getT().money.charge.cancelled }, async ({ db }) => {
    const { error } = await db.rpc("cancel_charge", { p_charge: z.uuid().parse(input.chargeId), p_reason: z.string().max(300).parse(input.reason) });
    if (error) fail(error.message);
    return null;
  });
}

export async function setChargeDiscount(input: { chargeId: string; discount: number; note: string }) {
  return run({ roles: [...FINANCE], revalidate: paths, message: getT().money.charge.discountSaved }, async ({ db }) => {
    const { error } = await db.rpc("set_charge_discount", { p_charge: z.uuid().parse(input.chargeId), p_discount: bani.parse(input.discount), p_note: z.string().max(200).parse(input.note) });
    if (error) fail(error.message);
    return null;
  });
}

const Request = z.object({
  id: z.uuid().nullable(),
  title: z.string().trim().min(1, "Scrie pentru ce este plata.").max(120),
  description: z.string().max(1000).optional(),
  kind: z.enum(["one_off", "camp", "equipment", "insurance", "other"]),
  amount: z.number().int().positive("Suma trebuie să fie mai mare decât zero.").max(100_000_000),
  due_on: z.iso.date("Alege scadența."),
  player_ids: z.array(z.uuid()).max(1000),
});

export async function saveChargeRequest(input: z.input<typeof Request>) {
  return run<{ id: string; created: number }>({ roles: [...FINANCE], revalidate: [...paths, "/bani/taxe"] }, async ({ db }) => {
    const p = Request.parse(input);
    const { data, error } = await db.rpc("save_charge_request", { p });
    if (error) fail(error.message);
    return data as { id: string; created: number };
  });
}

export async function deleteChargeRequest(input: { id: string }) {
  return run({ roles: [...FINANCE], revalidate: paths }, async ({ db }) => {
    const id = z.uuid().parse(input.id);
    const { data: charges } = await db.from("charge_balances").select("id, paid").eq("request_id", id).eq("status", "open");
    if ((charges ?? []).some((c) => c.paid > 0)) fail("Cererea are plăți. Anulează întâi plățile sau taxele plătite.");
    for (const c of charges ?? []) {
      const { error } = await db.rpc("cancel_charge", { p_charge: c.id, p_reason: "Cerere ștearsă" });
      if (error) fail(error.message);
    }
    const { error } = await db.from("charge_requests").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) fail(error.message);
    return null;
  });
}

// ---------------------------------------------------------------------------
// Planuri de taxă și reduceri
// ---------------------------------------------------------------------------
/** Taxa unei echipe de la o lună: închide planul anterior în luna dinainte și deschide unul nou. */
export async function saveTeamFee(input: { groupId: string; amount: number; from: string }) {
  return run({ roles: [...FINANCE], revalidate: ["/bani/taxe"], message: getT().money.plans.saved }, async ({ db, ctx }) => {
    const groupId = z.uuid().parse(input.groupId);
    const from = month.parse(input.from);
    const amount = bani.parse(input.amount);
    await closePlans(db, { group_id: groupId }, from);
    const { error } = await db.from("fee_plans").insert({ club_id: ctx.club.id, group_id: groupId, amount, valid_from: from, created_by: ctx.userId });
    if (error) fail(error.message);
    return null;
  });
}

export async function savePlayerFee(input: { playerId: string; amount: number; from: string; reason?: string }) {
  return run({ roles: [...FINANCE], revalidate: ["/bani/taxe"], message: getT().money.plans.saved }, async ({ db, ctx }) => {
    const playerId = z.uuid().parse(input.playerId);
    const from = month.parse(input.from);
    await closePlans(db, { player_id: playerId }, from);
    const { error } = await db.from("fee_plans").insert({
      club_id: ctx.club.id, player_id: playerId, amount: bani.parse(input.amount), valid_from: from,
      reason: z.string().max(200).optional().parse(input.reason) ?? null, created_by: ctx.userId,
    });
    if (error) fail(error.message);
    return null;
  });
}

/** Încheie taxa individuală: de luna aleasă, jucătorul plătește din nou taxa echipei. */
export async function endPlayerFee(input: { planId: string; from: string }) {
  return run({ roles: [...FINANCE], revalidate: ["/bani/taxe"], message: getT().money.plans.removed }, async ({ db }) => {
    const id = z.uuid().parse(input.planId);
    const from = month.parse(input.from);
    const { data: plan } = await db.from("fee_plans").select("valid_from").eq("id", id).maybeSingle();
    if (!plan) fail("Plan necunoscut.");
    const res = plan.valid_from >= from
      ? await db.from("fee_plans").update({ deleted_at: new Date().toISOString() }).eq("id", id)
      : await db.from("fee_plans").update({ valid_to: prevMonth(from) }).eq("id", id);
    if (res.error) fail(res.error.message);
    return null;
  });
}

const prevMonth = (period: string) => {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
};

async function closePlans(db: Db, who: { group_id?: string; player_id?: string }, from: string) {
  let q = db.from("fee_plans").select("id, valid_from, valid_to").is("deleted_at", null);
  q = who.group_id ? q.eq("group_id", who.group_id) : q.eq("player_id", who.player_id!);
  const { data } = await q;
  for (const p of data ?? []) {
    if (p.valid_to && p.valid_to < from) continue;
    const res = p.valid_from >= from
      ? await db.from("fee_plans").update({ deleted_at: new Date().toISOString() }).eq("id", p.id)
      : await db.from("fee_plans").update({ valid_to: prevMonth(from) }).eq("id", p.id);
    if (res.error) fail(res.error.message);
  }
}

const Adjustment = z.object({
  player_id: z.uuid("Alege jucătorul."),
  kind: z.enum(["percent", "amount", "waiver"]),
  value: z.number().int().min(0).max(100_000_000),
  reason: z.enum(["sibling", "scholarship", "injury", "pause", "staff_child", "other"]),
  note: z.string().max(200).optional(),
  from_month: month,
  to_month: month.nullable(),
});

export async function saveAdjustment(input: z.input<typeof Adjustment>) {
  return run({ roles: [...FINANCE], revalidate: ["/bani/taxe"], message: getT().money.plans.saved }, async ({ db, ctx }) => {
    const a = Adjustment.parse(input);
    if (a.kind === "percent" && (a.value < 1 || a.value > 100)) fail("Procentul trebuie să fie între 1 și 100.");
    if (a.kind === "amount" && a.value <= 0) fail("Scrie suma reducerii.");
    if (a.to_month && a.to_month < a.from_month) fail("Luna de sfârșit e înaintea celei de început.");
    const { error } = await db.from("fee_adjustments").insert({ ...a, value: a.kind === "waiver" ? 0 : a.value, club_id: ctx.club.id, created_by: ctx.userId, note: a.note || null });
    if (error) fail(error.message);
    return null;
  });
}

export async function endAdjustment(input: { id: string; from: string }) {
  return run({ roles: [...FINANCE], revalidate: ["/bani/taxe"], message: getT().money.plans.removed }, async ({ db }) => {
    const id = z.uuid().parse(input.id);
    const from = month.parse(input.from);
    const { data: a } = await db.from("fee_adjustments").select("from_month").eq("id", id).maybeSingle();
    if (!a) fail("Reducere necunoscută.");
    const res = a.from_month >= from
      ? await db.from("fee_adjustments").update({ deleted_at: new Date().toISOString() }).eq("id", id)
      : await db.from("fee_adjustments").update({ to_month: prevMonth(from) }).eq("id", id);
    if (res.error) fail(res.error.message);
    return null;
  });
}
