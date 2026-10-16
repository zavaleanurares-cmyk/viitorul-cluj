import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { formatDate, type MatchVideoSource, type VideoTag } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { Notice, PageHeader } from "@/components/ui/card";
import { VideoWorkspace, type MarkerRow } from "@/components/performance/video-workspace";
import { DeleteVideoButton } from "@/components/performance/delete-video";
import { ShareVideoButton } from "@/components/performance/share-video";
import { getT } from "@/messages";

export const metadata = { title: "Video" };

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, ctx } = await requireCapability("viewAnalysis");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: v } = await db.from("videos").select("id, title, source, url, storage_path, recorded_on, group_id, event_id, shared_group_ids, events(title)").eq("id", id).maybeSingle();
  if (!v) notFound();
  const t = getT().performance.video;
  const [{ data: ms }, { data: players }] = await Promise.all([
    db.from("video_markers").select("id, t_sec, end_sec, tag, label, shared, video_marker_players(player_id)").eq("video_id", id).order("t_sec"),
    v.group_id ? db.from("players").select("id, display_name").eq("group_id", v.group_id).eq("is_active", true).is("anonymized_at", null).order("display_name") : Promise.resolve({ data: [] }),
  ]);
  const markers: MarkerRow[] = (ms ?? []).map((m) => ({
    id: m.id, t_sec: m.t_sec, end_sec: m.end_sec, tag: m.tag as VideoTag, label: m.label, shared: m.shared,
    players: (m.video_marker_players ?? []).map((p) => p.player_id),
  }));
  const team = ctx.groups.find((g) => g.id === v.group_id)?.name;
  // înregistrarea e „a mea” (o pot modifica) sau doar mi-a fost partajată
  const owns = ctx.role === "sporting_director" || ctx.role === "physio" || (ctx.role === "coach" && (!v.group_id || ctx.staffGroupIds.includes(v.group_id)));
  const ts = t.share;
  const sharedNames = ctx.groups.filter((g) => (v.shared_group_ids ?? []).includes(g.id)).map((g) => g.name);
  const fileUrl = v.storage_path ? `/api/files/videos/${v.storage_path.split("/").map(encodeURIComponent).join("/")}` : null;
  return (
    <>
      <PageHeader
        back={<Link href="/performanta/video" className="inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink"><ChevronLeft className="size-5" aria-hidden />{t.title}</Link>}
        title={v.title}
        description={[formatDate(v.recorded_on), team, (v.events as { title: string } | null)?.title, t.sources[v.source as keyof typeof t.sources],
          owns && sharedNames.length ? ts.sharedWith(sharedNames.join(", ")) : null].filter(Boolean).join(" · ")}
        action={owns ? (
          <div className="flex flex-wrap gap-2">
            <ShareVideoButton id={v.id} initial={v.shared_group_ids ?? []}
              teams={ctx.groups.filter((g) => g.is_active && g.id !== v.group_id).map((g) => ({ id: g.id, name: g.name }))} />
            <DeleteVideoButton id={v.id} />
          </div>
        ) : null} />
      {!owns ? <Notice tone="blue" className="mb-4" title={team ? ts.sharedFrom(team) : undefined}>{ts.viewOnly}</Notice> : null}
      <VideoWorkspace canEdit={owns}
        video={{ id: v.id, source: v.source as MatchVideoSource, url: v.url, fileUrl, title: v.title }}
        markers={markers} players={(players ?? []).map((p) => ({ id: p.id, name: p.display_name }))} />
    </>
  );
}
