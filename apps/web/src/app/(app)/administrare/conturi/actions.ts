"use server";
import { z } from "zod";
import { AuthError, createUser, deleteUser, getUser, setUserEmail } from "@club/db";
import type { AppRole } from "@club/shared";
import { fail, run } from "@/lib/actions";
import type { Session } from "@/lib/auth";
import { issueAccessLink, otherActivePhysios, setAccountState, targetProfile, type AccessLink } from "@/components/admin/server";
import { getT } from "@/messages";

const t = getT().admin;
const PATHS = ["/administrare", "/administrare/conturi"];

const StaffRole = z.enum(["owner", "sporting_director", "physio", "coach", "medical_partner", "admin", "secretary", "accountant"]);
const Email = z.string().trim().toLowerCase().pipe(z.email(t.errors.emailInvalid));
const FullName = z.string().trim().min(2, t.errors.nameNeeded).max(120);
const GroupIds = z.array(z.uuid()).max(50);

function authFail(e: unknown): never {
  if (e instanceof AuthError) fail(e.message);
  throw e;
}

/** Grupele trimise de browser trebuie să fie ale clubului (RLS verifică din nou la scriere). */
function clubGroups(session: Session, ids: string[]): string[] {
  const own = new Set(session.ctx.groups.map((g) => g.id));
  const unique = [...new Set(ids)];
  if (unique.some((id) => !own.has(id))) fail(t.errors.groupNotFound);
  return unique;
}

/**
 * Creează utilizatorul și profilul lui. Profilul se scrie cu identitatea preparatorului: clubul
 * este cel al sesiunii, iar baza de date refuză (RLS) orice alt club. Dacă un pas eșuează,
 * utilizatorul abia creat este șters, ca să nu rămână conturi fără profil.
 */
async function createAccount(
  session: Session,
  a: { email: string; fullName: string; role: AppRole; groupIds?: string[]; playerId?: string },
): Promise<string> {
  const { db, ctx } = session;
  let userId: string;
  try {
    userId = (await createUser({ email: a.email })).id;
  } catch (e) {
    authFail(e);
  }
  try {
    const { error } = await db.from("profiles").insert({ id: userId, club_id: ctx.club.id, role: a.role, full_name: a.fullName, email: a.email });
    if (error) throw error;
    if (a.role === "coach" && a.groupIds?.length) {
      const { error: groupsError } = await db.from("staff_groups").insert(a.groupIds.map((g) => ({ user_id: userId, group_id: g })));
      if (groupsError) throw groupsError;
    }
    if (a.playerId) {
      const { data, error: linkError } = await db.from("players").update({ user_id: userId }).eq("id", a.playerId).is("user_id", null).select("id");
      if (linkError) throw linkError;
      if (!data?.length) fail(t.errors.playerHasAccount);
    }
  } catch (e) {
    await deleteUser(userId).catch(() => {});
    throw e;
  }
  return userId;
}

const NewStaff = z.object({ fullName: FullName, email: Email, role: StaffRole, groupIds: GroupIds });

export async function createStaffAccount(input: z.infer<typeof NewStaff>) {
  return run<AccessLink>({ roles: ["physio", "admin"], revalidate: PATHS, message: t.accounts.created }, async (session) => {
    const v = NewStaff.parse(input);
    const groupIds = v.role === "coach" ? clubGroups(session, v.groupIds) : [];
    if (v.role === "coach" && !groupIds.length) fail(t.errors.coachNeedsGroup);
    const userId = await createAccount(session, { ...v, groupIds });
    return issueAccessLink(session, { id: userId, email: v.email, name: v.fullName }, "invite");
  });
}

async function playerForAccount({ db }: Session, playerId: string) {
  const { data, error } = await db.from("players").select("id, full_name, display_name, user_id, is_active, anonymized_at").eq("id", playerId).maybeSingle();
  if (error) throw error;
  if (!data) fail(t.errors.playerNotFound);
  if (data.anonymized_at || !data.is_active) fail(t.errors.playerInactive);
  if (data.user_id) fail(t.errors.playerHasAccount);
  return data;
}

const NewPlayerAccount = z.object({ playerId: z.uuid(), email: Email });

