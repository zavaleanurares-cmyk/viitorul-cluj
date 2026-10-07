"use server";
import { z } from "zod";
import { isBodyZone, submitWellness, wellnessConfigForGroup, zoneIsSided } from "@club/shared";
import { fail, run } from "@/lib/actions";
import { getT } from "@/messages";

const t = getT().player;

const score = z.number().int().min(1).max(10);

const Input = z.object({
  fatigue: score,
  muscleLoad: score,
  pain: z.object({
    zone: z.string(),
    side: z.enum(["left", "right", "both"]).nullable(),
    intensity: score,
    note: z.string().trim().max(300, t.errors.commentTooLong),
  }).nullable(),
  sleepQuality: score.nullable(),
  sleepHours: z.number().min(0).max(16).nullable(),
  stress: score.nullable(),
  mood: score.nullable(),
});

/** Chestionarul de azi. Data vine de pe server (fusul clubului), nu din browser; a doua salvare corectează. */
export async function saveWellness(input: z.infer<typeof Input>) {
  return run({ roles: ["player"], revalidate: ["/azi", "/chestionar"], message: t.wellness.saved }, async ({ db, ctx }) => {
    const parsed = Input.safeParse(input);
    if (!parsed.success) fail(t.errors.wellnessInvalid);
    const v = parsed.data;
    if (!ctx.player) fail(t.errors.noPlayer);
    if (v.pain && !isBodyZone(v.pain.zone)) fail(t.errors.painZoneNeeded);

    // întrebările suplimentare se salvează doar dacă sunt active pe grupa jucătorului
    const config = wellnessConfigForGroup(ctx.groups.find((g) => g.id === ctx.player!.group_id));
    if (config.sleep && v.sleepQuality === null) fail(t.errors.extraNeeded);
    if (config.stress && v.stress === null) fail(t.errors.extraNeeded);
    if (config.mood && v.mood === null) fail(t.errors.extraNeeded);

    await submitWellness(db, ctx.player.id, ctx.today, {
      fatigue: v.fatigue,
      muscle_load: v.muscleLoad,
      pain_zone: v.pain?.zone ?? null,
      pain_side: v.pain && zoneIsSided(v.pain.zone) ? v.pain.side : null,
      pain_intensity: v.pain?.intensity ?? null,
      pain_note: v.pain?.note || null,
      sleep_quality: config.sleep ? v.sleepQuality : null,
      sleep_hours: config.sleep ? v.sleepHours : null,
      stress: config.stress ? v.stress : null,
      mood: config.mood ? v.mood : null,
    });
    return { date: ctx.today };
  });
}
