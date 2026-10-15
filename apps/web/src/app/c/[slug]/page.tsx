import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createAnonDb } from "@club/db";
import { getPublicClub, siteOn } from "@/lib/public-site";
import { buttonClass } from "@/components/ui/button";
import { PostCard, type PostSummary } from "@/components/site/post-card";
import { getT } from "@/messages";

/** Prima pagină a site-ului public: motto, ultimele știri, echipele, despre club. */
export default async function PublicHome({ params }: { params: Promise<{ slug: string }> }) {
  const club = await getPublicClub((await params).slug);
  if (!club) notFound();
  const t = getT().site;
  const w = getT().club.website.public;
  const base = `/c/${club.slug}`;
  const tagline = typeof club.site.tagline === "string" ? club.site.tagline : null;
  const about = typeof club.site.about === "string" ? club.site.about : null;
  const posts = siteOn(club, "news") ? (((await createAnonDb().rpc("public_posts", { p_slug: club.slug, p_limit: 3 })).data ?? []) as PostSummary[]) : [];
  return (
    <div className="space-y-12">
      <section className="space-y-4">
        <h1 className="text-4xl md:text-5xl">{club.name}</h1>
        {tagline ? <p className="max-w-prose text-xl text-ink-2">{tagline}</p> : null}
        <div className="flex flex-wrap gap-2">
          {siteOn(club, "enrolment") ? <Link href={`${base}/inscriere`} className={buttonClass("primary", "lg")}>{t.enrol.title}<ArrowRight className="size-5" aria-hidden /></Link> : null}
          {siteOn(club, "support") ? <Link href={`${base}/sustine`} className={buttonClass("secondary", "lg")}>{t.nav.support}</Link> : null}
        </div>
      </section>
      {posts.length ? (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-2xl">{w.latest}</h2>
            <Link href={`${base}/stiri`} className="font-semibold underline underline-offset-4">{w.news}</Link>
          </div>
          <ul className="grid gap-4 md:grid-cols-3">
            {posts.map((p, i) => <li key={p.id} className={i === 0 ? "md:col-span-3 lg:col-span-1" : ""}><PostCard post={p} href={`${base}/stiri/${p.slug}`} media={`${base}/media`} /></li>)}
          </ul>
        </section>
      ) : null}
      {club.groups.length ? (
        <section>
          <h2 className="mb-3 text-2xl">{t.enrol.groupsTitle}</h2>
          <ul className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {club.groups.map((g) => (
              <li key={g.id} className="rounded-[var(--radius-card)] border border-line bg-surface px-4 py-3">
                <span className="block text-lg font-bold">{g.name}</span>
                {g.from ? <span className="text-sm text-ink-3">{t.enrol.years(g.from, g.to)}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {about ? (
        <section className="max-w-prose space-y-2">
          <h2 className="text-2xl">{w.about}</h2>
          <p className="whitespace-pre-line text-lg leading-relaxed text-ink-2">{about}</p>
        </section>
      ) : null}
    </div>
  );
}
