import Link from "next/link";
import { notFound } from "next/navigation";
import { createAnonDb } from "@club/db";
import { getPublicClub } from "@/lib/public-site";
import { PostCard, type PostSummary } from "@/components/site/post-card";
import { getT } from "@/messages";

export const metadata = { title: "Noutăți" };
const PAGE = 12;

export default async function PublicNews({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ pagina?: string }> }) {
  const club = await getPublicClub((await params).slug);
  if (!club) notFound();
  const t = getT().club.website.public;
  const page = Math.max(1, Math.min(100, Number((await searchParams).pagina) || 1));
  const { data } = await createAnonDb().rpc("public_posts", { p_slug: club.slug, p_limit: PAGE + 1, p_offset: (page - 1) * PAGE });
  const posts = (data ?? []) as PostSummary[];
  const base = `/c/${club.slug}`;
  return (
    <div className="space-y-6">
      <h1 className="text-3xl md:text-4xl">{t.news}</h1>
      {!posts.length ? <p className="text-ink-3">{t.noNews}</p> : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.slice(0, PAGE).map((p) => <li key={p.id}><PostCard post={p} href={`${base}/stiri/${p.slug}`} media={`${base}/media`} /></li>)}
        </ul>
      )}
      <nav className="flex justify-between" aria-label="Pagini">
        {page > 1 ? <Link className="font-semibold underline underline-offset-4" href={`${base}/stiri?pagina=${page - 1}`}>← {page - 1}</Link> : <span />}
        {posts.length > PAGE ? <Link className="font-semibold underline underline-offset-4" href={`${base}/stiri?pagina=${page + 1}`}>{page + 1} →</Link> : null}
      </nav>
    </div>
  );
}
