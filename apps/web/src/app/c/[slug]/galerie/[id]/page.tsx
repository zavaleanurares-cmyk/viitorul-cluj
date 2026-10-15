import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createAnonDb } from "@club/db";
import { formatDate } from "@club/shared";
import { getPublicClub } from "@/lib/public-site";
import { getT } from "@/messages";

export default async function PublicAlbum({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const club = await getPublicClub(slug);
  if (!club || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const t = getT().club.website.public;
  const { data } = await createAnonDb().rpc("public_album", { p_slug: club.slug, p_album: id });
  const photos = (data ?? []) as Array<{ title: string; taken_on: string | null; path: string; caption: string | null }>;
  if (!photos.length) notFound();
  return (
    <div className="space-y-5">
      <Link href={`/c/${club.slug}/galerie`} className="inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink"><ChevronLeft className="size-5" aria-hidden />{t.gallery}</Link>
      <h1 className="text-3xl md:text-4xl">{photos[0].title}</h1>
      {photos[0].taken_on ? <p className="text-ink-3">{formatDate(photos[0].taken_on)}</p> : null}
      <ul className="columns-1 gap-4 sm:columns-2 lg:columns-3">
        {photos.map((p) => (
          <li key={p.path} className="mb-4 break-inside-avoid">
            <figure className="space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/c/${club.slug}/media/${p.path}`} alt={p.caption ?? ""} loading="lazy" className="w-full rounded-[var(--radius-control)]" />
              {p.caption ? <figcaption className="text-sm text-ink-3">{p.caption}</figcaption> : null}
            </figure>
          </li>
        ))}
      </ul>
    </div>
  );
}
