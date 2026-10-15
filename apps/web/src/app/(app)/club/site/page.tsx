import Link from "next/link";
import { Globe, Newspaper, Plus, Smartphone } from "lucide-react";
import { formatDate } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { EmptyState } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/status";
import { SiteHeader } from "@/components/club/site-tabs";
import { getT } from "@/messages";

export const metadata = { title: "Site" };

export default async function SiteNewsPage() {
  const { db, ctx } = await requireCapability("manageWebsite");
  const t = getT().club.website;
  const { data } = await db.from("site_posts").select("id, title, status, to_site, to_app, published_at, updated_at, cover_path, profiles(full_name)").order("updated_at", { ascending: false }).limit(200);
  return (
    <>
      <SiteHeader slug={ctx.club.slug} current="news" action={<LinkButton href="/club/site/stiri/nou" variant="primary" icon={<Plus className="size-5" aria-hidden />}>{t.news.new}</LinkButton>} />
      {!data?.length ? <EmptyState icon={<Newspaper className="size-8" aria-hidden />} title={t.news.empty} /> : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {data.map((p) => (
            <li key={p.id}>
              <Link href={`/club/site/stiri/${p.id}`} className="flex min-h-20 items-center gap-4 px-4 py-3 hover:bg-canvas">
                {p.cover_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/files/site/${p.cover_path}`} alt="" className="hidden h-14 w-24 shrink-0 rounded-md object-cover sm:block" />
                ) : <span className="hidden h-14 w-24 shrink-0 items-center justify-center rounded-md bg-sunken sm:flex"><Newspaper className="size-6 text-ink-3" aria-hidden /></span>}
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{p.title}</span>
                  <span className="flex flex-wrap items-center gap-x-3 text-sm text-ink-3">
                    <span>{formatDate((p.published_at ?? p.updated_at).slice(0, 10))}</span>
                    {(p.profiles as { full_name: string } | null)?.full_name ? <span>{t.news.by((p.profiles as { full_name: string }).full_name)}</span> : null}
                    {p.to_site ? <span className="inline-flex items-center gap-1"><Globe className="size-4" aria-hidden />{t.news.where.site}</span> : null}
                    {p.to_app ? <span className="inline-flex items-center gap-1"><Smartphone className="size-4" aria-hidden />{t.news.where.app}</span> : null}
                  </span>
                </span>
                <Badge tone={p.status === "published" ? "green" : "gray"}>{p.status === "published" ? t.news.published : t.news.draft}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
