"use server";
import { z } from "zod";
import { VIDEO_TAGS, parseMatchVideoUrl } from "@club/shared";
import { run, fail } from "@/lib/actions";
import { deleteFiles } from "@/lib/storage";
import { getT } from "@/messages";

const t = getT().performance.video;
const PATHS = ["/performanta/video"];
const STAFF = ["sporting_director", "physio", "coach"] as const;

const Add = z.object({
  title: z.string().trim().min(2).max(120),
  url: z.string().trim().max(500).nullish(),
  storagePath: z.string().max(300).nullish(),
  groupId: z.uuid().nullish(),
  eventId: z.uuid().nullish(),
  recordedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function addVideo(input: z.input<typeof Add>) {
  return run({ roles: [...STAFF], revalidate: PATHS, message: t.added }, async ({ db, ctx }) => {
    const v = Add.parse(input);
    let source: "veo" | "youtube" | "vimeo" | "upload" | "other";
    let url: string | null = null;
    if (v.storagePath) {
      if (!v.storagePath.startsWith(`${ctx.club.id}/`)) fail(t.errors.source);
      source = "upload";
    } else {
      const p = v.url ? parseMatchVideoUrl(v.url) : null;
      if (!p) fail(t.errors.source);
      source = p.source;
      url = p.url;
    }
    const { data, error } = await db.from("videos").insert({
      club_id: ctx.club.id, title: v.title, source, url, storage_path: v.storagePath ?? null,
      group_id: v.groupId ?? null, event_id: v.eventId ?? null, recorded_on: v.recordedOn, created_by: ctx.userId,
    }).select("id").single();
    if (error) throw error;
    return { id: data.id };
  });
}

export async function deleteVideo(input: { id: string }) {
  return run({ roles: [...STAFF], revalidate: PATHS, message: t.deleted }, async ({ db }) => {
    const id = z.uuid().parse(input.id);
    const { data: v } = await db.from("videos").select("storage_path").eq("id", id).maybeSingle();
    if (!v) fail(t.errors.notFound);
    if (v.storage_path) await deleteFiles(db, "videos", [v.storage_path]);
    const { error } = await db.from("videos").delete().eq("id", id);
    if (error) throw error;
    return null;
  });
}

const Marker = z.object({
  id: z.uuid().nullish(),
  videoId: z.uuid(),
  t: z.number().int().min(0).max(86400),
  end: z.number().int().min(1).max(86400).nullish(),
  tag: z.enum(VIDEO_TAGS as [string, ...string[]]),
  label: z.string().trim().max(200).nullish(),
  playerIds: z.array(z.uuid()).max(30),
});

export async function saveMarker(input: z.input<typeof Marker>) {
  return run({ roles: [...STAFF], revalidate: [`/performanta/video/${input.videoId}`], message: t.marker.saved }, async ({ db, ctx }) => {
    const v = Marker.parse(input);
    if (v.end != null && v.end <= v.t) fail(t.marker.endBeforeStart);
    const row = { video_id: v.videoId, t_sec: v.t, end_sec: v.end ?? null, tag: v.tag, label: v.label || null };
    let id = v.id ?? null;
    if (id) {
      const { data, error } = await db.from("video_markers").update(row).eq("id", id).select("id, shared");
      if (error) throw error;
      if (!data?.length) fail(t.errors.notFound);
    } else {
      const { data, error } = await db.from("video_markers").insert({ ...row, created_by: ctx.userId }).select("id").single();
      if (error) throw error;
      id = data.id;
    }
    const { error: e1 } = await db.from("video_marker_players").delete().eq("marker_id", id);
    if (e1) throw e1;
    if (v.playerIds.length) {
      const { error: e2 } = await db.from("video_marker_players").insert(v.playerIds.map((p) => ({ marker_id: id!, player_id: p })));
      if (e2) throw e2;
    } else {
      // un clip fără jucători nu mai are cui să fie partajat
      await db.from("video_markers").update({ shared: false, shared_at: null }).eq("id", id).eq("shared", true);
    }
    return { id };
  });
}

export async function deleteMarker(input: { id: string; videoId: string }) {
  return run({ roles: [...STAFF], revalidate: [`/performanta/video/${input.videoId}`], message: t.marker.deleted }, async ({ db }) => {
    const id = z.uuid().parse(input.id);
    const { data, error } = await db.from("video_markers").delete().eq("id", id).select("id");
    if (error) throw error;
    if (!data?.length) fail(t.errors.notFound);
    return null;
  });
}

export async function shareMarker(input: { id: string; videoId: string; share: boolean }) {
  return run({ roles: [...STAFF], revalidate: [`/performanta/video/${input.videoId}`] }, async ({ db }) => {
    const id = z.uuid().parse(input.id);
    const { data, error } = await db.rpc("share_video_marker", { p_marker: id, p_share: !!input.share });
    if (error) throw error;
    return { notified: (data as number) ?? 0 };
  });
}

const Share = z.object({ id: z.uuid(), groupIds: z.array(z.uuid()).max(60) });

/** Echipele cu care e partajată înregistrarea (lista completă). Întoarce câți antrenori au fost anunțați. */
export async function shareVideo(input: z.infer<typeof Share>) {
  return run<number>({ roles: [...STAFF], revalidate: PATHS }, async ({ db }) => {
    const v = Share.parse(input);
    const { data, error } = await db.rpc("share_video_with_groups", { p_video: v.id, p_groups: v.groupIds });
    if (error) fail(error.message);
    return (data as number) ?? 0;
  });
}
