import Link from "next/link";
import { ChevronRight, Newspaper } from "lucide-react";
import { addDays, formatDate, type Db } from "@club/shared";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getT } from "@/messages";

/** Ultimele știri publicate în aplicație (din ultimele `days` zile), pe „Azi" și în Mesaje. */
export async function FamilyNewsCard({ db, today, days = 10, limit = 2 }: { db: Db; today: string; days?: number; limit?: number }) {
  const t = getT().club.website.family;
  const { data } = await db.from("site_posts").select("id, title, published_at, cover_path").eq("status", "published").eq("to_app", true)
    .gte("published_at", addDays(today, -days)).order("published_at", { ascending: false }).limit(limit);
  if (!data?.length) return null;
  return (
    <Card>
      <CardHeader title={t.news} action={<Link href="/noutati" className="font-semibold underline underline-offset-4">{t.all}</Link>} />
      <CardBody>
        <ul className="divide-y divide-line">
          {data.map((p) => (
            <li key={p.id}>
              <Link href={`/noutati/${p.id}`} className="flex min-h-14 items-center gap-3 py-2 hover:bg-canvas">
                {p.cover_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/files/site/${p.cover_path}`} alt="" className="h-12 w-16 shrink-0 rounded-md object-cover" />
                ) : <Newspaper className="size-5 shrink-0 text-ink-3" aria-hidden />}
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{p.title}</span>
                  <span className="block text-sm text-ink-3">{formatDate(p.published_at!.slice(0, 10))}</span>
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
