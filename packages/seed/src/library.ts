/**
 * Încarcă biblioteca de exerciții și șabloanele de programe (db/seed/library.json) într-un club.
 * Idempotent: exercițiile și programele se potrivesc după `slug`; cele deja existente NU sunt
 * suprascrise decât cu `force`.
 */
import type { Db } from "@club/db";
import library from "../../../db/seed/library.json";
import { must } from "./common";

type LibExercise = {
  slug: string; name: string; description: string; steps: string[]; category: string; zones: string[]; equipment: string[];
  level: string; contraindications: string | null; video_url: string | null; image_url: string | null;
  source: string | null; license: string | null; attribution: string | null;
};
type LibProgram = {
  slug: string; name: string; description: string; kind: string;
  items: Array<{ exercise: string; sets: number | null; reps: string | null; duration_sec: number | null; rest_sec: number | null; tempo: string | null; notes: string | null }>;
};

export async function seedLibrary(admin: Db, clubSlug: string, force = false) {
  const lib = library as unknown as { exercises: LibExercise[]; programs: LibProgram[] };
  const club = must(await admin.from("clubs").select("id, name").eq("slug", clubSlug).single(), "club");
  const existing = must(await admin.from("exercises").select("id, slug").eq("club_id", club.id), "exerciții");
  const bySlug = new Map(existing.filter((e) => e.slug).map((e) => [e.slug!, e.id]));
  let added = 0, updated = 0;
  for (const e of lib.exercises) {
    const row = {
      club_id: club.id, slug: e.slug, name: e.name, description: e.description, steps: e.steps, category: e.category,
      zones: e.zones, equipment: e.equipment, level: e.level, contraindications: e.contraindications,
      video_url: e.video_url, image_url: e.image_url, source: e.source, license: e.license, attribution: e.attribution,
    };
    const id = bySlug.get(e.slug);
    if (!id) {
      const created = must(await admin.from("exercises").insert(row).select("id").single(), `exercițiu ${e.slug}`);
      bySlug.set(e.slug, created.id);
      added++;
    } else if (force) {
      must(await admin.from("exercises").update(row).eq("id", id).select("id"), `exercițiu ${e.slug}`);
      updated++;
    }
  }
  let programs = 0;
  for (const p of lib.programs) {
    const { data: found } = await admin.from("programs").select("id").eq("club_id", club.id).eq("slug", p.slug).maybeSingle();
    if (found && !force) continue;
    const items = p.items.map((i) => {
      const exercise_id = bySlug.get(i.exercise);
      if (!exercise_id) throw new Error(`Programul ${p.slug} folosește un exercițiu inexistent: ${i.exercise}`);
      return { exercise_id, sets: i.sets, reps: i.reps, duration_sec: i.duration_sec, rest_sec: i.rest_sec, tempo: i.tempo, notes: i.notes };
    });
    let id = found?.id;
    if (!id) {
      id = must(await admin.from("programs").insert({ club_id: club.id, slug: p.slug, name: p.name, description: p.description, kind: p.kind, is_template: true }).select("id").single(), `program ${p.slug}`).id;
    } else {
      await admin.from("programs").update({ name: p.name, description: p.description, kind: p.kind }).eq("id", id);
      await admin.from("program_exercises").delete().eq("program_id", id);
    }
    must(await admin.from("program_exercises").insert(items.map((it, k) => ({ ...it, program_id: id!, sort: k + 1 }))).select("id"), "exerciții program");
    programs++;
  }
  return bySlug;
}

