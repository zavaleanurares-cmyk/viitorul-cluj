import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createServiceDb, getPool } from "@club/db";
import type { AppRole } from "@club/shared";
import { emailConfigured, sendEmail } from "@/lib/email";
import { APP_NAME, SITE_URL } from "@/lib/env";
import { buildDigest } from "@/components/notifications/digest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Câte e-mailuri trimitem cel mult la o rulare (restul pleacă la următoarea). */
const MAX_EMAILS_PER_RUN = 200;
const READ_RETENTION_DAYS = 90;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = request.headers.get("authorization") ?? "";
  const a = crypto.createHash("sha256").update(`Bearer ${secret}`).digest();
  const b = crypto.createHash("sha256").update(given).digest();
  return crypto.timingSafeEqual(a, b);
}

type StepResult = Record<string, unknown>;

async function step(name: string, out: Record<string, StepResult>, fn: () => Promise<StepResult>) {
  try {
    out[name] = await fn();
  } catch (e) {
    console.error(`[cron] ${name}:`, (e as Error).message);
    out[name] = { error: (e as Error).message };
  }
}

/**
 * Sarcinile programate (Vercel Cron → GET /api/cron, cu `Authorization: Bearer <CRON_SECRET>`).
 * La fiecare rulare:
 *   1. recalculează alertele zilnice (chestionare lipsă, vize) pentru toate cluburile;
 *   2. creează mementourile „Completează chestionarul de azi" (ține cont de ora clubului / grupei);
 *   3. trimite pe e-mail un rezumat al notificărilor netrimise — fără date medicale;
 *   4. face curățenie: sesiuni și linkuri expirate, notificări citite vechi.
 * Fiecare pas este independent și poate fi repetat fără efecte duble.
 */
export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });

  const admin = createServiceDb();
  const started = Date.now();
  const result: Record<string, StepResult> = {};

  await step("alerts", result, async () => {
    const { data, error } = await admin.rpc("refresh_daily_alerts", {});
    if (error) throw new Error(error.message);
    return { checked: data ?? 0 };
  });

  await step("reminders", result, async () => {
    const { data, error } = await admin.rpc("send_wellness_reminders");
    if (error) throw new Error(error.message);
    return { created: data ?? 0 };
  });

  await step("emails", result, async () => {
    if (!emailConfigured()) return { skipped: "e-mail neconfigurat" };
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data, error } = await admin.from("notifications")
      .select("id, user_id, kind, profiles!inner ( email, role, is_active, email_notifications )")
      .is("emailed_at", null).is("read_at", null).gte("created_at", since)
      .order("created_at").limit(5000);
    if (error) throw new Error(error.message);

    const byUser = new Map<string, { email: string; role: AppRole; ids: string[]; kinds: string[] }>();
    for (const n of data ?? []) {
      const p = n.profiles;
      if (!p?.email || !p.is_active || !p.email_notifications) continue;
      const u = byUser.get(n.user_id) ?? { email: p.email, role: p.role, ids: [], kinds: [] };
      u.ids.push(n.id);
      u.kinds.push(n.kind);
      byUser.set(n.user_id, u);
    }

    let sent = 0;
    let failed = 0;
    let notifications = 0;
    for (const u of [...byUser.values()].slice(0, MAX_EMAILS_PER_RUN)) {
      const mail = buildDigest({ role: u.role, items: u.kinds.map((kind) => ({ kind })), appName: APP_NAME, siteUrl: SITE_URL });
      const ok = await sendEmail({ to: u.email, subject: mail.subject, text: mail.text }).catch(() => false);
      if (!ok) { failed++; continue; }
      const { error: upd } = await admin.from("notifications").update({ emailed_at: new Date().toISOString() }).in("id", u.ids);
      if (upd) throw new Error(upd.message);
      sent++;
      notifications += u.ids.length;
    }
    return { users: byUser.size, sent, failed, notifications, postponed: Math.max(0, byUser.size - MAX_EMAILS_PER_RUN) };
  });

  await step("cleanup", result, async () => {
    // Tabelele de autentificare sunt în schema `app_auth`, la care clientul de date nu are acces: interogări directe.
    const pool = getPool();
    const [sessions, tokens, attempts] = await Promise.all([
      pool.query("delete from app_auth.sessions where expires_at < now()"),
      pool.query("delete from app_auth.tokens where expires_at < now() - interval '7 days'"),
      pool.query("delete from app_auth.login_attempts where created_at < now() - interval '2 days'"),
    ]);
    const before = new Date(Date.now() - READ_RETENTION_DAYS * 24 * 3600 * 1000).toISOString();
    const { data, error } = await admin.from("notifications").delete().not("read_at", "is", null).lt("read_at", before).select("id");
    if (error) throw new Error(error.message);
    return {
      sessions: sessions.rowCount ?? 0, tokens: tokens.rowCount ?? 0, login_attempts: attempts.rowCount ?? 0,
      read_notifications: data?.length ?? 0,
    };
  });

  const failed = Object.values(result).some((r) => "error" in r);
  return NextResponse.json({ ok: !failed, ran_at: new Date().toISOString(), duration_ms: Date.now() - started, ...result }, { status: failed ? 500 : 200, headers });
}
