import crypto from "node:crypto";
import { createUser, findUserByEmail, setPassword, type Db } from "@club/db";
import type { Database } from "@club/shared";

export type SeededAccount = { label: string; email: string; password: string };

export function randomPassword(): string {
  // ușor de dictat: 3 grupuri de litere/cifre, fără caractere care se confundă
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
  const existing = await findUserByEmail(a.email);
  let userId: string;
  if (existing) {
    userId = existing.id;
    await setPassword(userId, a.password);
  } else {
    userId = (await createUser({ email: a.email, password: a.password })).id;
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
    if (a.group_ids.length) must(await admin.from("staff_groups").insert(a.group_ids.map((g) => ({ user_id: userId, group_id: g }))).select("user_id"), "grupe staff");
  }
  if (a.player_id) must(await admin.from("players").update({ user_id: userId }).eq("id", a.player_id).select("id"), "legare jucător");
  return userId;
}
