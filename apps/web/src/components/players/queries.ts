import "server-only";
import { cache } from "react";
import { getPlayer, unwrap, type Db, type Player, type Tables } from "@club/shared";
import { getSession } from "@/lib/auth";

/**
 * Interogările modulului „jucători și medical". Toate rulează cu clientul utilizatorului (RLS activ):
 * ce nu are voie să vadă rolul curent vine pur și simplu gol.
 */

export type StatusHistoryRow = Tables<"status_history">;
export type GroupHistoryRow = Tables<"player_group_history">;
export type PlayerContact = Tables<"player_contacts">;
export type Anthropometric = Tables<"anthropometrics">;
export type Consent = Tables<"consents">;
export type Treatment = Tables<"injury_treatments">;
export type InjuryRow = Tables<"injuries">;
export type InjuryWithTreatments = InjuryRow & { injury_treatments: Treatment[] };
export type MedicalDocument = Tables<"medical_documents">;
export type PartnerNote = Tables<"partner_notes">;
export type Referral = Tables<"referrals">;
export type ReferralWithNotes = Referral & { partner_notes: PartnerNote[] };

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** Fișa jucătorului, o singură interogare pe cerere (antetul și pagina o cer amândouă). */
export const getPlayerForRequest = cache(async (id: string): Promise<Player | null> => {
  if (!isUuid(id)) return null;
  const session = await getSession();
  if (!session) return null;
  return getPlayer(session.db, id);
});

export async function listStatusHistory(db: Db, playerId: string, limit = 40): Promise<StatusHistoryRow[]> {
  return unwrap(
    await db.from("status_history").select("*").eq("player_id", playerId).order("created_at", { ascending: false }).limit(limit),
  );
}

export async function listGroupHistory(db: Db, playerId: string): Promise<GroupHistoryRow[]> {
  const rows = unwrap(await db.from("player_group_history").select("*").eq("player_id", playerId));
  // grupa curentă (fără dată de sfârșit) prima, apoi cele mai recente
  return rows.sort((a, b) => Number(!!a.to_date) - Number(!!b.to_date) || b.from_date.localeCompare(a.from_date) || (b.to_date ?? "").localeCompare(a.to_date ?? ""));
}

export async function getContacts(db: Db, playerId: string): Promise<PlayerContact | null> {
  const { data } = await db.from("player_contacts").select("*").eq("player_id", playerId).maybeSingle();
  return data;
}

export async function listAnthropometrics(db: Db, playerId: string): Promise<Anthropometric[]> {
  return unwrap(
    await db.from("anthropometrics").select("*").eq("player_id", playerId)
      .order("measured_on", { ascending: false }).order("created_at", { ascending: false }),
  );
}

/** Consimțămintele legate de jucător: cele înregistrate pe fișa lui și cele date din contul lui. */
export async function listConsents(db: Db, playerId: string, userId: string | null): Promise<Consent[]> {
  const byPlayer = unwrap(await db.from("consents").select("*").eq("player_id", playerId));
  const byUser = userId ? unwrap(await db.from("consents").select("*").eq("user_id", userId)) : [];
  const all = new Map([...byPlayer, ...byUser].map((c) => [c.id, c]));
  return [...all.values()].sort((a, b) => b.accepted_at.localeCompare(a.accepted_at));
}

export async function listInjuries(db: Db, playerId: string): Promise<InjuryWithTreatments[]> {
  const rows = unwrap(
    await db.from("injuries").select("*, injury_treatments(*)").eq("player_id", playerId)
      .order("occurred_on", { ascending: false }).order("created_at", { ascending: false }),
  ) as InjuryWithTreatments[];
  for (const r of rows) {
    r.injury_treatments = [...(r.injury_treatments ?? [])].sort(
      (a, b) => b.treated_on.localeCompare(a.treated_on) || b.created_at.localeCompare(a.created_at),
    );
  }
  return rows;
}

export async function listDocuments(db: Db, playerId: string): Promise<MedicalDocument[]> {
  return unwrap(
    await db.from("medical_documents").select("*").eq("player_id", playerId).order("created_at", { ascending: false }),
  );
}

export async function listReferrals(db: Db, playerId: string): Promise<ReferralWithNotes[]> {
  const rows = unwrap(
    await db.from("referrals").select("*, partner_notes(*)").eq("player_id", playerId).order("created_at", { ascending: false }),
  ) as ReferralWithNotes[];
  for (const r of rows) {
    r.partner_notes = [...(r.partner_notes ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  return rows;
}

export type PartnerOption = { id: string; full_name: string };

/** Conturile de partener medical ale clubului (doar preparatorul le poate citi). */
export async function listPartners(db: Db): Promise<PartnerOption[]> {
  const { data } = await db.from("profiles").select("id, full_name").eq("role", "medical_partner").eq("is_active", true).order("full_name");
  return data ?? [];
}

/** Nume pentru „cine a făcut”. RLS întoarce doar profilurile pe care apelantul le poate vedea. */
export async function profileNames(db: Db, ids: Array<string | null | undefined>): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  if (!unique.length) return {};
  const { data } = await db.from("profiles").select("id, full_name").in("id", unique);
  return Object.fromEntries((data ?? []).map((p) => [p.id, p.full_name]));
}

// ---------------------------------------------------------------------------
// Partenerul medical
// ---------------------------------------------------------------------------
export type CasePlayer = Pick<
  Player,
  "id" | "display_name" | "full_name" | "birth_date" | "group_id" | "position" | "dominant_foot" | "photo_path"
>;
export type CaseListItem = Referral & { players: CasePlayer | null };

const CASE_PLAYER_COLUMNS = "id, display_name, full_name, birth_date, group_id, position, dominant_foot, photo_path";

/** Trimiterile active către partenerul curent. */
export async function listMyCases(db: Db, userId: string): Promise<CaseListItem[]> {
  const rows = unwrap(
    await db.from("referrals").select(`*, players ( ${CASE_PLAYER_COLUMNS} )`)
      .eq("partner_user_id", userId).eq("is_active", true).order("created_at", { ascending: false }),
  ) as unknown as CaseListItem[];
  // jucătorul vine null dacă RLS nu îl mai arată (trimitere închisă între timp)
  return rows.filter((r) => r.players);
}

export async function getMyCase(db: Db, userId: string, referralId: string): Promise<CaseListItem | null> {
  if (!isUuid(referralId)) return null;
  const { data } = await db.from("referrals").select(`*, players ( ${CASE_PLAYER_COLUMNS} )`)
    .eq("id", referralId).eq("partner_user_id", userId).eq("is_active", true).maybeSingle();
  const row = data as unknown as CaseListItem | null;
  return row?.players ? row : null;
}

export async function listCaseNotes(db: Db, referralId: string): Promise<PartnerNote[]> {
  return unwrap(
    await db.from("partner_notes").select("*").eq("referral_id", referralId).order("created_at", { ascending: false }),
  );
}
