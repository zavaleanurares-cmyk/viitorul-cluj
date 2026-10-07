"use server";
import { z } from "zod";
import { RTP_STAGES, addDays } from "@club/shared";
import { run, fail } from "@/lib/actions";
import { getT } from "@/messages";
import { DateSchema, ItemsSchema, assertExercises, text } from "@/components/planning/schemas";

const PlanInput = z.object({
  playerId: z.uuid(),
  date: DateSchema,
  title: text(120),
  notes: text(2000),
  injuryId: z.uuid().nullable(),
  rtpStage: z.number().int().min(0).max(RTP_STAGES.length - 1).nullable(),
  items: ItemsSchema,
});
export type PlanInput = z.infer<typeof PlanInput>;

/** Salvează planul unei zile (RPC atomic; itemii păstrați își păstrează bifele). */
export async function savePlan(input: PlanInput) {
  return run({ roles: ["physio"], revalidate: ["/planuri"] }, async ({ db }) => {
    const t = getT().planning.editor;
    const v = PlanInput.parse(input);
    if (!v.items.length && !v.notes) fail(t.emptyPlan);
    await assertExercises(db, v.items.map((i) => i.exercise_id));
    if (v.injuryId) {
      const { data: injury, error } = await db.from("injuries").select("id").eq("id", v.injuryId).eq("player_id", v.playerId).maybeSingle();
      if (error) throw error;
      if (!injury) fail(t.injuryMismatch);
    }
    const { data, error } = await db.rpc("save_daily_plan", {
      p_player: v.playerId,
      p_date: v.date,
      p_title: v.title || null,
      p_notes: v.notes || null,
      p_injury: v.injuryId,
      p_rtp_stage: v.injuryId ? v.rtpStage : null,
      p_items: v.items,
    });
    if (error) throw error;
    return { id: data as string };
  });
}

export async function deletePlan(input: { planId: string }) {
  return run({ roles: ["physio"], revalidate: ["/planuri"] }, async ({ db }) => {
    const id = z.uuid().parse(input.planId);
    const { data, error } = await db.from("daily_plans").delete().eq("id", id).select("id");
    if (error) throw error;
    if (!data.length) fail(getT().planning.editor.notFound);
  });
}

const CopyInput = z.object({
  planId: z.uuid(),
  dates: z.array(DateSchema).min(1, "Alege cel puțin o zi.").max(31),
  /** null = același jucător */
  playerIds: z.array(z.uuid()).min(1, "Alege cel puțin un jucător.").max(300).nullable(),
});

/** Copiază planul pe alte zile și / sau la alți jucători. Planurile existente în țintă sunt înlocuite. */
export async function copyPlan(input: z.infer<typeof CopyInput>) {
  return run({ roles: ["physio"], revalidate: ["/planuri"] }, async ({ db }) => {
    const v = CopyInput.parse(input);
    const { data, error } = await db.rpc("copy_daily_plan", {
      p_plan: v.planId,
      p_dates: [...new Set(v.dates)].sort(),
      p_players: v.playerIds ? [...new Set(v.playerIds)] : null,
    });
    if (error) throw error;
    return { copied: (data as number) ?? 0 };
  });
}

const YesterdayInput = z.object({ playerId: z.uuid(), date: DateSchema });

/** Scurtătură: planul de ieri al jucătorului devine planul zilei (doar dacă ziua nu are încă plan). */
export async function copyYesterdayPlan(input: z.infer<typeof YesterdayInput>) {
  return run({ roles: ["physio"], revalidate: ["/planuri"] }, async ({ db }) => {
    const t = getT().planning.editor;
    const v = YesterdayInput.parse(input);
    const { data: plans, error } = await db.from("daily_plans").select("id, plan_date")
      .eq("player_id", v.playerId).in("plan_date", [addDays(v.date, -1), v.date]);
    if (error) throw error;
    if (plans.some((p) => p.plan_date === v.date)) fail(t.alreadyHasPlan);
    const source = plans.find((p) => p.plan_date !== v.date);
    if (!source) fail(t.noYesterday);
    const { error: copyError } = await db.rpc("copy_daily_plan", { p_plan: source.id, p_dates: [v.date], p_players: null });
    if (copyError) throw copyError;
  });
}
