import "server-only";
import { createOneTimeToken, createServiceDb, deleteUserSessions, setUserDisabled } from "@club/db";
import type { Db, Profile } from "@club/shared";
import { fail } from "@/lib/actions";
import type { Session } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { APP_NAME, SITE_URL } from "@/lib/env";
import { getT } from "@/messages";

export const INVITE_HOURS = 7 * 24;
export const RESET_HOURS = 24;

/** Adresa pusă pe contul din `app_auth` la anonimizare: nu identifică pe nimeni și nu poate primi e-mail. */
export const anonymizedEmail = (userId: string) => `anonimizat-${userId}@anonim.invalid`;

/**
 * Contul-țintă al unei operațiuni de administrare. Se citește cu identitatea preparatorului
 * (RLS ascunde conturile altor cluburi), iar clubul se compară explicit înainte de orice
 * apel către funcțiile de cont, care nu trec prin RLS.
 */
export async function targetProfile({ db, ctx }: Session, userId: string): Promise<Profile> {
  const { data, error } = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (!data || data.club_id !== ctx.club.id) fail(getT().admin.errors.accountNotFound);
  // un cont cu roluri și în alt club nu poate fi șters, resetat sau modificat de un singur club
  const { count } = await createServiceDb().from("memberships").select("id", { count: "exact", head: true })
    .eq("user_id", userId).eq("is_active", true).neq("club_id", ctx.club.id);
  if (count) fail(getT().admin.errors.otherClub);
  return data;
}

export async function otherActivePhysios(db: Db, exceptUserId: string): Promise<number> {
  const { count, error } = await db.from("profiles").select("id", { count: "exact", head: true })
    .eq("role", "physio").eq("is_active", true).neq("id", exceptUserId);
  if (error) throw error;
  return count ?? 0;
}

export type AccessLink = { link: string; emailed: boolean; expiresAt: string; kind: "invite" | "recovery"; email: string; name: string };

/** Generează un link de unică folosință (invitație sau resetare) și îl trimite pe e-mail, dacă e-mailul e configurat. */
export async function issueAccessLink(
  { db, ctx }: Session,
  user: { id: string; email: string; name: string; playerId?: string | null },
  kind: "invite" | "recovery",
): Promise<AccessLink> {
  const t = getT().admin.email;
  const hours = kind === "invite" ? INVITE_HOURS : RESET_HOURS;
  const { token, expiresAt } = await createOneTimeToken(user.id, kind, hours);
  const link = `${SITE_URL}/auth/link?t=${token}`;
  const emailed = await sendEmail({
    to: user.email,
    subject: kind === "invite" ? t.inviteSubject(ctx.club.name) : t.resetSubject(APP_NAME),
    text: kind === "invite" ? t.inviteText(ctx.club.name, link, hours / 24) : t.resetText(link, hours),
  }).catch(() => false);
  await db.rpc("log_event", {
    p_action: kind === "invite" ? "INVITE" : "RESET",
    p_entity: "profiles",
    p_details: { entity_id: user.id, emailed, ...(user.playerId ? { player_id: user.playerId } : {}) },
  });
  return { link, emailed, expiresAt: new Date(expiresAt).toISOString(), kind, email: user.email, name: user.name };
}

/** Dezactivează sau reactivează un cont: profilul (RLS îl citește la fiecare interogare) și autentificarea. */
export async function setAccountState({ db }: Session, userId: string, active: boolean): Promise<void> {
  const { error } = await db.from("profiles").update({ is_active: active }).eq("id", userId);
  if (error) throw error;
  await setUserDisabled(userId, !active);
  if (!active) await deleteUserSessions(userId);
}
