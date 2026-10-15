import "server-only";
import type { Db } from "@club/shared";
import type { Category } from "./evaluation-templates";
import type { TemplateRow } from "./evaluation-admin";

export async function loadTemplates(db: Db): Promise<TemplateRow[]> {
  const { data } = await db.from("evaluation_templates")
    .select("id, name, age_label, is_active, evaluation_criteria(id, category, name, description, sort, is_active)").eq("is_active", true).order("name");
  return (data ?? []).map((x) => ({
    id: x.id, name: x.name, age_label: x.age_label,
    criteria: [...(x.evaluation_criteria ?? [])].filter((c) => c.is_active).sort((a, b) => a.sort - b.sort)
      .map((c) => ({ id: c.id, category: c.category as Category, name: c.name, description: c.description })),
  }));
}

export type RoundPlayer = { id: string; name: string; groupId: string | null; status: "none" | "draft" | "submitted"; evaluationId: string | null; evaluatorId: string | null };

/** O rundă: criteriile modelului, echipele, jucătorii vizibili (antrenorul: ai lui) și starea fiecărei evaluări. */
export async function loadRound(db: Db, roundId: string) {
  const { data: round } = await db.from("evaluation_rounds")
    .select("id, name, status, due_on, template_id, created_at, published_at, evaluation_round_groups(group_id)").eq("id", roundId).maybeSingle();
  if (!round) return null;
  const groupIds = (round.evaluation_round_groups ?? []).map((g) => g.group_id);
  const [{ data: crit }, { data: players }, { data: evals }] = await Promise.all([
    db.from("evaluation_criteria").select("id, category, name, description, sort, is_active").eq("template_id", round.template_id).order("sort"),
    groupIds.length ? db.from("players").select("id, display_name, group_id").in("group_id", groupIds).eq("is_active", true).is("anonymized_at", null).order("display_name") : Promise.resolve({ data: [] }),
    db.from("evaluations").select("id, player_id, status, evaluator_id").eq("round_id", roundId),
  ]);
  const byPlayer = new Map((evals ?? []).map((e) => [e.player_id, e]));
  const roster: RoundPlayer[] = (players ?? []).map((p) => {
    const e = byPlayer.get(p.id);
    return { id: p.id, name: p.display_name, groupId: p.group_id, status: (e?.status as "draft" | "submitted" | undefined) ?? "none", evaluationId: e?.id ?? null, evaluatorId: e?.evaluator_id ?? null };
  });
  const criteria = (crit ?? []).filter((c) => c.is_active).map((c) => ({ id: c.id, category: c.category as Category, name: c.name, description: c.description }));
  return { round, groupIds, criteria, roster };
}
