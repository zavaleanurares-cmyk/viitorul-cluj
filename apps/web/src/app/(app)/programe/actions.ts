"use server";
import { z } from "zod";
import { POSITIONS, PROGRAM_KINDS, scheduledDays } from "@club/shared";
import { run, fail } from "@/lib/actions";
import { getT } from "@/messages";
import { DateSchema, ItemsSchema, assertExercises, text } from "@/components/planning/schemas";

const keys = <T extends Record<string, string>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

const ProgramInput = z.object({
  id: z.uuid().nullable(),
  name: z.string().trim().min(1, "Scrie numele programului.").max(120, "Numele este prea lung (cel mult 120 de caractere)."),
  description: text(1000),
  kind: z.enum(keys(PROGRAM_KINDS)),
  is_template: z.boolean(),
  items: ItemsSchema,
});
export type ProgramInput = z.infer<typeof ProgramInput>;

/** Salvează programul și lista lui de exerciții (RPC atomic; itemii existenți își păstrează id-ul și bifele). */
export async function saveProgram(input: ProgramInput) {
  return run({ roles: ["physio"], revalidate: ["/programe"] }, async ({ db }) => {
    const t = getT().planning.programs;
    const v = ProgramInput.parse(input);
    if (!v.items.length) fail(t.form.itemsRequired);
    await assertExercises(db, v.items.map((i) => i.exercise_id));
    const { data, error } = await db.rpc("save_program", {
      p_id: v.id, p_name: v.name, p_description: v.description || null, p_kind: v.kind, p_is_template: v.is_template, p_items: v.items,
    });
    if (error) throw error;
    return { id: data as string, created: !v.id };
  });
}

export async function duplicateProgram(input: { id: string }) {
  return run({ roles: ["physio"], revalidate: ["/programe"] }, async ({ db }) => {
    const t = getT().planning.programs;
    const id = z.uuid().parse(input.id);
    const { data: source, error } = await db.from("programs")
      .select("name, description, kind, is_template, program_exercises ( exercise_id, sort, sets, reps, duration_sec, rest_sec, tempo, notes )")
      .eq("id", id).maybeSingle();
    if (error) throw error;
    if (!source) fail(t.notFound);
    const items = [...source.program_exercises].sort((a, b) => a.sort - b.sort).map((i) => ({
      id: null, exercise_id: i.exercise_id, sets: i.sets, reps: i.reps, duration_sec: i.duration_sec, rest_sec: i.rest_sec, tempo: i.tempo, notes: i.notes,
    }));
    const { data, error: saveError } = await db.rpc("save_program", {
      p_id: null,
      p_name: `${source.name} ${t.copySuffix}`.slice(0, 120),
      p_description: source.description,
      p_kind: source.kind,
      p_is_template: source.is_template,
      p_items: items,
    });
    if (saveError) throw saveError;
    return { id: data as string };
  });
}

const ActiveInput = z.object({ id: z.uuid(), active: z.boolean() });

/** Arhivare / scoatere din arhivă. Alocările rămân neschimbate. */
export async function setProgramActive(input: z.infer<typeof ActiveInput>) {
  return run({ roles: ["physio"], revalidate: ["/programe"] }, async ({ db }) => {
    const v = ActiveInput.parse(input);
    const { data, error } = await db.from("programs").update({ is_active: v.active }).eq("id", v.id).select("id");
    if (error) throw error;
    if (!data.length) fail(getT().planning.programs.notFound);
    return { active: v.active };
  });
}

/** Un program cu alocări nu se șterge (s-ar pierde bifele jucătorilor): se arhivează. */
export async function deleteProgram(input: { id: string }) {
  return run({ roles: ["physio"], revalidate: ["/programe"] }, async ({ db }) => {
    const t = getT().planning.programs;
    const id = z.uuid().parse(input.id);
    const { count, error: countError } = await db.from("program_assignments").select("id", { count: "exact", head: true }).eq("program_id", id);
    if (countError) throw countError;
    if (count) fail(t.deleteBlocked);
    const { data, error } = await db.from("programs").delete().eq("id", id).select("id");
    if (error) throw error;
    if (!data.length) fail(t.notFound);
  });
}

