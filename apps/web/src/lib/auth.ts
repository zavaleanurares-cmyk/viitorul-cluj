import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { can, getAppContext, homePath, type AppContext, type AppRole, type Capability, type Db } from "@club/shared";
import { createClient } from "./supabase/server";

export type Session = { db: Db; ctx: AppContext; email: string | null };

/** Sesiunea curentă (o singură interogare pe cerere). Null dacă nu există utilizator sau profil activ. */
export const getSession = cache(async (): Promise<Session | null> => {
  const db = (await createClient()) as unknown as Db;
  const { data } = await db.auth.getUser();
  if (!data.user) return null;
  const ctx = await getAppContext(db, data.user.id);
  if (!ctx) return null;
  return { db, ctx, email: data.user.email ?? null };
});

/**
 * Folosit de fiecare pagină din zona autentificată.
 * Trimite la autentificare, la schimbarea parolei inițiale sau la consimțământ, după caz.
 */
export async function requireSession(opts: { allowPendingSetup?: boolean } = {}): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/autentificare");
  if (!opts.allowPendingSetup) {
    if (session.ctx.profile.must_change_password) redirect("/parola?prima=1");
    if (!session.ctx.consentAccepted) redirect("/consimtamant");
  }
  return session;
}

/** Pagina este doar pentru anumite roluri; ceilalți sunt trimiși la pagina lor de start. */
export async function requireRole(...roles: AppRole[]): Promise<Session> {
  const session = await requireSession();
  if (!roles.includes(session.ctx.role)) redirect(homePath(session.ctx.role));
  return session;
}

export async function requireCapability(capability: Capability): Promise<Session> {
  const session = await requireSession();
  if (!can(session.ctx.role, capability)) redirect(homePath(session.ctx.role));
  return session;
}

/** Grupele pe care utilizatorul le poate vedea (antrenor: ale lui; restul staff-ului: toate). */
export function visibleGroups(ctx: AppContext) {
  const active = ctx.groups.filter((g) => g.is_active);
  return ctx.role === "coach" ? active.filter((g) => ctx.staffGroupIds.includes(g.id)) : active;
}
