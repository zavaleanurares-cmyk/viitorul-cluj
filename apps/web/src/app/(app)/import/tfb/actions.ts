"use server";
import crypto from "node:crypto";
import { z } from "zod";
import {
  planTfbImport, proposeTfb, unpackTfbBundle,
  type TfbDecisions, type TfbPacked, type TfbProposals, type TfbReconciliation, type TfbSnapshot, type TfbSummary,
} from "@club/shared";
import { createServiceDb } from "@club/db";
import { run, fail } from "@/lib/actions";

/**
 * Migrarea din TFB. Browserul trimite pachetul interpretat (fără fișierele brute); serverul citește starea
 * clubului cu identitatea utilizatorului, construiește planul și, la „Importă", îl scrie prin `import_tfb`.
 * Planul nu vine niciodată din browser: se reface aici de fiecare dată.
 */

const ROLES = ["admin", "physio"] as const;
const Str = (max: number) => z.string().max(max);
const NStr = (max: number) => z.string().max(max).nullable();
const Date_ = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

const Packed = z.object({
  teams: z.array(z.object({
    name: Str(120), season: NStr(40), type: NStr(60), coach: NStr(200), count: z.number().int().nullable(),
    birthYear: z.number().int().nullable(), gender: z.enum(["m", "f"]), programme: NStr(40),
  })).max(300),
  staff: z.array(z.object({ name: Str(200), role: Str(120), license: NStr(80) })).max(500),
  players: z.array(z.object({
    key: Str(300), fullName: Str(200), birthDate: Date_, teams: z.array(Str(120)).max(10),
    position: z.enum(["GK", "DEF", "MID", "FWD"]).nullable(), positionDetail: NStr(80), shirt: z.number().int().min(0).max(999).nullable(),
    visaUntil: Date_, registration: NStr(60), registeredOn: Date_, enrolledOn: Date_, fee: z.number().int().min(0).max(100000000).nullable(),
    matricol: NStr(20), active: z.boolean(),
  })).max(5000),
  guardians: z.array(z.object({
    key: Str(300), name: Str(200), relation: z.enum(["mother", "father", "guardian", "parent"]), phone: NStr(40), email: NStr(200),
    children: z.array(Str(300)).max(10), recurring: z.boolean(),
  })).max(10000),
  contacts: z.array(z.object({ player: Str(300), phone: NStr(40), email: NStr(200) })).max(10000),
  months: z.array(z.tuple([z.number().int().min(0), z.string().regex(/^\d{4}-\d{2}$/), z.number().int(), z.number().int().min(-1)])).max(120000),
  labels: z.array(Str(80)).max(50),
  years: z.array(z.number().int()).max(20),
  warnings: z.array(Str(500)).max(200),
});
const Decisions = z.object({
  groups: z.record(z.uuid(), Str(120)),
  players: z.record(z.uuid(), Str(300)),
  deactivateMissing: z.boolean(),
}).nullable();

async function all<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) return out;
  }
}

/**
 * Starea clubului pentru plan. Se citește cu drepturi de serviciu, limitată la clubul celui care importă:
 * preparatorul fizic administrează clubul, dar nu vede registrul de bani, iar planul are nevoie de el
 * (ce luni sunt deja taxate și încasate), altfel ar număra greșit.
 */
