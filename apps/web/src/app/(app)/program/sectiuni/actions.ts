"use server";
import { z } from "zod";
import { CAPABILITIES } from "@club/shared";
import { fail, run } from "@/lib/actions";
import { deleteFiles } from "@/lib/storage";
import { getT } from "@/messages";
import { Diagram } from "@/components/drills/diagram-schema";
import { getDrill } from "@/components/drills/queries";

const STAFF = [...CAPABILITIES.runEvents];
const PATHS = ["/program/sectiuni"];
const t = getT().drills;

const opt = (max: number) => z.string().trim().max(max).transform((v) => v || null);
const num = (min: number, max: number) => z.number().min(min).max(max).nullable();

const DrillInput = z.object({
  id: z.uuid().nullable(),
  name: z.string().trim().min(1, t.form.nameNeeded).max(120),
  ageGroup: opt(20),
  kind: opt(60),
  category: z.enum(["basics", "goalkeepers", "prevention", "technical", "physical", "mental", "tactical"]).nullable(),
  visibility: z.enum(["club", "private"]),
  players: num(0, 60).pipe(z.number().int().nullable()),
  goalkeepers: num(0, 6).pipe(z.number().int().nullable()),
  intensity: num(1, 5).pipe(z.number().int().nullable()),
  workMin: num(0.5, 120),
  restSec: num(0, 1800).pipe(z.number().int().nullable()),
  reps: num(1, 50).pipe(z.number().int().nullable()),
  area: opt(120),
  equipment: opt(500),
  organization: opt(4000),
  criteria: opt(4000),
  videoUrl: z.string().trim().max(500).refine((v) => !v || /^https:\/\/\S+$/.test(v), t.form.videoInvalid).transform((v) => v || null),
  diagram: Diagram.nullable(),
  imagePaths: z.array(z.string().max(300)).max(6),
});
export type DrillInput = z.input<typeof DrillInput>;

export async function saveDrill(input: DrillInput) {
  return run<{ id: string }>({ roles: STAFF, revalidate: PATHS, message: input.id ? t.form.saved : t.form.created }, async ({ db, ctx }) => {
    const v = DrillInput.parse(input);
    if (v.imagePaths.some((p) => !p.startsWith(`${ctx.club.id}/`))) fail("Calea imaginii nu este validă.");
    const row = {
      name: v.name, age_group: v.ageGroup, kind: v.kind, category: v.category, visibility: v.visibility,
      players: v.players, goalkeepers: v.goalkeepers, intensity: v.intensity, work_min: v.workMin, rest_sec: v.restSec, reps: v.reps,
      area: v.area, equipment: v.equipment, organization: v.organization, criteria: v.criteria, video_url: v.videoUrl,
      diagram: v.diagram && v.diagram.items.length ? v.diagram : null, image_paths: v.imagePaths,
    };
    if (v.id) {
      const before = await getDrill(db, v.id);
      if (!before) fail("Secțiunea nu a fost găsită.");
      const { data, error } = await db.from("drills").update(row).eq("id", v.id).select("id");
      if (error) throw error;
      if (!data?.length) fail("Doar autorul sau biroul pot modifica secțiunea.");
      // imaginile scoase din secțiune se șterg din depozit
      const removed = before.image_paths.filter((p) => !v.imagePaths.includes(p));
      if (removed.length) await deleteFiles(db, "drills", removed);
      return { id: v.id };
    }
    const { data, error } = await db.from("drills").insert({ ...row, club_id: ctx.club.id, created_by: ctx.userId }).select("id").single();
    if (error) throw error;
    return { id: data.id };
  });
}

const Id = z.object({ id: z.uuid() });

/** Copie proprie a unei secțiuni (de exemplu a altui antrenor), ca s-o poată adapta. Imaginile rămân ale originalului: nu se copiază. */
export async function copyDrill(input: z.infer<typeof Id>) {
  return run<{ id: string }>({ roles: STAFF, revalidate: PATHS, message: t.view.copied }, async ({ db, ctx }) => {
    const { id } = Id.parse(input);
    const d = await getDrill(db, id);
    if (!d) fail("Secțiunea nu a fost găsită.");
    const { data, error } = await db.from("drills").insert({
      club_id: ctx.club.id, created_by: ctx.userId, name: `${d.name}${t.view.copySuffix}`.slice(0, 120), age_group: d.age_group, kind: d.kind,
      category: d.category, visibility: "private", players: d.players, goalkeepers: d.goalkeepers, intensity: d.intensity, work_min: d.work_min,
      rest_sec: d.rest_sec, reps: d.reps, area: d.area, equipment: d.equipment, organization: d.organization, criteria: d.criteria,
      video_url: d.video_url, diagram: d.diagram, image_paths: [],
    }).select("id").single();
    if (error) throw error;
    return { id: data.id };
  });
}

const Archive = z.object({ id: z.uuid(), archived: z.boolean() });

export async function setDrillArchived(input: z.infer<typeof Archive>) {
  return run({ roles: STAFF, revalidate: PATHS }, async ({ db }) => {
    const v = Archive.parse(input);
    const { data, error } = await db.from("drills").update({ is_active: !v.archived }).eq("id", v.id).select("id");
    if (error) throw error;
    if (!data?.length) fail("Doar autorul sau biroul pot arhiva secțiunea.");
  });
}

export async function deleteDrill(input: z.infer<typeof Id>) {
  return run({ roles: STAFF, revalidate: PATHS, message: t.view.deleted }, async ({ db }) => {
    const { id } = Id.parse(input);
    const d = await getDrill(db, id);
    if (!d) fail("Secțiunea nu a fost găsită.");
    // fișierele întâi, cât rândul încă dă dreptul de ștergere
    if (d.image_paths.length) await deleteFiles(db, "drills", d.image_paths);
    const { data, error } = await db.from("drills").delete().eq("id", id).select("id");
    if (error) throw error;
    if (!data?.length) fail("Doar autorul sau biroul pot șterge secțiunea.");
  });
}

/** O imagine încărcată, dar nesalvată în secțiune (formular închis): se șterge. */
export async function discardDrillImage(input: { path: string }) {
  return run({ roles: STAFF }, async ({ db, ctx }) => {
    const path = z.string().max(300).parse(input.path);
    if (!path.startsWith(`${ctx.club.id}/`)) fail("Calea imaginii nu este validă.");
    await deleteFiles(db, "drills", [path]);
  });
}

const PlanInput = z.object({
  eventId: z.uuid(),
  theme: z.string().max(200),
  objectives: z.string().max(2000),
  description: z.string().max(4000),
  items: z.array(z.object({
    drillId: z.uuid().nullable(),
    title: z.string().trim().min(1).max(120),
    durationMin: z.number().int().min(1).max(240).nullable(),
    notes: z.string().max(1000),
  })).max(30),
});
export type PlanInput = z.infer<typeof PlanInput>;

export async function saveTrainingPlan(input: PlanInput) {
  return run({ roles: STAFF, revalidate: [`/program/${input.eventId}`, `/program/${input.eventId}/plan`], message: t.plan.saved }, async ({ db }) => {
    const v = PlanInput.parse(input);
    const { error } = await db.rpc("save_training_plan", {
      p_event: v.eventId,
      p: {
        theme: v.theme, objectives: v.objectives, description: v.description,
        items: v.items.map((i) => ({ drill_id: i.drillId, title: i.title, duration_min: i.durationMin, notes: i.notes })),
      },
    });
    if (error) fail(error.message);
  });
}
