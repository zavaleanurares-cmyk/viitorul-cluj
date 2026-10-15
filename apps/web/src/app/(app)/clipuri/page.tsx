import { Clapperboard } from "lucide-react";
import { formatClock, formatDate, type MatchVideoSource } from "@club/shared";
import { requireRole } from "@/lib/auth";
import { Card, CardBody, EmptyState, PageHeader } from "@/components/ui/card";
import { ClipPlayer } from "@/components/performance/clip-player";
import { getT } from "@/messages";

export const metadata = { title: "Clipuri" };

type Clip = { marker_id: string; player_id: string; player_name: string; video_title: string; recorded_on: string; source: string; url: string | null; storage_path: string | null; t_sec: number; end_sec: number | null; tag: string; label: string | null };

/** Clipurile trimise de antrenori în care apare copilul (sau jucătorul însuși). Restul înregistrării nu se vede. */
export default async function ClipsPage() {
  const { db, ctx } = await requireRole("guardian", "player");
  const t = getT().performance.video;
  const { data } = await db.rpc("my_clips");
  const clips = (data ?? []) as Clip[];
  // un clip cu doi frați apare o singură dată
  const seen = new Map<string, Clip & { names: string[] }>();
  for (const c of clips) {
    const cur = seen.get(c.marker_id);
    if (cur) cur.names.push(c.player_name); else seen.set(c.marker_id, { ...c, names: [c.player_name] });
  }
  const list = [...seen.values()];
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t.family.title} description={t.family.description} />
      {!list.length ? <EmptyState icon={<Clapperboard className="size-8" aria-hidden />} title={t.family.empty} description={ctx.role === "player" ? t.family.emptySelf : t.family.emptyText} /> : (
        <ul className="space-y-4">
          {list.map((c) => (
            <li key={c.marker_id}>
              <Card>
                <CardBody className="space-y-2">
                  <ClipPlayer source={c.source as MatchVideoSource} url={c.url} storagePath={c.storage_path} start={c.t_sec} end={c.end_sec} title={c.label ?? c.video_title} />
                  <p className="font-semibold">{t.tags[c.tag as keyof typeof t.tags]}{c.label ? ` · ${c.label}` : ""}</p>
                  <p className="text-sm text-ink-3">{c.names.join(", ")} · {c.video_title} · {formatDate(c.recorded_on)} · {formatClock(c.t_sec)}</p>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
