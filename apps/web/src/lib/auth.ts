import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { can, getAppContext, homePath, type AppContext, type AppRole, type Capability, type Db } from "@club/shared";
import { createDb, getSessionUser } from "@club/db";
import { readSessionToken } from "./session";

export type Session = {
  /** client de date cu identitatea utilizatorului — fiecare interogare trece prin RLS */
  db: Db;
  ctx: AppContext;
  email: string;
  /** sesiune deschisă dintr-un link de invitație / resetare (poate seta parola fără cea veche) */
  viaLink: boolean;
  hasPassword: boolean;
};

/** Sesiunea curentă (o singură verificare pe cerere). Null dacă nu există utilizator sau profil activ. */
export const getSession = cache(async (): Promise<Session | null> => {
  const user = await getSessionUser(await readSessionToken());
  if (!user) return null;
  const db = createDb({ sub: user.userId, role: "authenticated" });
  const ctx = await getAppContext(db, user.userId);
  if (!ctx) return null;
  return { db, ctx, email: user.email, viaLink: user.viaLink, hasPassword: user.hasPassword };
});

/**
 * Folosit de fiecare pagină din zona autentificată.
 * Trimite la autentificare, la alegerea parolei sau la consimțământ, după caz.
 */
export async function requireSession(opts: { allowPendingSetup?: boolean } = {}): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/autentificare");
  if (!opts.allowPendingSetup) {
    if (session.ctx.profile.must_change_password || !session.hasPassword) redirect("/parola?prima=1");
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
