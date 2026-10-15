import Link from "next/link";
import { Images } from "lucide-react";
import { formatDate } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { EmptyState } from "@/components/ui/card";
import { Badge } from "@/components/ui/status";
import { SiteHeader } from "@/components/club/site-tabs";
import { NewAlbumButton } from "@/components/club/gallery-admin";
import { getT } from "@/messages";

export const metadata = { title: "Galerie" };

export default async function GalleryPage() {
  const { db, ctx } = await requireCapability("manageWebsite");
  const t = getT().club.website;
  const { data } = await db.from("site_albums").select("id, title, taken_on, status, site_photos(path, sort)").order("taken_on", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
  return (
    <>
      <SiteHeader slug={ctx.club.slug} current="gallery" action={<NewAlbumButton />} />
      {!data?.length ? <EmptyState icon={<Images className="size-8" aria-hidden />} title={t.gallery.empty} /> : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {data.map((a) => {
            const photos = [...((a.site_photos ?? []) as Array<{ path: string; sort: number }>)].sort((x, y) => x.sort - y.sort);
            return (
              <li key={a.id}>
                <Link href={`/club/site/galerie/${a.id}`} className="block overflow-hidden rounded-[var(--radius-card)] border border-line/70 bg-surface hover:border-line-strong shadow-[var(--shadow-card)]">
                  {photos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/files/site/${photos[0].path}`} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
                  ) : <span className="flex aspect-[4/3] items-center justify-center bg-sunken"><Images className="size-8 text-ink-3" aria-hidden /></span>}
                  <span className="block space-y-1 p-3">
                    <span className="block font-semibold">{a.title}</span>
                    <span className="flex flex-wrap items-center gap-2 text-sm text-ink-3">{a.taken_on ? formatDate(a.taken_on) : null} · {t.gallery.photos(photos.length)}
                      <Badge tone={a.status === "published" ? "green" : "gray"}>{a.status === "published" ? t.news.published : t.news.draft}</Badge></span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
