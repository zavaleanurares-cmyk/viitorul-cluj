import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Database } from "../packages/shared/src/database.types";

export const root = path.resolve(import.meta.dirname, "..");

/** Încarcă variabilele: mediul curent > apps/web/.env.local > stiva locală. */
export function loadEnv() {
  for (const file of [path.join(root, "apps/web/.env.local"), path.join(root, "tools/local-stack/.data/env")]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const i = line.indexOf("=");
      if (i > 0 && !line.startsWith("#")) process.env[line.slice(0, i).trim()] ??= line.slice(i + 1).trim();
    }
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) {
    throw new Error("Lipsesc NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY.");
  }
  return { url, anon, service };
}

export type Db = SupabaseClient<Database>;

export function serviceClient(): Db {
  const { url, service } = loadEnv();
  return createClient<Database>(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function userClient(email: string, password: string): Promise<Db> {
  const { url, anon } = loadEnv();
  const db = createClient<Database>(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Autentificare eșuată pentru ${email}: ${error.message}`);
  return db;
}

export function anonClient(): Db {
  const { url, anon } = loadEnv();
  return createClient<Database>(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function randomPassword(): string {
  // ușor de dictat: 4 grupuri de litere/cifre, fără caractere care se confundă
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const pick = (n: number) => Array.from(crypto.randomBytes(n), (b) => alphabet[b % alphabet.length]).join("");
  return `${pick(4)}-${pick(4)}-${pick(4)}`;
}

export function must<T>(res: { data: T; error: { message: string } | null }, what = ""): NonNullable<T> {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data as NonNullable<T>;
}

/** Creează (sau actualizează) un cont cu profil. Întoarce id-ul utilizatorului. */
export async function ensureAccount(
  admin: Db,
  a: { email: string; password: string; full_name: string; role: Database["public"]["Enums"]["app_role"]; club_id: string; group_ids?: string[]; player_id?: string },
): Promise<string> {
  let userId: string | undefined;
  const created = await admin.auth.admin.createUser({ email: a.email, password: a.password, email_confirm: true });
  if (created.error) {
    // există deja: îl căutăm și îi resetăm parola
    let page = 1;
    while (!userId) {
      const list = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (list.error) throw list.error;
      userId = list.data.users.find((u) => u.email === a.email)?.id;
      if (list.data.users.length < 200) break;
      page++;
    }
    if (!userId) throw new Error(`Nu pot crea contul ${a.email}: ${created.error.message}`);
    must(await admin.auth.admin.updateUserById(userId, { password: a.password }), "resetare parolă");
  } else {
    userId = created.data.user.id;
  }
  must(
    await admin.from("profiles").upsert({
      id: userId, club_id: a.club_id, role: a.role, full_name: a.full_name, email: a.email,
      is_active: true, email_notifications: false,
    }).select("id"),
    "profil",
  );
  if (a.group_ids) {
    await admin.from("staff_groups").delete().eq("user_id", userId);
    if (a.group_ids.length) must(await admin.from("staff_groups").insert(a.group_ids.map((g) => ({ user_id: userId!, group_id: g }))).select("user_id"), "grupe staff");
  }
  if (a.player_id) must(await admin.from("players").update({ user_id: userId }).eq("id", a.player_id).select("id"), "legare jucător");
  return userId;
}

/** Citește parola unui cont demo din conturi-demo.local.md. */
export function demoPassword(email: string): string {
  const file = path.join(root, "conturi-demo.local.md");
  const line = fs.readFileSync(file, "utf8").split("\n").find((l) => l.includes(`| ${email} |`));
  const m = line && /`([^`]+)`/.exec(line);
  if (!m) throw new Error(`Nu găsesc parola pentru ${email} în conturi-demo.local.md`);
  return m[1];
}
