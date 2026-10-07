import "server-only";
import { cookies, headers } from "next/headers";
import { SESSION_COOKIE, SESSION_DAYS, type SessionInfo } from "@club/db";

/** Cookie-ul de sesiune: httpOnly (invizibil pentru JavaScript), Secure în producție, SameSite=Lax. */
export async function setSessionCookie(session: SessionInfo) {
  (await cookies()).set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function readSessionToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

export async function requestMeta(): Promise<{ userAgent: string | null; ip: string | null }> {
  const h = await headers();
  return {
    userAgent: h.get("user-agent"),
    ip: (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip"),
  };
}
