"use server";
import { markNotificationsRead } from "@club/shared";
import { run } from "@/lib/actions";
import { getT } from "@/messages";

/** Marchează ca citite toate notificările utilizatorului (RLS: doar pe ale lui). */
export async function markAllRead() {
  return run({ revalidate: ["/notificari"], message: getT().notifications.markedAll }, async ({ db }) => {
    await markNotificationsRead(db);
  });
}
