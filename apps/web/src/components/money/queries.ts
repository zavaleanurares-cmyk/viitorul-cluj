import "server-only";
import type { Database, Db } from "@club/shared";

export type ChargeBalance = Database["public"]["Views"]["charge_balances"]["Row"];
export type PaymentBalance = Database["public"]["Views"]["payment_balances"]["Row"];
export type FinanceSettings = Database["public"]["Tables"]["finance_settings"]["Row"];
export type FeeRosterRow = Database["public"]["Functions"]["fee_roster"]["Returns"][number];

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw res.error;
  return res.data as T;
}

export async function getFinanceSettings(db: Db): Promise<FinanceSettings | null> {
  const { data } = await db.from("finance_settings").select("*").maybeSingle();
  return data;
}

/** Prima zi a lunii unei date „AAAA-LL-ZZ". */
export const periodOf = (iso: string) => `${iso.slice(0, 7)}-01`;
export function addMonths(period: string, n: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 10);
}

export async function feeRoster(db: Db, period: string): Promise<FeeRosterRow[]> {
  return must(await db.rpc("fee_roster", { p_period: period })) ?? [];
}

export type MoneySummary = {
  year: number;
  month: number;
  today: string;
  months: Array<{ month: number; expected: number; collected_for_month: number; received: number; spent: number; planned_income: number; planned_expense: number }>;
  teams: Array<{ group_id: string; name: string; players: number; payers: number; expected: number; collected: number }>;
  kpi: { overdue: number; overdue_families: number; unallocated: number; unallocated_count: number; bank_unmatched: number; requests_pending: number; requests_approved: number; adjusted_players: number };
};

export async function moneySummary(db: Db, year: number, month?: number): Promise<MoneySummary> {
  return must(await db.rpc("money_summary", { p_year: year, p_month: month })) as unknown as MoneySummary;
}

/** Familiile clubului (părinți cu copiii lor) pentru căutare la încasare și asociere. */
export type FamilyOption = { guardianId: string | null; playerId: string | null; label: string; detail: string; ref: string | null; players: string[] };

export async function listFamilies(db: Db): Promise<FamilyOption[]> {
  const [g, links, players] = await Promise.all([
    db.from("guardians").select("id, full_name, payment_ref").is("deleted_at", null).order("full_name"),
    db.from("guardian_players").select("guardian_id, player_id"),
    db.from("players").select("id, full_name, group_id, is_active").is("anonymized_at", null).order("full_name"),
  ]);
  const playerName = new Map((players.data ?? []).map((p) => [p.id, p.full_name]));
  const byGuardian = new Map<string, string[]>();
  for (const l of links.data ?? []) byGuardian.set(l.guardian_id, [...(byGuardian.get(l.guardian_id) ?? []), l.player_id]);
  const withGuardian = new Set((links.data ?? []).map((l) => l.player_id));
  const out: FamilyOption[] = (g.data ?? []).map((x) => {
    const kids = byGuardian.get(x.id) ?? [];
    return { guardianId: x.id, playerId: null, label: x.full_name, detail: kids.map((k) => playerName.get(k)).filter(Boolean).join(", "), ref: x.payment_ref, players: kids };
  });
  // jucători fără părinte (seniori): plătesc ei
  for (const p of players.data ?? []) {
    if (!withGuardian.has(p.id) && p.is_active) out.push({ guardianId: null, playerId: p.id, label: p.full_name, detail: "", ref: null, players: [p.id] });
  }
  return out;
}

/** Taxele deschise ale unor jucători (pentru împărțirea unei plăți). */
export async function openChargesFor(db: Db, playerIds: string[]): Promise<ChargeBalance[]> {
  if (!playerIds.length) return [];
  const { data, error } = await db.from("charge_balances").select("*").in("player_id", playerIds).eq("status", "open").gt("balance", 0)
    .order("due_on").order("issued_at");
  if (error) throw error;
  return data ?? [];
}

export const MONTH_KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
