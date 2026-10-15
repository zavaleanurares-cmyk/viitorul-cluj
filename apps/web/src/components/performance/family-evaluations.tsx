import Link from "next/link";
import { ChevronRight, Star } from "lucide-react";
import { formatDate, type Db } from "@club/shared";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getT } from "@/messages";

/** Pentru părinte și jucător: evaluările publicate (RLS întoarce doar ce au voie să vadă). */
export async function FamilyEvaluationsCard({ db }: { db: Db }) {
  const t = getT().performance.evaluations;
  const { data } = await db.from("evaluations")
    .select("id, players(full_name), evaluation_rounds(name, published_at)").eq("status", "submitted").order("submitted_at", { ascending: false }).limit(6);
  if (!data?.length) return null;
  return (
    <Card>
      <CardHeader title={t.familyCard} />
      <CardBody>
        <ul className="divide-y divide-line">
          {data.map((e) => {
            const r = e.evaluation_rounds as { name: string; published_at: string | null } | null;
            const p = e.players as { full_name: string } | null;
            return (
              <li key={e.id}>
                <Link href={`/evaluari/${e.id}`} className="flex min-h-12 items-center gap-3 py-2 hover:bg-canvas">
                  <Star className="size-5 shrink-0 text-ink-3" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{p?.full_name}</span>
                    <span className="block text-sm text-ink-3">{r?.name}{r?.published_at ? ` · ${formatDate(r.published_at.slice(0, 10))}` : ""}</span>
                  </span>
                  <ChevronRight className="size-5 text-ink-3" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}
