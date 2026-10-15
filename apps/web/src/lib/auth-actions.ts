"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CONSENT_VERSION, homePath, isMinor } from "@club/shared";
import {
  AuthError, checkPassword, consumeOneTimeToken, createOneTimeToken, createServiceDb, createSession, deleteSession, findUserByEmail,
  setPassword as setUserPassword, signInWithPassword,
} from "@club/db";
import { DEMO_ROLES, DEMO_SLUG, demoEmail, demoLoginEnabled, type DemoRole } from "./demo";
import { getSession } from "./auth";
import { clearSessionCookie, readSessionToken, requestMeta, setSessionCookie } from "./session";
import { SITE_URL, APP_NAME } from "./env";
import { sendEmail } from "./email";
import { getT } from "@/messages";
import type { ActionResult } from "./actions";

const t = getT().auth;

function safeNext(next: unknown): string | null {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export async function signIn(input: { email: string; password: string; next?: string | null }): Promise<ActionResult<{ to: string }>> {
  const parsed = z.object({ email: z.email(), password: z.string().min(1).max(200) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: t.signIn.invalid };
  const result = await signInWithPassword({ ...parsed.data, ...(await requestMeta()) });
  if (!result.ok) return { ok: false, error: result.reason === "locked" ? t.signIn.locked : t.signIn.invalid };
  await setSessionCookie(result.session);
  const session = await getSession();
  if (!session) {
    await deleteSession(result.session.token);
    await clearSessionCookie();
    return { ok: false, error: t.signIn.inactive };
  }
  await session.db.rpc("log_event", { p_action: "LOGIN", p_entity: "auth" });
  return { ok: true, data: { to: safeNext(input.next) ?? homePath(session.ctx.role) } };
}

/** Conturile clubului demo nu primesc e-mailuri (oricine poate schimba adresa unui cont demo). */
async function isDemoAccount(userId: string): Promise<boolean> {
  const { data } = await createServiceDb().from("profiles").select("clubs!inner(slug)").eq("id", userId).maybeSingle();
  return (data?.clubs as { slug: string } | null)?.slug === DEMO_SLUG;
}

/**
 * Intrarea în clubul demo, fără parolă. Merge doar pentru conturile demo fixe, care aparțin
 * exclusiv clubului demo; orice alt cont cere parola.
 */
export async function enterDemo(input: { role: string }): Promise<ActionResult<{ to: string }>> {
  if (!demoLoginEnabled() || !(DEMO_ROLES as readonly string[]).includes(input.role)) return { ok: false, error: t.demo.unavailable };
  const user = await findUserByEmail(demoEmail(input.role as DemoRole));
  if (!user || user.disabled) return { ok: false, error: t.demo.unavailable };
  const admin = createServiceDb();
  const { data: club } = await admin.from("clubs").select("id").eq("slug", DEMO_SLUG).maybeSingle();
  const { data: profile } = await admin.from("profiles").select("club_id, role, is_active").eq("id", user.id).maybeSingle();
  const { count: elsewhere } = await admin.from("memberships").select("id", { count: "exact", head: true }).eq("user_id", user.id).neq("club_id", club?.id ?? "");
  if (!club || !profile?.is_active || profile.club_id !== club.id || elsewhere) return { ok: false, error: t.demo.unavailable };
  await deleteSession(await readSessionToken());
  await setSessionCookie(await createSession(user.id, await requestMeta()));
  const session = await getSession();
  if (!session) return { ok: false, error: t.demo.unavailable };
  return { ok: true, data: { to: homePath(session.ctx.role) } };
}

export async function signOut() {
  await deleteSession(await readSessionToken());
  await clearSessionCookie();
  redirect("/autentificare");
}

/** Trimite un link de resetare. Răspunsul este același indiferent dacă adresa există. */
export async function requestPasswordReset(input: { email: string }): Promise<ActionResult> {
  const parsed = z.object({ email: z.email() }).safeParse(input);
  if (parsed.success) {
    const user = await findUserByEmail(parsed.data.email);
    const demo = user ? await isDemoAccount(user.id) : false;
    if (user && !user.disabled && !demo) {
      const { token } = await createOneTimeToken(user.id, "recovery", 2);
      await sendEmail({
        to: user.email,
        subject: `${APP_NAME}: resetarea parolei`,
        text: `Ai cerut resetarea parolei.\n\nDeschide linkul de mai jos și alege o parolă nouă (valabil 2 ore, o singură folosire):\n${SITE_URL}/auth/link?t=${token}\n\nDacă nu ai cerut tu resetarea, ignoră acest mesaj.`,
      });
    }
  }
  return { ok: true, data: undefined, message: t.forgot.sent };
}

/** Folosește un link de invitație / resetare: deschide o sesiune și trimite la alegerea parolei. */
export async function redeemLink(input: { token: string }): Promise<ActionResult<{ to: string }>> {
  const used = await consumeOneTimeToken(String(input.token ?? ""));
  if (!used) return { ok: false, error: t.confirm.invalid };
  const session = await createSession(used.userId, { ...(await requestMeta()), viaLink: true });
  await setSessionCookie(session);
  return { ok: true, data: { to: "/parola?prima=1" } };
}

export async function setPassword(input: { password: string; repeat: string; current?: string }): Promise<ActionResult<{ to: string }>> {
  if (input.password !== input.repeat) return { ok: false, error: t.password.mismatch };
  const session = await getSession();
  if (!session) return { ok: false, error: t.confirm.invalid };
  const forced = session.viaLink || session.ctx.profile.must_change_password || !session.hasPassword;
  if (!forced && !(await checkPassword(session.ctx.userId, input.current ?? ""))) {
    return { ok: false, error: t.password.wrongCurrent };
  }
  try {
    await setUserPassword(session.ctx.userId, input.password, (await readSessionToken()) ?? undefined);
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    throw e;
  }
  await session.db.rpc("clear_must_change_password");
  return { ok: true, data: { to: homePath(session.ctx.role) }, message: t.password.saved };
}

export async function acceptConsent(input: { guardianName?: string; guardianRelation?: string }): Promise<ActionResult<{ to: string }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sesiunea a expirat. Autentifică-te din nou." };
  const { db, ctx } = session;
  const minor = ctx.role === "player" && isMinor(ctx.player?.birth_date, ctx.today) === true;
  if (minor && !input.guardianName?.trim()) return { ok: false, error: t.consent.guardianNeeded };
  const { error } = await db.from("consents").insert({
    user_id: ctx.userId,
    player_id: ctx.player?.id ?? null,
    kind: ctx.role !== "player" ? "staff_confidentiality" : minor ? "guardian_digital" : "self",
    text_version: CONSENT_VERSION,
    guardian_name: minor ? input.guardianName!.trim() : null,
    guardian_relation: minor ? input.guardianRelation ?? null : null,
  });
  if (error) return { ok: false, error: "Nu s-a putut înregistra acordul. Încearcă din nou." };
  await db.rpc("log_event", { p_action: "CONSENT", p_entity: "consents", p_details: { version: CONSENT_VERSION } });
  return { ok: true, data: { to: homePath(ctx.role) } };
}
