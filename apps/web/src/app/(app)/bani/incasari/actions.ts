"use server";
import { z } from "zod";
import { fail, run } from "@/lib/actions";
import { getAdapter } from "@/lib/payments/registry";
import { openChargesFor } from "@/components/money/queries";

const FINANCE = ["admin", "secretary", "accountant"] as const;
const paths = ["/bani", "/bani/taxe", "/bani/incasari", "/azi", "/plati"];
const bani = z.number().int().positive().max(1_000_000_000);

/** Taxele deschise ale unei familii (pentru împărțirea plății). */
export async function loadOpenCharges(input: { playerIds: string[] }) {
  return run({ roles: [...FINANCE] }, async ({ db }) => {
    const ids = z.array(z.uuid()).max(20).parse(input.playerIds);
    const rows = await openChargesFor(db, ids);
    const names = new Map<string, string>();
    if (ids.length) {
      const { data } = await db.from("players").select("id, full_name").in("id", ids);
      for (const p of data ?? []) names.set(p.id, p.full_name);
    }
    return rows.map((r) => ({ id: r.id, title: r.title, player: names.get(r.player_id) ?? "", balance: r.balance, net: r.net, due_on: r.due_on, period: r.period, issued_at: r.issued_at }));
  });
}

const Payment = z.object({
  method: z.enum(["cash", "bank", "card"]),
  amount: bani,
  received_on: z.iso.date(),
  guardian_id: z.uuid().nullable(),
  player_id: z.uuid().nullable(),
  payer_name: z.string().max(120).optional(),
  reference: z.string().max(300).optional(),
  note: z.string().max(500).optional(),
  allocations: z.array(z.object({ charge_id: z.uuid(), amount: bani })).max(60).optional(),
  bank_line_id: z.uuid().nullable().optional(),
});

export async function recordPayment(input: z.input<typeof Payment>) {
  return run<{ payment_id: string; receipt_id: string | null; unallocated: number; receipt: string | null }>({ roles: [...FINANCE], revalidate: paths }, async ({ db }) => {
    const p = Payment.parse(input);
    if (!p.guardian_id && !p.player_id && !p.bank_line_id) fail("Alege cine a plătit.");
    const { data, error } = await db.rpc("record_payment", { p });
    if (error) fail(error.message);
    const res = data as { payment_id: string; receipt_id: string | null; unallocated: number };
    let receipt: string | null = null;
    if (res.receipt_id) {
      const { data: r } = await db.from("receipts").select("series, number").eq("id", res.receipt_id).single();
      if (r) receipt = `${r.series} nr. ${r.number}`;
    }
    return { ...res, receipt };
  });
}

export async function allocatePayment(input: { paymentId: string; guardianId: string | null; playerId: string | null; rows: Array<{ charge_id: string; amount: number }> }) {
  return run<number>({ roles: [...FINANCE], revalidate: paths }, async ({ db }) => {
    const rows = z.array(z.object({ charge_id: z.uuid(), amount: z.number().int().min(0) })).max(60).parse(input.rows);
    const { data, error } = await db.rpc("allocate_payment", {
      p_payment: z.uuid().parse(input.paymentId),
      p_rows: rows.filter((r) => r.amount > 0),
      p_guardian: input.guardianId ? z.uuid().parse(input.guardianId) : undefined,
      p_player: input.playerId ? z.uuid().parse(input.playerId) : undefined,
    });
    if (error) fail(error.message);
    return (data as number) ?? 0;
  });
}

export async function voidPayment(input: { paymentId: string; reason: string }) {
  return run({ roles: [...FINANCE], revalidate: paths, message: "Plata a fost anulată." }, async ({ db }) => {
    const { error } = await db.rpc("void_payment", { p_payment: z.uuid().parse(input.paymentId), p_reason: z.string().min(3, "Scrie motivul anulării.").max(300).parse(input.reason) });
    if (error) fail(error.message);
    return null;
  });
}

/** Returnare (doar plăți online): trece prin operator; registrul se actualizează din evenimentul lui. */
export async function refundPayment(input: { paymentId: string; amount: number }) {
  return run({ roles: ["admin", "accountant"], revalidate: paths, message: "Returnarea a fost trimisă." }, async ({ db }) => {
    const id = z.uuid().parse(input.paymentId);
    const amount = bani.parse(input.amount);
    const { data: p } = await db.from("payments").select("id, method, provider, provider_ref, amount, refunded_amount, status").eq("id", id).maybeSingle();
    if (!p) fail("Plată necunoscută.");
    if (p.method !== "online" || !p.provider || !p.provider_ref) fail("Se returnează doar plățile online. O plată în numerar sau prin bancă se anulează.");
    if (p.status !== "completed") fail("Plata este anulată.");
    if (amount > p.amount - p.refunded_amount) fail("Suma depășește ce se mai poate returna.");
    // registrul se actualizează din evenimentul operatorului (cel de test îl livrează imediat)
    await getAdapter(p.provider).refund({ paymentRef: p.provider_ref, amount });
    return null;
  });
}

/** O plată cu alocările ei și taxele deschise ale familiei (pentru „Împarte din nou" / „Asociază"). */
export async function loadPaymentForAllocation(input: { paymentId: string; playerIds: string[] }) {
  return run({ roles: [...FINANCE] }, async ({ db }) => {
    const id = z.uuid().parse(input.paymentId);
    const ids = z.array(z.uuid()).max(20).parse(input.playerIds);
    const [pay, allocs] = await Promise.all([
      db.from("payment_balances").select("id, amount, refunded_amount, status").eq("id", id).maybeSingle(),
      db.from("allocations").select("charge_id, amount").eq("payment_id", id),
    ]);
    if (!pay.data) fail("Plată necunoscută.");
    const existing = new Map((allocs.data ?? []).map((a) => [a.charge_id, a.amount]));
    const chargeIds = [...existing.keys()];
    const [mine, open] = await Promise.all([
      chargeIds.length ? db.from("charge_balances").select("*, players(full_name)").in("id", chargeIds) : Promise.resolve({ data: [], error: null }),
      ids.length ? db.from("charge_balances").select("*, players(full_name)").in("player_id", ids).eq("status", "open").gt("balance", 0) : Promise.resolve({ data: [], error: null }),
    ]);
    const rows = new Map<string, { id: string; title: string; player: string; balance: number; due_on: string; period: string | null; issued_at: string; current: number }>();
    for (const c of [...(mine.data ?? []), ...(open.data ?? [])]) {
      if (rows.has(c.id)) continue;
      const cur = existing.get(c.id) ?? 0;
      // ce se poate pune pe taxă la reîmpărțire = restul ei + ce are deja de la această plată
      rows.set(c.id, { id: c.id, title: c.title, player: (c.players as { full_name: string } | null)?.full_name ?? "", balance: c.balance + cur, due_on: c.due_on, period: c.period, issued_at: c.issued_at, current: cur });
    }
    return { available: pay.data.amount - pay.data.refunded_amount, charges: [...rows.values()].sort((a, b) => a.due_on.localeCompare(b.due_on)) };
  });
}
