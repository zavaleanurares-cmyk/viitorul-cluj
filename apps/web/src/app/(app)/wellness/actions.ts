"use server";
import { z } from "zod";
import { addDays, getPlayer, isBodyZone, zoneIsSided } from "@club/shared";
import { run, fail } from "@/lib/actions";
import { getT } from "@/messages";

const t = getT().wellness;
const e = t.errors;

const score = z.number().int().min(1, e.scoreRange).max(10, e.scoreRange).nullable();

const EntryInput = z.object({
  playerId: z.uuid(),
  date: z.iso.date(),
  fatigue: score,
  muscleLoad: score,
  painZone: z.string().max(40).nullable(),
  painSide: z.enum(["left", "right", "both"]).nullable(),
  painIntensity: score,
  painNote: z.string().trim().max(300, e.noteTooLong).nullable(),
});
export type EntryInput = z.input<typeof EntryInput>;

/**
 * Preparatorul corectează un chestionar sau îl introduce în locul jucătorului.
 * Rândul existent își păstrează sursa (aplicație / import); un rând nou are sursa „staff".
 * La salvare marcajul „de verificat" dispare.
 */
export async function saveWellnessEntry(input: EntryInput) {
  return run({ roles: ["physio"], revalidate: ["/wellness"], message: t.dialog.saved }, async ({ db, ctx }) => {
    const v = EntryInput.parse(input);
    if (v.date > ctx.today) fail(e.futureDate);
    if (v.date < addDays(ctx.today, -730)) fail(e.tooOld);
    const zone = v.painZone ? (isBodyZone(v.painZone) ? v.painZone : fail(e.zoneUnknown)) : null;
    const note = v.painNote || null;
    const pain = !!zone || !!note;
    if (v.fatigue === null && v.muscleLoad === null && !pain) fail(e.empty);
    if (!(await getPlayer(db, v.playerId))) fail(e.playerNotFound);

    const values = {
      fatigue: v.fatigue,
      muscle_load: v.muscleLoad,
      pain_zone: zone,
      pain_side: zone && zoneIsSided(zone) ? v.painSide : null,
      pain_intensity: pain ? v.painIntensity : null,
      pain_note: note,
      needs_review: false,
      review_note: null,
    };
    const { data: existing, error: readError } = await db.from("wellness_entries").select("id")
      .eq("player_id", v.playerId).eq("entry_date", v.date).maybeSingle();
    if (readError) throw readError;
    if (existing) {
      const { data, error } = await db.from("wellness_entries").update(values).eq("id", existing.id).select("id");
      if (error) throw error;
      if (!data?.length) fail(e.forbidden);
      return { id: existing.id };
    }
    const { data, error } = await db.from("wellness_entries")
      .insert({ player_id: v.playerId, entry_date: v.date, source: "staff", ...values }).select("id").single();
    if (error) throw error;
    return { id: data.id };
  });
}

const IdInput = z.object({ id: z.uuid() });

export async function deleteWellnessEntry(input: z.infer<typeof IdInput>) {
  return run({ roles: ["physio"], revalidate: ["/wellness"], message: t.dialog.deleted }, async ({ db }) => {
    const v = IdInput.parse(input);
    const { data, error } = await db.from("wellness_entries").delete().eq("id", v.id).select("id");
    if (error) throw error;
    if (!data?.length) fail(e.entryNotFound);
    return { id: v.id };
  });
}

/** Închide o alertă (doar preparatorul; coloanele permise sunt doar resolved_at / resolved_by). */
export async function resolveAlert(input: z.infer<typeof IdInput>) {
  return run({ roles: ["physio"], revalidate: ["/wellness", "/tablou"], message: t.alerts.resolved }, async ({ db, ctx }) => {
    const v = IdInput.parse(input);
    const { data, error } = await db.from("alerts")
      .update({ resolved_at: new Date().toISOString(), resolved_by: ctx.userId })
      .eq("id", v.id).is("resolved_at", null).select("id");
    if (error) throw error;
    if (!data?.length) fail(e.alertNotFound);
    return { id: v.id };
  });
}
