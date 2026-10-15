import Link from "next/link";
import { notFound } from "next/navigation";
import { formatClock, formatDate } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { EmptyState } from "@/components/ui/card";
import { getT } from "@/messages";

/** Marcajele în care apare jucătorul, din toate înregistrările pe care staff-ul le vede. */
export default async function PlayerVideo({ params }: { params: Promise<{ id: string }> }) {
  const { db } = await requireCapability("viewAnalysis");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const t = getT().performance.video;
  const { data } = await db.from("video_marker_players")
    .select("video_markers!inner(id, t_sec, end_sec, tag, label, shared, video_id, videos!inner(title, recorded_on))").eq("player_id", id).limit(300);
  type M = { id: string; t_sec: number; end_sec: number | null; tag: string; label: string | null; shared: boolean; video_id: string; videos: { title: string; recorded_on: string } };
  const rows = (data ?? []).map((r) => r.video_markers as unknown as M).sort((a, b) => b.videos.recorded_on.localeCompare(a.videos.recorded_on) || a.t_sec - b.t_sec);
  if (!rows.length) return <EmptyState title={t.playerTabEmpty} />;
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line/70 bg-surface shadow-[var(--shadow-card)]">
      {rows.map((m) => (
        <li key={m.id}>
          <Link href={`/performanta/video/${m.video_id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-canvas">
            <span className="inline-flex h-9 shrink-0 items-center rounded-md bg-sunken px-2 font-semibold tabular-nums">{formatClock(m.t_sec)}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{t.tags[m.tag as keyof typeof t.tags]}{m.label ? <span className="font-normal"> · {m.label}</span> : null}</span>
              <span className="block text-sm text-ink-3">{m.videos.title} · {formatDate(m.videos.recorded_on)}{m.shared ? ` · ${t.marker.shared}` : ""}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
