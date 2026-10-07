"use server";
import { z } from "zod";
import { isMinor } from "@club/shared";
import { fail, run } from "@/lib/actions";
import { getT } from "@/messages";

const t = getT().player;

const phone = z.string().trim().max(30).regex(/^$|^[+0-9][0-9 ()./-]{5,}$/, t.errors.phoneInvalid);
const optionalEmail = z.union([z.literal(""), z.email(t.errors.emailInvalid)]);

const Account = z.object({
  fullName: z.string().trim().min(2, t.errors.nameNeeded).max(120),
  /** null = nu se modifică (jucătorii își țin telefonul la datele de contact) */
  phone: phone.nullable(),
  emailNotifications: z.boolean(),
});

/** Datele contului propriu — orice rol. RPC-ul modifică doar rândul apelantului. */
export async function updateAccount(input: z.infer<typeof Account>) {
  return run({ revalidate: ["/profil"], message: t.account.saved }, async ({ db }) => {
    const v = Account.parse(input);
    const { error } = await db.rpc("update_my_profile", {
      p_full_name: v.fullName,
      p_phone: v.phone,
      p_email_notifications: v.emailNotifications,
    });
    if (error) throw error;
  });
}

const Contact = z.object({
  phone,
  email: z.string().trim().max(200).pipe(optionalEmail),
  guardianName: z.string().trim().max(120),
  guardianPhone: phone,
  guardianEmail: z.string().trim().max(200).pipe(optionalEmail),
});

/** Datele de contact ale jucătorului (și ale părintelui, pentru minori). */
export async function saveContact(input: z.infer<typeof Contact>) {
  return run({ roles: ["player"], revalidate: ["/profil"], message: t.contact.saved }, async ({ db, ctx }) => {
    const v = Contact.parse(input);
    if (!ctx.player) fail(t.errors.noPlayer);
    const minor = isMinor(ctx.player.birth_date, ctx.today) === true;
    const { error } = await db.from("player_contacts").upsert(
      {
        player_id: ctx.player.id,
        phone: v.phone || null,
        email: v.email || null,
        // datele părintelui se editează doar la minori; la adulți rămân neatinse
        ...(minor ? { guardian_name: v.guardianName || null, guardian_phone: v.guardianPhone || null, guardian_email: v.guardianEmail || null } : {}),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "player_id" },
    );
    if (error) throw error;
    // un singur număr de telefon pentru jucător: îl ținem la fel și pe cont
    await db.rpc("update_my_profile", { p_phone: v.phone });
  });
}

const Photo = z.object({ path: z.string().max(300).nullable() });

/** Leagă fotografia încărcată de fișa jucătorului (sau o scoate, cu `path: null`) și șterge fișierul vechi. */
export async function setMyPhoto(input: z.infer<typeof Photo>) {
  return run({ roles: ["player"], revalidate: ["/profil"], message: input.path ? t.photo.saved : t.photo.removed }, async ({ db, ctx }) => {
    const v = Photo.parse(input);
    if (!ctx.player) fail(t.errors.noPlayer);
    if (v.path !== null && !new RegExp(`^${ctx.player.id}/[a-z0-9-]+\\.jpg$`).test(v.path)) fail(t.errors.photoInvalid);
    const previous = ctx.player.photo_path;
    const { error } = await db.rpc("set_my_photo", { p_path: v.path });
    if (error) throw error;
    if (previous && previous !== v.path) await db.storage.from("avatars").remove([previous]);
  });
}

const Request = z.object({
  kind: z.enum(["delete", "rectify", "withdraw_consent"]),
  message: z.string().trim().max(1000, t.errors.messageTooLong),
});

/** Cerere GDPR către club. O rezolvă preparatorul fizic; aici doar se înregistrează. */
export async function createDataRequest(input: z.infer<typeof Request>) {
  return run({ revalidate: ["/profil"], message: t.gdpr.requestSent }, async ({ db, ctx }) => {
    const v = Request.parse(input);
    if (v.kind === "rectify" && !v.message) fail(t.errors.rectifyNeedsMessage);
    const { data: open, error: openError } = await db.from("data_requests").select("id")
      .eq("user_id", ctx.userId).eq("kind", v.kind).eq("status", "open").limit(1);
    if (openError) throw openError;
    if (open?.length) fail(t.errors.requestExists);
    const { error } = await db.from("data_requests").insert({
      club_id: ctx.club.id,
      user_id: ctx.userId,
      player_id: ctx.player?.id ?? null,
      kind: v.kind,
      message: v.message || null,
    });
    if (error) throw error;
  });
}