export async function createPlayerAccount(input: z.infer<typeof NewPlayerAccount>) {
  return run<AccessLink>({ roles: ["physio", "admin"], revalidate: PATHS, message: t.accounts.created }, async (session) => {
    const v = NewPlayerAccount.parse(input);
    const player = await playerForAccount(session, v.playerId);
    const userId = await createAccount(session, { email: v.email, fullName: player.full_name, role: "player", playerId: player.id });
    return issueAccessLink(session, { id: userId, email: v.email, name: player.display_name, playerId: player.id }, "invite");
  });
}

const Bulk = z.object({ rows: z.array(z.object({ playerId: z.uuid(), email: z.string().max(200) })).min(1).max(60) });
export type BulkResult = { playerId: string; name: string; email: string } & ({ ok: true; link: string; emailed: boolean } | { ok: false; error: string });

/** Conturi pentru mai mulți jucători deodată. Un rând greșit nu le oprește pe celelalte. */
export async function createPlayerAccounts(input: z.infer<typeof Bulk>) {
  return run<BulkResult[]>({ roles: ["physio", "admin"], revalidate: PATHS }, async (session) => {
    const v = Bulk.parse(input);
    const seen = new Set<string>();
    const results: BulkResult[] = [];
    for (const row of v.rows) {
      const base = { playerId: row.playerId, name: "", email: row.email.trim().toLowerCase() };
      try {
        const { data: player } = await session.db.from("players").select("id, full_name, display_name, user_id, is_active, anonymized_at").eq("id", row.playerId).maybeSingle();
        if (!player) throw new Error(t.errors.playerNotFound);
        base.name = player.display_name;
        const email = Email.safeParse(row.email);
        if (!email.success) throw new Error(t.errors.emailInvalid);
        if (seen.has(email.data)) throw new Error(t.errors.emailRepeated);
        seen.add(email.data);
        if (player.anonymized_at || !player.is_active) throw new Error(t.errors.playerInactive);
        if (player.user_id) throw new Error(t.errors.playerHasAccount);
        const userId = await createAccount(session, { email: email.data, fullName: player.full_name, role: "player", playerId: player.id });
        const access = await issueAccessLink(session, { id: userId, email: email.data, name: player.display_name, playerId: player.id }, "invite");
        results.push({ ...base, ok: true, link: access.link, emailed: access.emailed });
      } catch (e) {
        results.push({ ...base, ok: false, error: (e as Error).message || t.errors.generic });
      }
    }
    return results;
  });
}

const Update = z.object({ userId: z.uuid(), fullName: FullName, email: Email, role: z.enum([...StaffRole.options, "player"]), groupIds: GroupIds });

export async function updateAccount(input: z.infer<typeof Update>) {
  return run({ roles: ["physio", "admin"], revalidate: PATHS, message: t.accounts.saved }, async (session) => {
    const { db, ctx } = session;
    const v = Update.parse(input);
    const p = await targetProfile(session, v.userId);
    // un cont de jucător este legat de o fișă: nu devine cont de staff și invers
    if ((p.role === "player") !== (v.role === "player")) fail(t.errors.roleLocked);
    if (p.id === ctx.userId && p.role === "physio" && v.role !== "physio" && (await otherActivePhysios(db, p.id)) === 0) {
      fail(t.errors.lastPhysio);
    }
    const groupIds = v.role === "coach" ? clubGroups(session, v.groupIds) : [];
    if (v.role === "coach" && !groupIds.length) fail(t.errors.coachNeedsGroup);

    if (v.email !== (p.email ?? "").toLowerCase()) {
      const user = await getUser(p.id);
      if (!user) fail(t.errors.accountNotFound);
      if (user.email.toLowerCase() !== v.email) {
        try {
          await setUserEmail(p.id, v.email);
        } catch (e) {
          authFail(e);
        }
      }
    }
    // grupele întâi, rolul la sfârșit: dacă preparatorul își schimbă propriul rol, după aceea nu mai are drept de scriere
    const { error: clearError } = await db.from("staff_groups").delete().eq("user_id", p.id);
    if (clearError) throw clearError;
    if (groupIds.length) {
      const { error } = await db.from("staff_groups").insert(groupIds.map((g) => ({ user_id: p.id, group_id: g })));
      if (error) throw error;
    }
    const { error } = await db.from("profiles").update({ full_name: v.fullName, email: v.email, role: v.role }).eq("id", p.id);
    if (error) throw error;
  });
}

