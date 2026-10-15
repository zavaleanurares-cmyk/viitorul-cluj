"use server";
import { z } from "zod";
import { KIT_SIZES } from "@club/shared";
import { run } from "@/lib/actions";
import { getT } from "@/messages";

/** Părintele sau jucătorul își alege mărimea echipamentului; biroul o vede în fișă și în magazin. */
export async function setKitSize(input: { playerId: string; size: string }) {
  return run({ revalidate: ["/azi"], message: getT().club.onboarding.sizeSaved }, async ({ db }) => {
    const v = z.object({ playerId: z.uuid(), size: z.union([z.enum(KIT_SIZES), z.literal("")]) }).parse(input);
    const { error } = await db.rpc("set_kit_size", { p_player: v.playerId, p_size: v.size });
    if (error) throw error;
    return null;
  });
}