const AssignInput = z.object({
  programId: z.uuid(),
  target: z.enum(["player", "group", "position", "manual"]),
  groupId: z.uuid().nullable(),
  position: z.enum(keys(POSITIONS)).nullable(),
  playerIds: z.array(z.uuid()).max(500),
  start: DateSchema,
  end: DateSchema.nullable(),
  weekdays: z.array(z.number().int().min(1).max(7)).max(7),
  notes: text(500),
});
export type AssignInput = z.infer<typeof AssignInput>;

/** Alocă programul: un jucător, o grupă, un post (opțional într-o grupă) sau o selecție manuală. */
export async function assignProgram(input: AssignInput) {
  return run({ roles: ["physio"], revalidate: ["/programe"] }, async ({ db }) => {
    const t = getT().planning.assign;
    const v = AssignInput.parse(input);
    const weekdays = [...new Set(v.weekdays)].sort((a, b) => a - b);
    if (!weekdays.length) fail(t.errors.noDays);
    if (v.end && v.end < v.start) fail(t.errors.dates);
    if (v.end && !scheduledDays({ start_date: v.start, end_date: v.end, weekdays }, v.start, v.end).length) fail(t.errors.noScheduledDay);
    const playerIds = [...new Set(v.playerIds)];
    if (v.target === "group" && !v.groupId) fail(t.pickGroup);
    if (v.target === "position" && !v.position) fail(t.pickPosition);
    if (v.target === "player" && playerIds.length !== 1) fail(t.errors.noPlayers);
    if (v.target === "manual" && !playerIds.length) fail(t.errors.noPlayers);

    const { count, error: countError } = await db.from("program_exercises").select("id", { count: "exact", head: true }).eq("program_id", v.programId);
    if (countError) throw countError;
    if (!count) fail(t.errors.emptyProgram);

    const { data, error } = await db.rpc("assign_program", {
      p_program: v.programId,
      p_target_type: v.target,
      p_group: v.target === "group" || v.target === "position" ? v.groupId : null,
      p_position: v.target === "position" ? v.position : null,
      p_player_ids: v.target === "player" || v.target === "manual" ? playerIds : null,
      p_start: v.start,
      p_end: v.end,
      p_weekdays: weekdays,
      p_notes: v.notes || null,
    });
    if (error) {
      if (/niciun jucător/i.test(error.message ?? "")) fail(t.errors.noPlayers);
      throw error;
    }
    const { count: players } = await db.from("program_assignment_players").select("player_id", { count: "exact", head: true }).eq("assignment_id", data as string);
    return { id: data as string, players: players ?? 0 };
  });
}

/** Oprește o alocare: jucătorii nu o mai văd, iar aderența se calculează până în ziua opririi. */
export async function stopAssignment(input: { id: string }) {
  return run({ roles: ["physio"], revalidate: ["/programe"] }, async ({ db, ctx }) => {
    const id = z.uuid().parse(input.id);
    const { data: a, error: readError } = await db.from("program_assignments").select("id, start_date, end_date").eq("id", id).maybeSingle();
    if (readError) throw readError;
    if (!a) fail(getT().planning.assignments.notFound);
    const closeToday = a.start_date <= ctx.today && (!a.end_date || a.end_date > ctx.today);
    const { error } = await db.from("program_assignments")
      .update(closeToday ? { is_active: false, end_date: ctx.today } : { is_active: false }).eq("id", id);
    if (error) throw error;
  });
}

export async function deleteAssignment(input: { id: string }) {
  return run({ roles: ["physio"], revalidate: ["/programe"] }, async ({ db }) => {
    const id = z.uuid().parse(input.id);
    const { data, error } = await db.from("program_assignments").delete().eq("id", id).select("id");
    if (error) throw error;
    if (!data.length) fail(getT().planning.assignments.notFound);
  });
}
