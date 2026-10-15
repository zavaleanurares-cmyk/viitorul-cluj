import Link from "next/link";
import { ChevronRight, Clapperboard } from "lucide-react";
import { formatDate, type Db } from "@club/shared";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getT } from "@/messages";

/** Pe „Azi" pentru familie: ultimele clipuri trimise (doar dacă există). */
export async function FamilyClipsCard({ db }: { db: Db }) {
  const t = getT().performance.video;
  const { data } = await db.rpc("my_clips");
  const clips = ((data ?? []) as Array<{ marker_id: string; player_name: string; video_title: string; recorded_on: string; tag: string; label: string | null }>)
    .filter((c, i, a) => a.findIndex((x) => x.marker_id === c.marker_id) === i).slice(0, 3);
  if (!clips.length) return null;
  return (
    <Card>
      <CardHeader title={t.family.card} action={<Link href="/clipuri" className="font-semibold underline underline-offset-4">{t.family.all}</Link>} />
      <CardBody>
        <ul className="divide-y divide-line">
          {clips.map((c) => (
            <li key={c.marker_id}>
              <Link href="/clipuri" className="flex min-h-12 items-center gap-3 py-2 hover:bg-canvas">
                <Clapperboard className="size-5 shrink-0 text-ink-3" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t.tags[c.tag as keyof typeof t.tags]}{c.label ? ` · ${c.label}` : ""}</span>
                  <span className="block text-sm text-ink-3">{c.player_name} · {c.video_title} · {formatDate(c.recorded_on)}</span>
                </span>
                <ChevronRight className="size-5 text-ink-3" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
