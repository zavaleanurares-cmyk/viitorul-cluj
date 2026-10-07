"use server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { EQUIPMENT, EXERCISE_CATEGORIES, EXERCISE_LEVELS, isBodyZone, parseVideoUrl } from "@club/shared";
import { run, fail } from "@/lib/actions";
import { deleteFiles, safeFileName } from "@/lib/storage";
import { canAccess } from "@/lib/files";
import { getT } from "@/messages";
import { getExerciseUsage } from "@/components/planning/queries";
import { text } from "@/components/planning/schemas";

const BUCKET = "exercise-media";
const MAX_CLIP_BYTES = 100 * 1024 * 1024;
const CLIP_TYPES: Record<string, string> = { mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime" };

const keys = <T extends Record<string, string>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];
const httpUrl = (s: string) => {
  try {
    return ["http:", "https:"].includes(new URL(s).protocol);
  } catch {
    return false;
  }
};

const ClipInput = z.object({ fileName: z.string().min(1).max(300), size: z.number().int().positive(), type: z.string().max(100) });

/**
 * Pregătește încărcarea unui clip: verifică tipul și mărimea și întoarce calea din bucketul privat
 * (`<club_id>/<uuid>-<nume-sigur>`). Fișierul este trimis apoi din browser cu `uploadFile`.
 */
export async function prepareClipUpload(input: z.infer<typeof ClipInput>) {
  return run({ roles: ["physio"] }, async ({ ctx }) => {
    const t = getT().library.form;
    const v = ClipInput.parse(input);
    const safe = safeFileName(v.fileName);
    const ext = safe.includes(".") ? safe.slice(safe.lastIndexOf(".") + 1) : "";
    const contentType = CLIP_TYPES[ext];
    if (!contentType || (v.type && !Object.values(CLIP_TYPES).includes(v.type))) fail(t.fileWrongType);
    if (v.size > MAX_CLIP_BYTES) fail(t.fileTooBig);
    return { path: `${ctx.club.id}/${randomUUID()}-${safe}`, contentType };
  });
}

/** Șterge un clip încărcat care nu a mai ajuns să fie legat de un exercițiu (salvare eșuată). */
export async function discardClipUpload(input: { path: string }) {
  return run({ roles: ["physio"] }, async ({ db, ctx }) => {
    const path = z.string().max(400).parse(input.path);
    if (!path.startsWith(`${ctx.club.id}/`)) fail("Calea fișierului nu este validă.");
    const { count } = await db.from("exercises").select("id", { count: "exact", head: true }).eq("video_path", path);
    if (!count) await deleteFiles(db, BUCKET, [path]);
  });
}

const ExerciseInput = z.object({
  id: z.uuid().nullable(),
  name: z.string().trim().min(1, "Scrie numele exercițiului.").max(120, "Numele este prea lung (cel mult 120 de caractere)."),
  description: text(2000),
  steps: z.array(text(500)).max(20, "Cel mult 20 de pași."),
  category: z.enum(keys(EXERCISE_CATEGORIES)),
  level: z.enum(keys(EXERCISE_LEVELS)),
  zones: z.array(z.string()).max(22),
  equipment: z.array(z.enum(keys(EQUIPMENT))).max(17),
  contraindications: text(1000),
  video: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("none") }),
    z.object({ kind: z.literal("file"), path: z.string().min(1).max(400) }),
    z.object({ kind: z.literal("link"), url: z.string().trim().min(1).max(500) }),
  ]),
  image_url: text(500),
  source: text(200),
  license: text(100),
  attribution: text(300),
});
export type ExerciseInput = z.infer<typeof ExerciseInput>;

export async function saveExercise(input: ExerciseInput) {
  return run({ roles: ["physio"], revalidate: ["/biblioteca"] }, async ({ db, ctx }) => {
    const t = getT().library.form;
    const v = ExerciseInput.parse(input);

    let videoPath: string | null = null;
    let videoUrl: string | null = null;
    if (v.video.kind === "file") {
      videoPath = v.video.path;
      if (!videoPath.startsWith(`${ctx.club.id}/`)) fail("Calea fișierului nu este validă.");
      if (!(await canAccess(db, BUCKET, videoPath, "read"))) fail(t.uploadFailed);
      // un fișier aparține unui singur exercițiu (altfel ștergerea unuia l-ar lăsa pe celălalt fără clip)
      let others = db.from("exercises").select("id", { count: "exact", head: true }).eq("video_path", videoPath);
      if (v.id) others = others.neq("id", v.id);
      const { count } = await others;
      if (count) fail(t.clipInUse);
    } else if (v.video.kind === "link") {
      if (!parseVideoUrl(v.video.url)) fail(t.linkInvalid);
      videoUrl = v.video.url;
    }
    const imageUrl = v.image_url || null;
    if (imageUrl && !httpUrl(imageUrl)) fail(t.imageInvalid);
    if ((videoPath || videoUrl || imageUrl) && !(v.source && v.license && v.attribution)) fail(t.licenseRequired);

    const values = {
      name: v.name,
      description: v.description || null,
      steps: v.steps.filter(Boolean),
      category: v.category,
      level: v.level,
      zones: [...new Set(v.zones.filter(isBodyZone))],
      equipment: [...new Set(v.equipment)],
      contraindications: v.contraindications || null,
      video_path: videoPath,
      video_url: videoUrl,
      image_url: imageUrl,
      source: v.source || null,
      license: v.license || null,
      attribution: v.attribution || null,
    };

    if (!v.id) {
      const { data, error } = await db.from("exercises").insert({ ...values, club_id: ctx.club.id, created_by: ctx.userId }).select("id").single();
      if (error) throw error;
      return { id: data.id, created: true };
    }

    const { data: before, error: readError } = await db.from("exercises").select("video_path").eq("id", v.id).maybeSingle();
    if (readError) throw readError;
    if (!before) fail("Exercițiul nu a fost găsit.");
    const { error } = await db.from("exercises").update(values).eq("id", v.id);
    if (error) throw error;
    // clipul vechi nu mai este folosit de nimeni: îl ștergem din depozit
    if (before.video_path && before.video_path !== videoPath) await deleteFiles(db, BUCKET, [before.video_path]);
    return { id: v.id, created: false };
  });
}

const ActiveInput = z.object({ id: z.uuid(), active: z.boolean() });

export async function setExerciseActive(input: z.infer<typeof ActiveInput>) {
  return run({ roles: ["physio"], revalidate: ["/biblioteca"] }, async ({ db }) => {
    const v = ActiveInput.parse(input);
    const { data, error } = await db.from("exercises").update({ is_active: v.active }).eq("id", v.id).select("id");
    if (error) throw error;
    if (!data.length) fail("Exercițiul nu a fost găsit.");
    return { active: v.active };
  });
}

/** Ștergerea este permisă doar dacă exercițiul nu apare în niciun program sau plan. */
export async function deleteExercise(input: { id: string }) {
  return run({ roles: ["physio"], revalidate: ["/biblioteca"] }, async ({ db }) => {
    const t = getT().library.detail;
    const id = z.uuid().parse(input.id);
    const usage = await getExerciseUsage(db, id);
    if (usage.programs.length || usage.planCount) fail(t.inUse(usage.programs.length, usage.planCount));
    const { data, error } = await db.from("exercises").delete().eq("id", id).select("video_path");
    if (error) throw error;
    if (!data.length) fail("Exercițiul nu a fost găsit.");
    if (data[0].video_path) await deleteFiles(db, BUCKET, [data[0].video_path]);
  });
}
