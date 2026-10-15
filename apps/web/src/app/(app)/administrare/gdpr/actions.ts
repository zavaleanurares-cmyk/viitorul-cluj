"use server";
import { z } from "zod";
import { deleteUser, deleteUserSessions, setUserDisabled, setUserEmail } from "@club/db";
import { fail, run } from "@/lib/actions";
import type { Session } from "@/lib/auth";
import { deleteFiles } from "@/lib/storage";
import { isBucket } from "@/lib/files";
import { anonymizedEmail, targetProfile } from "@/components/admin/server";
import { getT } from "@/messages";

const t = getT().admin;
const PATHS = ["/administrare", "/administrare/gdpr"];

const Resolve = z.object({
  id: z.uuid(),
  status: z.enum(["done", "rejected"]),
  response: z.string().trim().min(3, t.errors.responseNeeded).max(2000),
});

/** Închide o cerere cu un răspuns scris. Acțiunile propriu-zise (export, anonimizare, ștergere) se fac separat. */
export async function resolveRequest(input: z.infer<typeof Resolve>) {
  return run({ roles: ["physio"], revalidate: PATHS, message: t.gdpr.requestResolved }, async ({ db, ctx }) => {
    const v = Resolve.parse(input);
    const { data, error } = await db.from("data_requests")
      .update({ status: v.status, response: v.response, handled_by: ctx.userId, handled_at: new Date().toISOString() })
      .eq("id", v.id).eq("status", "open").select("id");
    if (error) throw error;
    if (!data?.length) fail(t.errors.requestNotFound);
  });
}

const Player = z.object({ playerId: z.uuid() });

/** Înregistrează retragerea acordului pentru un jucător: toate acordurile lui active primesc data retragerii. */
export async function withdrawPlayerConsents(input: z.infer<typeof Player>) {
  return run({ roles: ["physio"], revalidate: PATHS, message: t.gdpr.consentWithdrawn }, async ({ db }) => {
    const v = Player.parse(input);
    const { data, error } = await db.from("consents").update({ withdrawn_at: new Date().toISOString() })
      .eq("player_id", v.playerId).is("withdrawn_at", null).select("id");
    if (error) throw error;
    if (!data?.length) fail(t.errors.noActiveConsent);
  });
}

const Irreversible = z.object({ playerId: z.uuid(), confirmName: z.string().trim().max(200) });

/** Jucătorul-țintă al unei operațiuni ireversibile, verificat: clubul apelantului și numele tastat. */
async function confirmedPlayer(session: Session, input: z.infer<typeof Irreversible>) {
  const v = Irreversible.parse(input);
  const { data: player, error } = await session.db.from("players")
    .select("id, club_id, display_name, user_id, photo_path, anonymized_at").eq("id", v.playerId).maybeSingle();
  if (error) throw error;
  if (!player || player.club_id !== session.ctx.club.id) fail(t.errors.playerNotFound);
  if (v.confirmName !== player.display_name.trim()) fail(t.errors.confirmMismatch);
  // contul legat trebuie să fie tot al clubului, înainte de orice apel care nu trece prin RLS
  if (player.user_id) await targetProfile(session, player.user_id);
  return player;
}

/** Fișierele din depozit se șterg înainte de rândurile din baza de date (după aceea nu mai avem căile). */
async function removePlayerFiles({ db }: Session, player: { id: string; photo_path: string | null }) {
  const { data: docs, error } = await db.from("medical_documents").select("storage_path").eq("player_id", player.id);
  if (error) throw error;
  const paths = docs.map((d) => d.storage_path);
  const removed = await deleteFiles(db, "medical", paths);
  if (removed !== paths.length) fail(t.errors.filesNotDeleted);
  if (player.photo_path) await deleteFiles(db, "avatars", [player.photo_path]);
  // modulele fazei 4 (vize, contracte, video…): baza de date spune ce fișiere are jucătorul
  const { data: more, error: e2 } = await db.rpc("player_file_paths", { p_player: player.id });
  if (e2) throw e2;
  const byBucket = new Map<string, string[]>();
  for (const f of more ?? []) byBucket.set(f.bucket, [...(byBucket.get(f.bucket) ?? []), f.path]);
  for (const [bucket, list] of byBucket) {
    if (!isBucket(bucket)) continue;
    const n = await deleteFiles(db, bucket, list);
    if (n !== list.length) fail(t.errors.filesNotDeleted);
  }
}

/** Anonimizare: datele statistice rămân, identitatea dispare. Ireversibilă. */
export async function anonymizePlayer(input: z.infer<typeof Irreversible>) {
  return run({ roles: ["physio"], revalidate: [...PATHS, "/lot", "layout:/lot/jucatori/[id]"], message: t.gdpr.anonymized }, async (session) => {
    const player = await confirmedPlayer(session, input);
    if (player.anonymized_at) fail(t.errors.alreadyAnonymized);
    await removePlayerFiles(session, player);
    const { error } = await session.db.rpc("anonymize_player", { p_player: player.id });
    if (error) throw error;
    if (player.user_id) {
      // contul nu mai poate fi folosit și nu mai poartă adresa de e-mail a persoanei
      await setUserDisabled(player.user_id, true);
      await deleteUserSessions(player.user_id);
      await setUserEmail(player.user_id, anonymizedEmail(player.user_id));
    }
  });
}

/** Ștergere definitivă: fișierele, fișa jucătorului cu tot ce ține de ea, apoi contul. Ireversibilă. */
export async function erasePlayer(input: z.infer<typeof Irreversible>) {
  return run({ roles: ["physio"], revalidate: [...PATHS, "/lot", "layout:/lot/jucatori/[id]"], message: t.gdpr.erased }, async (session) => {
    const player = await confirmedPlayer(session, input);
    await removePlayerFiles(session, player);
    const { data: userId, error } = await session.db.rpc("erase_player", { p_player: player.id });
    if (error) throw error;
    // id-ul întors de baza de date este cel verificat mai sus (contul legat de acest jucător)
    if (userId && userId === player.user_id) await deleteUser(userId);
  });
}
