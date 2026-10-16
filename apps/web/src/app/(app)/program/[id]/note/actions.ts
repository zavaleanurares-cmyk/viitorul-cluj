"use server";
import { z } from "zod";
import { fail, run } from "@/lib/actions";
import { getT } from "@/messages";

const Input = z.object({ eventId: z.uuid(), ratings: z.record(z.uuid(), z.number().int().min(1).max(5).nullable()) });

/** Notele unui antrenament (null șterge nota). */
export async function saveTrainingRatings(input: z.infer<typeof Input>) {
  return run<number>({ roles: ["admin", "secretary", "sporting_director", "physio", "coach"], revalidate: [`/program/${input.eventId}`, "/program/activitate"], message: getT().activity.ratings.saved }, async ({ db }) => {
    const v = Input.parse(input);
    const { data, error } = await db.rpc("save_training_ratings", { p_event: v.eventId, p_ratings: v.ratings });
    if (error) fail(error.message);
    return (data as number) ?? 0;
  });
}
