"use server";
import { z } from "zod";
import { sessionLoad, setCompletion, submitRpe, type DayItem, type Db } from "@club/shared";
import { fail, run } from "@/lib/actions";
import { canTickOn } from "@/components/player/queries";
import { getT } from "@/messages";

const t = getT().player.errors;

const ItemRef = z.object({
  date: z.iso.date(),
  planItemId: z.uuid().nullable(),
  assignmentId: z.uuid().nullable(),
  programExerciseId: z.uuid().nullable(),
});
type ItemRefInput = z.infer<typeof ItemRef>;

type Existing = NonNullable<DayItem["completion"]>;

/**
 * Verifică faptul că exercițiul este chiar al jucătorului (planul lui sau un program alocat lui)
 * și întoarce bifa existentă, citită din baza de date — nu din ce trimite browserul.
 */
async function resolveItem(db: Db, playerId: string, today: string, ref: ItemRefInput) {
  if (!canTickOn(ref.date, today)) fail(ref.date > today ? t.futureDay : t.tooOld);
  const isPlan = !!ref.planItemId && !ref.assignmentId && !ref.programExerciseId;
  const isProgram = !ref.planItemId && !!ref.assignmentId && !!ref.programExerciseId;
  if (!isPlan && !isProgram) fail(t.unknownExercise);

  let existing: Existing | null = null;
  if (isPlan) {
    const [item, comp] = await Promise.all([
      db.from("daily_plan_items").select("id, daily_plans!inner ( player_id, plan_date )").eq("id", ref.planItemId!).maybeSingle(),
      db.from("exercise_completions").select("id, done, comment, pain, pain_intensity")
        .eq("player_id", playerId).eq("plan_item_id", ref.planItemId!).maybeSingle(),
    ]);
    if (item.error) throw item.error;
    if (comp.error) throw comp.error;
    const plan = item.data?.daily_plans;
    if (!plan || plan.player_id !== playerId || plan.plan_date !== ref.date) fail(t.unknownExercise);
    existing = comp.data;
  } else {
    const [member, exercise, comp] = await Promise.all([
      db.from("program_assignment_players").select("assignment_id, program_assignments!inner ( program_id )")
        .eq("assignment_id", ref.assignmentId!).eq("player_id", playerId).maybeSingle(),
      db.from("program_exercises").select("id, program_id").eq("id", ref.programExerciseId!).maybeSingle(),
      db.from("exercise_completions").select("id, done, comment, pain, pain_intensity")
        .eq("player_id", playerId).eq("done_on", ref.date)
        .eq("assignment_id", ref.assignmentId!).eq("program_exercise_id", ref.programExerciseId!).maybeSingle(),
    ]);
    if (member.error) throw member.error;
    if (exercise.error) throw exercise.error;
    if (comp.error) throw comp.error;
    if (!member.data || !exercise.data || exercise.data.program_id !== member.data.program_assignments.program_id) fail(t.unknownExercise);
    existing = comp.data;
  }
  return {
    existing,
    item: {
      plan_item_id: ref.planItemId, assignment_id: ref.assignmentId, program_exercise_id: ref.programExerciseId,
      completion: existing,
    },
  };
}

const Toggle = ItemRef.extend({ done: z.boolean() });

/** O atingere pe bifă: marchează exercițiul făcut / nefăcut, păstrând comentariul și durerea deja notate. */
export async function toggleExercise(input: z.infer<typeof Toggle>) {
  return run({ roles: ["player"], revalidate: ["/azi", "/plan"] }, async ({ db, ctx }) => {
    const v = Toggle.parse(input);
    if (!ctx.player) fail(t.noPlayer);
    const { existing, item } = await resolveItem(db, ctx.player.id, ctx.today, v);
    await setCompletion(db, ctx.player.id, v.date, item, {
      done: v.done,
      comment: existing?.comment ?? null,
      pain: existing?.pain ?? false,
      pain_intensity: existing?.pain_intensity ?? null,
    });
    return { done: v.done };
  });
}

const Note = ItemRef.extend({
  comment: z.string().trim().max(500, t.commentTooLong),
  pain: z.boolean(),
  painIntensity: z.number().int().min(1).max(10).nullable(),
});

/** Comentariu și / sau durere la un exercițiu. Nu schimbă bifa. */
export async function saveExerciseNote(input: z.infer<typeof Note>) {
  return run({ roles: ["player"], revalidate: ["/azi", "/plan"], message: getT().player.day.noteSaved }, async ({ db, ctx }) => {
    const v = Note.parse(input);
    if (!ctx.player) fail(t.noPlayer);
    if (v.pain && v.painIntensity === null) fail(t.painIntensityNeeded);
    const { existing, item } = await resolveItem(db, ctx.player.id, ctx.today, v);
    await setCompletion(db, ctx.player.id, v.date, item, {
      done: existing?.done ?? false,
      comment: v.comment,
      pain: v.pain,
      pain_intensity: v.pain ? v.painIntensity : null,
    });
  });
}

const Rpe = z.object({
  sessionType: z.enum(["training", "match"]),
  rpe: z.number().int().min(1, t.rpeRange).max(10, t.rpeRange),
  durationMin: z.number().int(t.durationRange).min(1, t.durationRange).max(300, t.durationRange),
});

/** RPE după antrenament / meci, pentru ziua de azi. Un rând pe tip de sesiune; al doilea apel corectează. */
export async function saveRpe(input: z.infer<typeof Rpe>) {
  return run({ roles: ["player"], revalidate: ["/azi"], message: getT().player.rpe.saved }, async ({ db, ctx }) => {
    const v = Rpe.parse(input);
    if (!ctx.player) fail(t.noPlayer);
    await submitRpe(db, ctx.player.id, ctx.today, v.sessionType, v.rpe, v.durationMin);
    return { load: sessionLoad(v.rpe, v.durationMin) };
  });
}
