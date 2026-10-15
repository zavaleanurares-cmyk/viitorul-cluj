import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LogIn } from "lucide-react";
import { clubThemeStyle } from "@/lib/theme";
import { getPublicClub, hasPolicy, siteOn } from "@/lib/public-site";
import { PublicNav } from "@/components/site/public-nav";
import { getT } from "@/messages";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const club = await getPublicClub((await params).slug);
  if (!club) return { title: "Club" };
  const intro = typeof club.site.tagline === "string" ? club.site.tagline : undefined;
  return {
    title: { default: club.name, template: `%s · ${club.name}` },
    description: intro,
    robots: { index: siteOn(club, "indexable"), follow: true },
    icons: club.has_logo ? { icon: `/c/${club.slug}/sigla` } : undefined,
  };
}

/** Site-ul public al clubului: antet cu sigla și culorile clubului, meniul secțiunilor pornite, subsol. */
export default async function PublicLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const club = await getPublicClub(slug);
  if (!club) notFound();
  const t = getT().site;
  const base = `/c/${club.slug}`;
  const items = [
    { href: base, label: t.nav.home, on: true },
    { href: `${base}/stiri`, label: t.nav.news, on: siteOn(club, "news") },
    { href: `${base}/echipe`, label: t.nav.teams, on: siteOn(club, "teams") },
    { href: `${base}/tabere`, label: t.nav.camps, on: siteOn(club, "camps") },
    { href: `${base}/galerie`, label: t.nav.gallery, on: siteOn(club, "gallery") },
    { href: `${base}/inscriere`, label: t.nav.enrol, on: siteOn(club, "enrolment") },
    { href: `${base}/sustine`, label: t.nav.support, on: siteOn(club, "support") },
    { href: `${base}/contact`, label: t.nav.contact, on: siteOn(club, "contact") },
  ].filter((i) => i.on && PUBLIC_PAGES.has(i.href.slice(base.length) || "/"));
  return (
    <div style={clubThemeStyle(club)} className="flex min-h-dvh flex-col bg-canvas">
      <header className="bg-brand text-brand-ink">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
          <Link href={base} className="flex min-w-0 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {club.has_logo ? <img src={`${base}/sigla`} alt="" className="size-12 shrink-0 rounded-lg bg-white object-contain p-1" /> : null}
            <span className="truncate text-xl font-bold md:text-2xl">{club.name}</span>
          </Link>
          <span className="flex-1" />
          <Link href="/autentificare" className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[var(--radius-control)] border border-current/30 px-3 font-semibold hover:bg-white/10">
            <LogIn className="size-5" aria-hidden /><span className="hidden sm:inline">{t.enter}</span>
          </Link>
        </div>
        <PublicNav items={items.map(({ href, label }) => ({ href, label }))} base={base} />
      </header>
      <main id="continut" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:py-10">{children}</main>
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-sm text-ink-3">
          <span className="font-semibold text-ink-2">{club.name}</span>
          {await hasPolicy(club.slug) ? <Link href={`${base}/confidentialitate`} className="underline underline-offset-4 hover:text-ink">{t.privacy}</Link> : null}
          <span className="flex-1" />
          <span>{t.poweredBy}</span>
        </div>
      </footer>
    </div>
  );
}

/** Paginile publice care există deja (se completează pe măsură ce modulele Club sunt gata). */
const PUBLIC_PAGES = new Set(["/", "/stiri", "/echipe", "/tabere", "/galerie", "/inscriere", "/sustine", "/contact"]);
