import Link from "next/link";
import { notFound } from "next/navigation";
import { createAnonDb } from "@club/db";
import { formatDate } from "@club/shared";
import { getPublicClub } from "@/lib/public-site";
import { getT } from "@/messages";

export const metadata = { title: "Galerie" };

export default async function PublicGallery({ params }: { params: Promise<{ slug: string }> }) {
  const club = await getPublicClub((await params).slug);
  if (!club) notFound();
  const t = getT().club.website;
  const { data } = await createAnonDb().rpc("public_albums", { p_slug: club.slug });
  const albums = (data ?? []) as Array<{ id: string; title: string; taken_on: string | null; cover_path: string | null; photos: number }>;
  return (
    <div className="space-y-6">
      <h1 className="text-3xl md:text-4xl">{t.public.gallery}</h1>
      {!albums.length ? <p className="text-ink-3">{t.public.noAlbums}</p> : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {albums.map((a) => (
            <li key={a.id}>
              <Link href={`/c/${club.slug}/galerie/${a.id}`} className="group block overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {a.cover_path ? <img src={`/c/${club.slug}/media/${a.cover_path}`} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" /> : null}
                <span className="block p-3">
                  <span className="block font-bold group-hover:underline">{a.title}</span>
                  <span className="text-sm text-ink-3">{a.taken_on ? `${formatDate(a.taken_on)} · ` : ""}{t.gallery.photos(a.photos)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
