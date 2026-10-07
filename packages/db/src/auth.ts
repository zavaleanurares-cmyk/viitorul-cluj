/**
 * Autentificare proprie: utilizatori, parole, sesiuni, linkuri de invitație / resetare.
 *
 *  - parolele se păstrează doar ca hash scrypt cu sare individuală;
 *  - sesiunea este un token aleator de 256 de biți, ținut în cookie httpOnly; în bază stă doar SHA-256 al lui;
 *  - linkurile de invitație și de resetare sunt de unică folosință și expiră;
 *  - încercările de autentificare eșuate sunt numărate și limitate.
 * Tabelele sunt în schema `app_auth`, la care rolurile aplicației (authenticated / anon) nu au niciun drept.
 */
import crypto from "node:crypto";
import { promisify } from "node:util";
import { getPool } from "./pool";

const scrypt = promisify(crypto.scrypt) as (password: string, salt: Buffer, keylen: number, options: crypto.ScryptOptions) => Promise<Buffer>;

const SCRYPT = { N: 32768, r: 8, p: 1, keylen: 64, maxmem: 128 * 32768 * 8 * 2 };
export const SESSION_DAYS = 30;
export const SESSION_COOKIE = "sesiune";
export const PASSWORD_MIN_LENGTH = 10;

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");
const randomToken = () => crypto.randomBytes(32).toString("base64url");
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: SCRYPT.maxmem });
  return `scrypt:${SCRYPT.N}:${SCRYPT.r}:${SCRYPT.p}:${salt.toString("base64")}:${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  // și când nu există utilizator facem același calcul, ca timpul de răspuns să nu-l trădeze
  const [scheme, n, r, p, salt, hash] = (stored ?? `scrypt:${SCRYPT.N}:${SCRYPT.r}:${SCRYPT.p}:AAAAAAAAAAAAAAAAAAAAAA==:`).split(":");
  if (scheme !== "scrypt") return false;
  const expected = Buffer.from(hash ?? "", "base64");
  const actual = await scrypt(password.normalize("NFKC"), Buffer.from(salt, "base64"), expected.length || SCRYPT.keylen, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: 128 * Number(n) * Number(r) * 2,
  });
  return !!stored && expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export type AuthUser = { id: string; email: string; disabled: boolean; hasPassword: boolean; lastSignInAt: string | null };

function toUser(r: Record<string, unknown>): AuthUser {
  return {
    id: r.id as string, email: r.email as string, disabled: r.disabled_at !== null,
    hasPassword: r.password_hash !== null, lastSignInAt: r.last_sign_in_at ? new Date(r.last_sign_in_at as string).toISOString() : null,
  };
}

export async function findUserByEmail(email: string): Promise<AuthUser | null> {
  const { rows } = await getPool().query("select * from app_auth.users where lower(email) = $1", [normalizeEmail(email)]);
  return rows[0] ? toUser(rows[0]) : null;
}

export async function getUser(id: string): Promise<AuthUser | null> {
  const { rows } = await getPool().query("select * from app_auth.users where id = $1", [id]);
  return rows[0] ? toUser(rows[0]) : null;
}

export class AuthError extends Error {
  constructor(public code: "email_taken" | "weak_password" | "invalid_email", message: string) {
    super(message);
  }
}

function assertPassword(password: string) {
  if (password.length < PASSWORD_MIN_LENGTH) throw new AuthError("weak_password", `Parola trebuie să aibă cel puțin ${PASSWORD_MIN_LENGTH} caractere.`);
  if (password.length > 200) throw new AuthError("weak_password", "Parola este prea lungă.");
}

/** Creează un utilizator. Fără parolă, contul se activează printr-un link de invitație. */
export async function createUser(input: { email: string; password?: string | null }): Promise<AuthUser> {
  const email = input.email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AuthError("invalid_email", "Adresa de e-mail nu este validă.");
  if (input.password) assertPassword(input.password);
  const hash = input.password ? await hashPassword(input.password) : null;
  try {
    const { rows } = await getPool().query("insert into app_auth.users (email, password_hash) values ($1, $2) returning *", [email, hash]);
    return toUser(rows[0]);
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new AuthError("email_taken", "Există deja un cont cu această adresă de e-mail.");
    throw e;
  }
}

/** Schimbă parola și închide toate sesiunile celelalte ale utilizatorului. */
export async function setPassword(userId: string, password: string, keepSessionToken?: string): Promise<void> {
  assertPassword(password);
  const hash = await hashPassword(password);
  const pool = getPool();
  await pool.query("update app_auth.users set password_hash = $2, updated_at = now() where id = $1", [userId, hash]);
  await pool.query("delete from app_auth.sessions where user_id = $1 and token_hash is distinct from $2", [userId, keepSessionToken ? sha256(keepSessionToken) : null]);
  await pool.query("update app_auth.sessions set via_link = false where user_id = $1", [userId]);
}

export async function setUserDisabled(userId: string, disabled: boolean): Promise<void> {
  const pool = getPool();
  await pool.query("update app_auth.users set disabled_at = case when $2 then coalesce(disabled_at, now()) end where id = $1", [userId, disabled]);
  if (disabled) await pool.query("delete from app_auth.sessions where user_id = $1", [userId]);
}

export async function setUserEmail(userId: string, email: string): Promise<void> {
  try {
    await getPool().query("update app_auth.users set email = $2, updated_at = now() where id = $1", [userId, email.trim()]);
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new AuthError("email_taken", "Există deja un cont cu această adresă de e-mail.");
    throw e;
  }
}

export async function deleteUser(userId: string): Promise<void> {
  await getPool().query("delete from app_auth.users where id = $1", [userId]);
}

// ---------------------------------------------------------------------------
// Sesiuni
// ---------------------------------------------------------------------------
export type SessionInfo = { token: string; expiresAt: Date };

export async function createSession(userId: string, meta: { userAgent?: string | null; ip?: string | null; viaLink?: boolean } = {}): Promise<SessionInfo> {
  const token = randomToken();
  const { rows } = await getPool().query(
    `insert into app_auth.sessions (user_id, token_hash, expires_at, user_agent, ip, via_link)
     values ($1, $2, now() + make_interval(days => $3), $4, $5, $6) returning expires_at`,
    [userId, sha256(token), SESSION_DAYS, meta.userAgent?.slice(0, 300) ?? null, meta.ip?.slice(0, 60) ?? null, !!meta.viaLink],
  );
  await getPool().query("update app_auth.users set last_sign_in_at = now() where id = $1", [userId]);
  return { token, expiresAt: rows[0].expires_at };
}

/** Utilizatorul unei sesiuni valide; prelungește sesiunea când a trecut de jumătatea duratei. */
export async function getSessionUser(token: string | null | undefined): Promise<{ userId: string; email: string; viaLink: boolean; hasPassword: boolean } | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const { rows } = await getPool().query(
    `select s.id, s.user_id, s.expires_at, s.last_seen_at, s.via_link, u.email, u.password_hash is not null as has_password
     from app_auth.sessions s join app_auth.users u on u.id = s.user_id
     where s.token_hash = $1 and s.expires_at > now() and u.disabled_at is null`,
    [sha256(token)],
  );
  const s = rows[0];
  if (!s) return null;
  const hour = 3600_000;
  if (Date.now() - new Date(s.last_seen_at).getTime() > hour) {
    const half = (SESSION_DAYS * 24 * hour) / 2;
    const extend = new Date(s.expires_at).getTime() - Date.now() < half;
    getPool()
      .query(`update app_auth.sessions set last_seen_at = now()${extend ? ", expires_at = now() + make_interval(days => $2)" : ""} where id = $1`, extend ? [s.id, SESSION_DAYS] : [s.id])
      .catch(() => {});
  }
  return { userId: s.user_id, email: s.email, viaLink: s.via_link, hasPassword: s.has_password };
}

/** Verifică parola curentă a unui utilizator (la schimbarea voluntară a parolei). */
export async function checkPassword(userId: string, password: string): Promise<boolean> {
  const { rows } = await getPool().query("select password_hash from app_auth.users where id = $1", [userId]);
  return verifyPassword(password, rows[0]?.password_hash);
}

export async function deleteSession(token: string | null | undefined): Promise<void> {
  if (token) await getPool().query("delete from app_auth.sessions where token_hash = $1", [sha256(token)]);
}

export async function deleteUserSessions(userId: string): Promise<void> {
  await getPool().query("delete from app_auth.sessions where user_id = $1", [userId]);
}

// ---------------------------------------------------------------------------
// Autentificare cu parolă, cu limitarea încercărilor
// ---------------------------------------------------------------------------
const WINDOW_MINUTES = 15;
const MAX_FAILURES_PER_EMAIL = 8;
const MAX_FAILURES_PER_IP = 40;

export type SignInResult = { ok: true; userId: string; session: SessionInfo } | { ok: false; reason: "invalid" | "locked" };

export async function signInWithPassword(input: { email: string; password: string; userAgent?: string | null; ip?: string | null }): Promise<SignInResult> {
  const pool = getPool();
  const email = normalizeEmail(input.email);
  const ip = input.ip?.slice(0, 60) ?? null;
  const { rows: fails } = await pool.query(
    `select count(*) filter (where email = $1)::int as by_email, count(*) filter (where ip = $2)::int as by_ip
     from app_auth.login_attempts where not succeeded and created_at > now() - make_interval(mins => $3) and (email = $1 or ip = $2)`,
    [email, ip, WINDOW_MINUTES],
  );
  if (fails[0].by_email >= MAX_FAILURES_PER_EMAIL || fails[0].by_ip >= MAX_FAILURES_PER_IP) return { ok: false, reason: "locked" };

  const { rows } = await pool.query("select id, password_hash, disabled_at from app_auth.users where lower(email) = $1", [email]);
  const user = rows[0];
  const valid = (await verifyPassword(input.password, user?.password_hash)) && !!user && user.disabled_at === null;
  await pool.query("insert into app_auth.login_attempts (email, ip, succeeded) values ($1, $2, $3)", [email, ip, valid]);
  if (!valid) return { ok: false, reason: "invalid" };
  // curățenie ocazională
  if (Math.random() < 0.05) {
    pool.query("delete from app_auth.login_attempts where created_at < now() - interval '2 days'").catch(() => {});
    pool.query("delete from app_auth.sessions where expires_at < now()").catch(() => {});
    pool.query("delete from app_auth.tokens where expires_at < now() - interval '7 days'").catch(() => {});
  }
  return { ok: true, userId: user.id, session: await createSession(user.id, input) };
}

// ---------------------------------------------------------------------------
// Linkuri de unică folosință: invitație și resetare de parolă
// ---------------------------------------------------------------------------
export type TokenKind = "invite" | "recovery";

export async function createOneTimeToken(userId: string, kind: TokenKind, ttlHours: number): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken();
  const pool = getPool();
  // un singur link activ de același fel per utilizator
  await pool.query("delete from app_auth.tokens where user_id = $1 and kind = $2 and used_at is null", [userId, kind]);
  const { rows } = await pool.query(
    "insert into app_auth.tokens (token_hash, user_id, kind, expires_at) values ($1, $2, $3, now() + make_interval(hours => $4)) returning expires_at",
    [sha256(token), userId, kind, ttlHours],
  );
  return { token, expiresAt: rows[0].expires_at };
}

/** Validează și consumă un link. Întoarce utilizatorul sau null dacă linkul e greșit, folosit sau expirat. */
export async function consumeOneTimeToken(token: string, kinds: TokenKind[] = ["invite", "recovery"]): Promise<{ userId: string; kind: TokenKind } | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const { rows } = await getPool().query(
    `update app_auth.tokens t set used_at = now()
     from app_auth.users u
     where t.token_hash = $1 and t.used_at is null and t.expires_at > now() and t.kind = any($2)
       and u.id = t.user_id and u.disabled_at is null
     returning t.user_id, t.kind`,
    [sha256(token), kinds],
  );
  return rows[0] ? { userId: rows[0].user_id, kind: rows[0].kind } : null;
}
