import fs from "node:fs";
import path from "node:path";

export const root = path.resolve(import.meta.dirname, "..");

/** Încarcă variabilele: mediul curent > apps/web/.env.local > Postgres-ul local. */
export function loadEnv() {
  for (const file of [path.join(root, "apps/web/.env.local"), path.join(root, "tools/local-stack/.data/env")]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const i = line.indexOf("=");
      if (i > 0 && !line.startsWith("#")) process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim();
    }
  }
  if (!process.env.DATABASE_URL) throw new Error("Lipsește DATABASE_URL.");
}
loadEnv();

const dbModule = await import("../packages/db/src/index");
export const { closePool, createAnonDb, createDb, createServiceDb, createUser, deleteUser, findUserByEmail, getPool, setPassword } = dbModule;
export type Db = ReturnType<typeof createDb>;

/** Client care ocolește RLS (seed, administrare). */
export function serviceClient(): Db {
  return createServiceDb();
}

/** Client cu identitatea unui utilizator (RLS activ), fără autentificare prin parolă. */
export async function userClient(email: string): Promise<Db> {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`Nu există utilizatorul ${email}`);
  return createDb({ sub: user.id, role: "authenticated" });
}

export function anonClient(): Db {
  return createAnonDb();
}

export { ensureAccount, must, randomPassword } from "../packages/seed/src";

/** Citește parola unui cont demo din conturi-demo.local.md. */
export function demoPassword(email: string): string {
  const file = path.join(root, "conturi-demo.local.md");
  const line = fs.readFileSync(file, "utf8").split("\n").find((l) => l.includes(`| ${email} |`));
  const m = line && /`([^`]+)`/.exec(line);
  if (!m) throw new Error(`Nu găsesc parola pentru ${email} în conturi-demo.local.md`);
  return m[1];
}
