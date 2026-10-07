"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CONSENT_VERSION, homePath, isMinor } from "@club/shared";
import { createClient } from "./supabase/server";
import { getSession } from "./auth";
import { SITE_URL } from "./supabase/env";
import { getT } from "@/messages";
import type { ActionResult } from "./actions";

const t = getT().auth;

function safeNext(next: unknown): string | null {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export async function signIn(input: { email: string; password: string; next?: string | null }): Promise<ActionResult<{ to: string }>> {
  const parsed = z.object({ email: z.email(), password: z.string().min(1) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: t.signIn.invalid };
  const db = await createClient();
  const { error } = await db.auth.signInWithPassword(parsed.data);
  if (error) return { ok: false, error: t.signIn.invalid };
  const session = await getSession();
  if (!session) {
    await db.auth.signOut();
    return { ok: false, error: t.signIn.inactive };
  }
  await session.db.rpc("log_event", { p_action: "LOGIN", p_entity: "auth" });
  return { ok: true, data: { to: safeNext(input.next) ?? homePath(session.ctx.role) } };
}

export async function signOut() {
  const db = await createClient();
  await db.auth.signOut();
  redirect("/autentificare");
}

export async function requestPasswordReset(input: { email: string }): Promise<ActionResult> {
  const parsed = z.object({ email: z.email() }).safeParse(input);
  if (parsed.success) {
    const db = await createClient();
    // nu dezvăluim dacă adresa există
    await db.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${SITE_URL}/auth/confirm?next=/parola` });
  }
  return { ok: true, data: undefined, message: t.forgot.sent };
}

export async function setPassword(input: { password: string; repeat: string }): Promise<ActionResult<{ to: string }>> {
  if (input.password.length < 10) return { ok: false, error: t.password.tooShort };
  if (input.password !== input.repeat) return { ok: false, error: t.password.mismatch };
  const db = await createClient();
  const { data: user } = await db.auth.getUser();
  if (!user.user) return { ok: false, error: t.confirm.invalid };
  const { error } = await db.auth.updateUser({ password: input.password });
  if (error) return { ok: false, error: error.message.includes("different") ? "Alege o parolă diferită de cea veche." : t.password.tooShort };
  await db.rpc("clear_must_change_password");
  const session = await getSession();
  return { ok: true, data: { to: session ? homePath(session.ctx.role) : "/" }, message: t.password.saved };
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