async function snapshot(clubId: string, today: string): Promise<TfbSnapshot> {
  const db = createServiceDb();
  const [groups, players, guardians, links, monthly, payments, plans] = await Promise.all([
    all((a, b) => db.from("groups").select("id, name, is_active").eq("club_id", clubId).order("id").range(a, b)),
    all((a, b) => db.from("players").select("id, full_name, display_name, birth_date, group_id, is_active").eq("club_id", clubId).is("anonymized_at", null).order("id").range(a, b)),
    all((a, b) => db.from("guardians").select("id, full_name, phone, email").eq("club_id", clubId).is("deleted_at", null).order("id").range(a, b)),
    all((a, b) => db.from("guardian_players").select("guardian_id, player_id, is_billing, guardians!inner(club_id)").eq("guardians.club_id", clubId).order("guardian_id").order("player_id").range(a, b)),
    all((a, b) => db.from("charges").select("player_id, period, amount").eq("club_id", clubId).eq("kind", "monthly").neq("status", "cancelled").order("id").range(a, b)),
    all((a, b) => db.from("allocations").select("amount, charges!inner(player_id, period, kind, club_id), payments!inner(status, reference)").eq("charges.club_id", clubId).eq("charges.kind", "monthly").eq("payments.status", "completed").order("id").range(a, b)),
    all((a, b) => db.from("fee_plans").select("group_id, player_id").eq("club_id", clubId).is("deleted_at", null).order("id").range(a, b)),
  ]);
  return {
    today,
    groups, players, guardians,
    links: links.map((l) => ({ guardian_id: l.guardian_id, player_id: l.player_id, is_billing: l.is_billing })),
    monthly: monthly.map((m) => ({ player_id: m.player_id, period: m.period as string, amount: m.amount })),
    allocated: payments.flatMap((a) => {
      const c = a.charges as unknown as { player_id: string; period: string | null } | null;
      const pay = a.payments as unknown as { reference: string | null } | null;
      return c?.period ? [{ player_id: c.player_id, period: c.period, amount: a.amount, tfb: pay?.reference === "TFB" }] : [];
    }),
    paidByPeriod: payments.flatMap((a) => {
      const c = a.charges as unknown as { period: string | null } | null;
      return c?.period ? [{ period: c.period, amount: a.amount }] : [];
    }),
    groupPlans: plans.flatMap((p) => (p.group_id ? [p.group_id] : [])),
    playerPlans: plans.flatMap((p) => (p.player_id ? [p.player_id] : [])),
  };
}

function defaults(proposals: TfbProposals): TfbDecisions {
  return {
    groups: Object.fromEntries(proposals.groups.map((g) => [g.id, g.suggested])),
    players: Object.fromEntries(proposals.players.map((p) => [p.id, p.suggested])),
    deactivateMissing: false,
  };
}

export type TfbPreview = { proposals: TfbProposals; decisions: TfbDecisions; summary: TfbSummary; reconciliation: TfbReconciliation };

/** Verificarea: propunerile, deciziile (cele primite sau cele implicite) și cifrele planului, fără să scrie nimic. */
export async function previewTfb(input: { bundle: TfbPacked; decisions: TfbDecisions | null }) {
  return run({ roles: [...ROLES] }, async ({ ctx }): Promise<TfbPreview> => {
    const bundle = unpackTfbBundle(Packed.parse(input.bundle));
    const snap = await snapshot(ctx.club.id, ctx.today);
    const proposals = proposeTfb(bundle, snap);
    const decisions = Decisions.parse(input.decisions) ?? defaults(proposals);
    const { summary, reconciliation } = planTfbImport(bundle, snap, decisions, () => crypto.randomUUID());
    return { proposals, decisions, summary, reconciliation };
  });
}

/** Importul: planul se reface pe server și se scrie atomic; întoarce cifrele de după import. */
export async function runTfb(input: { bundle: TfbPacked; decisions: TfbDecisions }) {
  return run({ roles: [...ROLES], revalidate: ["/lot", "/import", "/bani"] }, async ({ db, ctx }): Promise<TfbPreview & { written: Record<string, number | string> }> => {
    const bundle = unpackTfbBundle(Packed.parse(input.bundle));
    const decisions = Decisions.parse(input.decisions);
    if (!decisions) fail("Lipsesc deciziile de potrivire.");
    // numărul migrărilor TFB văzute înaintea stării: dacă între timp a rulat alta, funcția refuză planul
    const { count: runsSeen } = await createServiceDb().from("imports").select("id", { count: "exact", head: true }).eq("club_id", ctx.club.id).eq("kind", "tfb");
    const snap = await snapshot(ctx.club.id, ctx.today);
    const { plan, summary, reconciliation } = planTfbImport(bundle, snap, decisions, () => crypto.randomUUID());
    const report = { summary: { ...summary, staff: summary.staff.length, multiTeam: summary.multiTeam.length }, reconciliation, warnings: bundle.warnings.slice(0, 50) };
    const { data, error } = await db.rpc("import_tfb", { p: { ...plan, runs_seen: runsSeen ?? 0 } as never, p_report: report as never });
    if (error) throw error;
    // cifrele de după: același plan, recalculat pe starea nouă (nimic nou de scris)
    const after = await snapshot(ctx.club.id, ctx.today);
    const proposals = proposeTfb(bundle, after);
    // jucătorii creați acum au numele din TFB, deci se potrivesc singuri
    const afterDecisions = { ...decisions, players: { ...defaults(proposals).players, ...decisions.players } };
    const again = planTfbImport(bundle, after, afterDecisions, () => crypto.randomUUID());
    return { proposals, decisions: afterDecisions, summary: again.summary, reconciliation: again.reconciliation, written: data as Record<string, number | string> };
  });
}
