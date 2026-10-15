"use server";
import { z } from "zod";
import { slugify } from "@club/shared";
import { fail, run } from "@/lib/actions";
import { deleteFiles } from "@/lib/storage";
import { getT } from "@/messages";

const t = getT().club.website;
const OFFICE = ["admin", "secretary"] as const;
const NEWS = ["/club/site", "/mesaje", "/azi"];

const Block = z.discriminatedUnion("type", [
  z.object({ type: z.literal("paragraph"), text: z.string().max(5000) }),
  z.object({ type: z.literal("heading"), text: z.string().max(160) }),
  z.object({ type: z.literal("quote"), text: z.string().max(1000), by: z.string().max(120).optional() }),
  z.object({ type: z.literal("list"), items: z.array(z.string().max(300)).max(50) }),
  z.object({ type: z.literal("image"), path: z.string().max(300), alt: z.string().max(200).optional(), caption: z.string().max(300).optional() }),
]);
const Post = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(3).max(160),
  excerpt: z.string().trim().max(300).optional(),
  blocks: z.array(Block).max(60),
  coverPath: z.string().max(300).nullable(),
  toSite: z.boolean(),
  toApp: z.boolean(),
  groupIds: z.array(z.uuid()).max(40),
});
export type PostInput = z.input<typeof Post>;

const paths = (p: { blocks: Array<{ type: string; path?: string }>; cover_path?: string | null }) =>
  [p.cover_path, ...p.blocks.filter((b) => b.type === "image").map((b) => b.path)].filter(Boolean) as string[];

export async function savePost(input: PostInput) {
  return run<{ id: string }>({ roles: [...OFFICE], revalidate: NEWS }, async ({ db }) => {
    const v = Post.safeParse(input);
    if (!v.success) fail(v.error.issues[0]?.message ?? "Date invalide.");
    const d = v.data;
    // imaginile scoase din știre se șterg din depozit
    const before = d.id ? (await db.from("site_posts").select("blocks, cover_path").eq("id", d.id).maybeSingle()).data : null;
    const { data, error } = await db.rpc("save_site_post", {
      p: { id: d.id ?? "", title: d.title, slug: slugify(d.title), excerpt: d.excerpt ?? "", blocks: d.blocks, cover_path: d.coverPath ?? "", to_site: d.toSite, to_app: d.toApp, app_group_ids: d.groupIds },
    });
    if (error) throw error;
    if (before) {
      const keep = new Set(paths({ blocks: d.blocks, cover_path: d.coverPath }));
      const gone = paths(before as { blocks: Array<{ type: string; path?: string }>; cover_path: string | null }).filter((p) => !keep.has(p));
      if (gone.length) await deleteFiles(db, "site", gone);
    }
    return { id: data as string };
  });
}

export async function publishPost(input: { id: string; publish: boolean }) {
  return run<number>({ roles: [...OFFICE], revalidate: NEWS }, async ({ db }) => {
    const v = z.object({ id: z.uuid(), publish: z.boolean() }).parse(input);
    const { data, error } = await db.rpc("publish_site_post", { p_id: v.id, p_publish: v.publish });
    if (error) throw error;
    return (data as number) ?? 0;
  });
}

export async function deletePost(id: string) {
  return run({ roles: [...OFFICE], revalidate: NEWS }, async ({ db }) => {
    const pid = z.uuid().parse(id);
    const { data: post } = await db.from("site_posts").select("blocks, cover_path").eq("id", pid).maybeSingle();
    if (post) await deleteFiles(db, "site", paths(post as { blocks: Array<{ type: string; path?: string }>; cover_path: string | null }));
    const { error } = await db.rpc("delete_site_post", { p_id: pid });
    if (error) throw error;
    return null;
  });
}

// ---------------------------------------------------------------------------
// Galerii
// ---------------------------------------------------------------------------
export async function saveAlbum(input: { id?: string; title: string; takenOn: string; status?: "draft" | "published" }) {
  return run<{ id: string }>({ roles: [...OFFICE], revalidate: ["/club/site/galerie"] }, async ({ db }) => {
    const v = z.object({ id: z.uuid().optional(), title: z.string().trim().min(2).max(120), takenOn: z.union([z.iso.date(), z.literal("")]), status: z.enum(["draft", "published"]).optional() }).parse(input);
    const { data, error } = await db.rpc("save_album", { p: { id: v.id ?? "", title: v.title, taken_on: v.takenOn, status: v.status ?? "" } });
    if (error) throw error;
    return { id: data as string };
  });
}

