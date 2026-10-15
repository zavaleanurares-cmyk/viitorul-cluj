import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createAnonDb } from "@club/db";
import { formatDate, type SiteBlock } from "@club/shared";
import { getPublicClub } from "@/lib/public-site";
import { BlocksView } from "@/components/site/blocks";
import { getT } from "@/messages";

type Post = { id: string; title: string; slug: string; excerpt: string | null; cover_path: string | null; blocks: SiteBlock[]; published_at: string };
async function load(slug: string, post: string): Promise<Post | null> {
  if (!/^[a-z0-9-]{1,80}$/.test(post)) return null;
  const { data } = await createAnonDb().rpc("public_post", { p_slug: slug, p_post: post });
  return ((data ?? []) as Post[])[0] ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; post: string }> }): Promise<Metadata> {
  const { slug, post } = await params;
  const p = await load(slug, post);
  return p ? { title: p.title, description: p.excerpt ?? undefined, openGraph: p.cover_path ? { images: [`/c/${slug}/media/${p.cover_path}`] } : undefined } : {};
}

export default async function PublicPost({ params }: { params: Promise<{ slug: string; post: string }> }) {
  const { slug, post } = await params;
  const club = await getPublicClub(slug);
  if (!club) notFound();
  const p = await load(club.slug, post);
  if (!p) notFound();
  const t = getT().club.website.public;
  const media = `/c/${club.slug}/media`;
  return (
    <article className="mx-auto max-w-3xl space-y-5">
      <Link href={`/c/${club.slug}/stiri`} className="inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink"><ChevronLeft className="size-5" aria-hidden />{t.news}</Link>
      <p className="text-ink-3">{formatDate(p.published_at.slice(0, 10))}</p>
      <h1 className="text-3xl md:text-5xl">{p.title}</h1>
      {p.cover_path ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`${media}/${p.cover_path}`} alt="" className="aspect-[16/9] w-full rounded-[var(--radius-card)] object-cover" />
      ) : null}
      <BlocksView blocks={p.blocks} mediaBase={media} />
    </article>
  );
}
