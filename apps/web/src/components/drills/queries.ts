import type { Db } from "@club/shared";
import { Diagram } from "./diagram-schema";

export type DrillRow = {
  id: string;
  name: string;
  age_group: string | null;
  kind: string | null;
  category: string | null;
  visibility: "club" | "private";
  players: number | null;
  goalkeepers: number | null;
  intensity: number | null;
  work_min: number | null;
  rest_sec: number | null;
  reps: number | null;
  area: string | null;
  equipment: string | null;
  organization: string | null;
  criteria: string | null;
  video_url: string | null;
  diagram: Diagram | null;
  image_paths: string[];
  is_active: boolean;
  created_by: string | null;
  author: string | null;
  updated_at: string;
};

const COLS = "id, name, age_group, kind, category, visibility, players, goalkeepers, intensity, work_min, rest_sec, reps, area, equipment, organization, criteria, video_url, diagram, image_paths, is_active, created_by, updated_at, profiles!drills_created_by_fkey(full_name)";

type Raw = Omit<DrillRow, "author" | "diagram" | "work_min"> & { diagram: unknown; work_min: number | string | null; profiles: { full_name: string } | null };

function shape(r: Raw): DrillRow {
  const { profiles, ...rest } = r;
  const parsed = Diagram.safeParse(r.diagram);
  return { ...rest, work_min: r.work_min == null ? null : Number(r.work_min), diagram: parsed.success ? parsed.data : null, author: profiles?.full_name ?? null };
}

/** Durata unei secțiuni: repetări × efort + pauzele dintre repetări (în minute). */
export function drillMinutes(d: { reps: number | null; work_min: number | null; rest_sec: number | null }): number | null {
  if (!d.reps || !d.work_min) return null;
  return Math.round((d.reps * d.work_min + ((d.reps - 1) * (d.rest_sec ?? 0)) / 60) * 10) / 10;
}

/** Secțiunile vizibile utilizatorului (RLS: cele ale clubului + cele private proprii). */
export async function listDrills(db: Db, opts: { includeArchived?: boolean } = {}): Promise<DrillRow[]> {
  let q = db.from("drills").select(COLS).order("updated_at", { ascending: false }).limit(1000);
  if (!opts.includeArchived) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data as unknown as Raw[]).map(shape);
}

export async function getDrill(db: Db, id: string): Promise<DrillRow | null> {
  const { data, error } = await db.from("drills").select(COLS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? shape(data as unknown as Raw) : null;
}

/** În câte planuri apare secțiunea. */
export async function drillUsage(db: Db, id: string): Promise<number> {
  const { data } = await db.from("training_plan_items").select("event_id").eq("drill_id", id);
  return new Set((data ?? []).map((r) => r.event_id)).size;
}

export type PlanItem = { id: string; drill_id: string | null; title: string; duration_min: number | null; notes: string | null };
export type TrainingPlan = {
  theme: string | null; objectives: string | null; description: string | null;
  updated_at: string; updated_by: string | null; items: PlanItem[];
};

export async function getPlan(db: Db, eventId: string): Promise<TrainingPlan | null> {
  const [plan, items] = await Promise.all([
    db.from("training_plans").select("theme, objectives, description, updated_at, profiles!training_plans_updated_by_fkey(full_name)").eq("event_id", eventId).maybeSingle(),
    db.from("training_plan_items").select("id, drill_id, title, duration_min, notes").eq("event_id", eventId).order("position"),
  ]);
  if (plan.error) throw plan.error;
  if (!plan.data) return null;
  const p = plan.data as unknown as { theme: string | null; objectives: string | null; description: string | null; updated_at: string; profiles: { full_name: string } | null };
  return { theme: p.theme, objectives: p.objectives, description: p.description, updated_at: p.updated_at, updated_by: p.profiles?.full_name ?? null, items: items.data ?? [] };
}
