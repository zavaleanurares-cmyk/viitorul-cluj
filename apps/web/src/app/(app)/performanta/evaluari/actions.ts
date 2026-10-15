"use server";
import { z } from "zod";
import { run, fail } from "@/lib/actions";
import { getT } from "@/messages";
import { CATEGORIES, STANDARD_TEMPLATES } from "@/components/performance/evaluation-templates";

const t = getT().performance.evaluations;
const MANAGERS = ["sporting_director", "physio"] as const;
const PATHS = ["/performanta/evaluari"];

const Template = z.object({
  id: z.uuid().nullish(),
  name: z.string().trim().min(2).max(80),
  ageLabel: z.string().trim().max(40).nullish(),
  criteria: z.array(z.object({ id: z.uuid().nullish(), category: z.enum(CATEGORIES as [string, ...string[]]), name: z.string().trim().min(2).max(80), description: z.string().trim().max(300).nullish() })).min(1).max(40),
});

export async function saveEvaluationTemplate(input: z.input<typeof Template>) {
  return run({ roles: [...MANAGERS], revalidate: PATHS, message: t.templateSaved }, async ({ db }) => {
    const v = Template.safeParse(input);
    if (!v.success) fail(t.errors.templateInvalid);
    const { data, error } = await db.rpc("save_evaluation_template", { p: {
      id: v.data.id ?? null, name: v.data.name, age_label: v.data.ageLabel ?? null,
      criteria: v.data.criteria.map((c) => ({ id: c.id ?? null, category: c.category, name: c.name, description: c.description ?? null })),
    } });
    if (error) throw error;
    return { id: data as string };
  });
}

export async function addStandardTemplate(input: { key: string }) {
  return run({ roles: [...MANAGERS], revalidate: PATHS, message: t.templateSaved }, async ({ db }) => {
    const s = STANDARD_TEMPLATES.find((x) => x.key === input.key);
    if (!s) fail(t.errors.templateInvalid);
    const { data, error } = await db.rpc("save_evaluation_template", { p: { name: s.name, age_label: s.age_label, criteria: s.criteria } });
    if (error) throw error;
    return { id: data as string };
  });
}

const Round = z.object({ name: z.string().trim().min(2).max(80), templateId: z.uuid(), groupIds: z.array(z.uuid()).min(1).max(30), dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish() });

export async function startEvaluationRound(input: z.input<typeof Round>) {
  return run({ roles: [...MANAGERS], revalidate: PATHS, message: t.started }, async ({ db }) => {
    const v = Round.safeParse(input);
    if (!v.success) fail(t.errors.invalid);
    const { data, error } = await db.rpc("start_evaluation_round", { p: { name: v.data.name, template_id: v.data.templateId, group_ids: v.data.groupIds, due_on: v.data.dueOn ?? null } });
    if (error) throw error;
    return { id: data as string };
  });
}

const Save = z.object({
  roundId: z.uuid(), playerId: z.uuid(),
  scores: z.record(z.uuid(), z.number().int().min(1).max(5)),
  strengths: z.string().max(1000).nullish(), nextGoals: z.string().max(1000).nullish(), comment: z.string().max(2000).nullish(),
  submit: z.boolean(),
});

export async function saveEvaluation(input: z.input<typeof Save>) {
  return run({ roles: ["sporting_director", "physio", "coach"], revalidate: [...PATHS, `/performanta/evaluari/${input.roundId}`], message: input.submit ? t.submitted : t.saved }, async ({ db }) => {
    const v = Save.parse(input);
    const { data, error } = await db.rpc("save_evaluation", {
      p_round: v.roundId, p_player: v.playerId, p_scores: v.scores, p_strengths: v.strengths ?? undefined,
      p_next_goals: v.nextGoals ?? undefined, p_comment: v.comment ?? undefined, p_submit: v.submit,
    });
    if (error) throw error;
    return { id: data as string };
  });
}

export async function publishEvaluationRound(input: { roundId: string }) {
  return run({ roles: [...MANAGERS], revalidate: PATHS }, async ({ db }) => {
    const id = z.uuid().parse(input.roundId);
    const { data, error } = await db.rpc("publish_evaluation_round", { p_round: id });
    if (error) throw error;
    return { notified: (data as number) ?? 0 };
  });
}

export async function deleteEvaluationRound(input: { roundId: string }) {
  return run({ roles: [...MANAGERS], revalidate: PATHS, message: t.roundDeleted }, async ({ db }) => {
    const id = z.uuid().parse(input.roundId);
    const { error } = await db.rpc("delete_evaluation_round", { p_round: id });
    if (error) throw error;
    return null;
  });
}
