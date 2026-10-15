"use server";
import { z } from "zod";
import { run, fail } from "@/lib/actions";
import { getT } from "@/messages";

const t = getT().performance.body;
const num = (min: number, max: number) => z.number().min(min).max(max).nullish();

const Input = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rows: z.array(z.object({
    playerId: z.uuid(),
    weight: num(20, 200),
    height: num(80, 250),
    fat: num(2, 60),
  })).max(80),
});

/** Grila de greutate a unei echipe pentru o zi (doar preparatorul; RLS o impune). */
export async function saveBodyMeasurements(input: z.input<typeof Input>) {
  return run({ roles: ["physio"], revalidate: ["/performanta/corp", "layout:/lot/jucatori/[id]"] }, async ({ db }) => {
    const parsed = Input.safeParse(input);
    if (!parsed.success) fail(t.errors.range);
    const v = parsed.data;
    const { data, error } = await db.rpc("save_body_measurements", {
      p_date: v.date,
      p_rows: v.rows.map((r) => ({ player_id: r.playerId, weight_kg: r.weight ?? null, height_cm: r.height ?? null, body_fat_pct: r.fat ?? null })),
    });
    if (error) throw error;
    return { saved: (data as number) ?? 0 };
  });
}