const Target = z.object({ userId: z.uuid() });

/** Invitație nouă (dacă parola nu a fost aleasă încă) sau link de resetare a parolei. */
export async function sendAccessLink(input: z.infer<typeof Target>) {
  return run<AccessLink>({ roles: ["physio", "admin"], revalidate: PATHS }, async (session) => {
    const v = Target.parse(input);
    const p = await targetProfile(session, v.userId);
    const user = await getUser(p.id);
    if (!user) fail(t.errors.accountNotFound);
    if (user.disabled || !p.is_active) fail(t.errors.accountDisabled);
    const { data: player } = await session.db.from("players").select("id").eq("user_id", p.id).maybeSingle();
    return issueAccessLink(session, { id: p.id, email: user.email, name: p.full_name, playerId: player?.id }, user.hasPassword ? "recovery" : "invite");
  });
}

const Active = z.object({ userId: z.uuid(), active: z.boolean() });

export async function setAccountActive(input: z.infer<typeof Active>) {
  return run({ roles: ["physio", "admin"], revalidate: PATHS, message: input.active ? t.accounts.enabled : t.accounts.disabled }, async (session) => {
    const v = Active.parse(input);
    const p = await targetProfile(session, v.userId);
    if (p.id === session.ctx.userId) fail(t.errors.notYourself);
    if (v.active) {
      const user = await getUser(p.id);
      if (!user || user.email.endsWith("@anonim.invalid")) fail(t.errors.anonymizedAccount);
    }
    await setAccountState(session, p.id, v.active);
  });
}

/** Dezleagă contul de fișa jucătorului. Contul rămâne, dezactivat: fără fișă nu are ce să arate. */
export async function unlinkPlayer(input: z.infer<typeof Target>) {
  return run({ roles: ["physio", "admin"], revalidate: PATHS, message: t.accounts.unlinked }, async (session) => {
    const v = Target.parse(input);
    const p = await targetProfile(session, v.userId);
    if (p.role !== "player") fail(t.errors.notPlayerAccount);
    const { error } = await session.db.from("players").update({ user_id: null }).eq("user_id", p.id);
    if (error) throw error;
    await setAccountState(session, p.id, false);
  });
}

const Link = z.object({ userId: z.uuid(), playerId: z.uuid() });

/** Leagă un cont de jucător rămas fără fișă de un jucător fără cont și îl reactivează. */
export async function linkPlayer(input: z.infer<typeof Link>) {
  return run({ roles: ["physio", "admin"], revalidate: PATHS, message: t.accounts.linked }, async (session) => {
    const v = Link.parse(input);
    const p = await targetProfile(session, v.userId);
    if (p.role !== "player") fail(t.errors.notPlayerAccount);
    const user = await getUser(p.id);
    if (!user || user.email.endsWith("@anonim.invalid")) fail(t.errors.anonymizedAccount);
    const { data: current } = await session.db.from("players").select("id").eq("user_id", p.id).maybeSingle();
    if (current) fail(t.errors.accountHasPlayer);
    await playerForAccount(session, v.playerId);
    const { data, error } = await session.db.from("players").update({ user_id: p.id }).eq("id", v.playerId).is("user_id", null).select("id");
    if (error) throw error;
    if (!data?.length) fail(t.errors.playerHasAccount);
    await setAccountState(session, p.id, true);
  });
}

export async function deleteAccount(input: z.infer<typeof Target>) {
  return run({ roles: ["physio", "admin"], revalidate: PATHS, message: t.accounts.deleted }, async (session) => {
    const v = Target.parse(input);
    const p = await targetProfile(session, v.userId);
    if (p.id === session.ctx.userId) fail(t.errors.notYourself);
    // întâi profilul, cu identitatea preparatorului (rămâne în jurnal cine a șters), apoi utilizatorul
    const { data, error } = await session.db.from("profiles").delete().eq("id", p.id).select("id");
    if (error) throw error;
    if (!data?.length) fail(t.errors.accountNotFound);
    await deleteUser(p.id);
  });
}
