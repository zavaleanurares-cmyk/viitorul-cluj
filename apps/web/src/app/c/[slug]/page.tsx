import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getPublicClub, siteOn } from "@/lib/public-site";
import { buttonClass } from "@/components/ui/button";
import { getT } from "@/messages";

/** Prima pagină a site-ului public. */
export default async function PublicHome({ params }: { params: Promise<{ slug: string }> }) {
  const club = await getPublicClub((await params).slug);
  if (!club) notFound();
  const t = getT().site;
  const tagline = typeof club.site.tagline === "string" ? club.site.tagline : null;
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-4xl md:text-5xl">{club.name}</h1>
        {tagline ? <p className="max-w-prose text-xl text-ink-2">{tagline}</p> : null}
        {siteOn(club, "enrolment") ? (
          <Link href={`/c/${club.slug}/inscriere`} className={buttonClass("primary", "lg")}>{t.enrol.title}<ArrowRight className="size-5" aria-hidden /></Link>
        ) : null}
      </section>
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
    </div>
  );
}