export async function addPhoto(input: { albumId: string; path: string }) {
  return run<{ id: string }>({ roles: [...OFFICE], revalidate: [`/club/site/galerie/${input.albumId}`] }, async ({ db }) => {
    const v = z.object({ albumId: z.uuid(), path: z.string().max(300) }).parse(input);
    const { data, error } = await db.rpc("save_photo", { p: { album_id: v.albumId, path: v.path, player_ids: [] } });
    if (error) throw error;
    return { id: data as string };
  });
}

export async function updatePhoto(input: { id: string; albumId: string; caption: string; playerIds: string[] }) {
  return run({ roles: [...OFFICE], revalidate: [`/club/site/galerie/${input.albumId}`] }, async ({ db }) => {
    const v = z.object({ id: z.uuid(), caption: z.string().max(300), playerIds: z.array(z.uuid()).max(60) }).parse(input);
    const { error } = await db.rpc("save_photo", { p: { id: v.id, caption: v.caption, player_ids: v.playerIds } });
    if (error) throw error;
    return null;
  });
}

export async function deletePhoto(input: { id: string; albumId: string }) {
  return run({ roles: [...OFFICE], revalidate: [`/club/site/galerie/${input.albumId}`] }, async ({ db }) => {
    const { data: path } = await db.from("site_photos").select("path").eq("id", z.uuid().parse(input.id)).maybeSingle();
    if (path?.path) await deleteFiles(db, "site", [path.path]);
    const { error } = await db.rpc("delete_photo", { p_id: input.id });
    if (error) throw error;
    return null;
  });
}

export async function deleteAlbum(id: string) {
  return run({ roles: [...OFFICE], revalidate: ["/club/site/galerie"] }, async ({ db }) => {
    const aid = z.uuid().parse(id);
    const { data: photos } = await db.from("site_photos").select("path").eq("album_id", aid);
    await deleteFiles(db, "site", (photos ?? []).map((p) => p.path));
    const { error } = await db.rpc("delete_album", { p_id: aid });
    if (error) throw error;
    return null;
  });
}

// ---------------------------------------------------------------------------
// Setări și politică
// ---------------------------------------------------------------------------
const Settings = z.object({
  news: z.boolean(), teams: z.boolean(), camps: z.boolean(), gallery: z.boolean(), enrolment: z.boolean(), support: z.boolean(), contact: z.boolean(),
  indexable: z.boolean(), show_staff: z.boolean(), roster_groups: z.array(z.uuid()).max(40),
  tagline: z.string().max(300), about: z.string().max(4000), address: z.string().max(300), email: z.string().max(300), phone: z.string().max(300),
  map_url: z.string().max(300), facebook: z.string().max(300), instagram: z.string().max(300), youtube: z.string().max(300), tiktok: z.string().max(300),
});
export type SiteSettingsInput = z.input<typeof Settings>;

export async function saveSettings(input: SiteSettingsInput) {
  return run<number>({ roles: [...OFFICE], revalidate: ["/club/site/setari"] }, async ({ db }) => {
    const v = Settings.parse(input);
    const { data, error } = await db.rpc("save_site_settings", { p: v });
    if (error) throw error;
    return (data as number) ?? 0;
  });
}

export async function publishPolicy(body: string) {
  return run<number>({ roles: [...OFFICE], revalidate: ["/club/site/confidentialitate"] }, async ({ db }) => {
    const text = z.string().max(60000).parse(body);
    const { data, error } = await db.rpc("publish_site_policy", { p_body: text });
    if (error) throw error;
    return data as number;
  });
}

/** Familia retrage acordul foto (fotografiile cu copilul dispar imediat de pe site). */
export async function withdrawPhotoConsent(playerId: string) {
  return run({ revalidate: ["/contracte"], message: t.family.withdrawn }, async ({ db }) => {
    const { error } = await db.rpc("withdraw_photo_consent", { p_player: z.uuid().parse(playerId) });
    if (error) throw error;
    return null;
  });
}
