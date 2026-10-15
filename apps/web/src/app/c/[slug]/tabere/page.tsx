import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarRange, MapPin } from "lucide-react";
import { createAnonDb } from "@club/db";
import { formatDate, formatLei } from "@club/shared";
import { getPublicClub } from "@/lib/public-site";
import { getT } from "@/messages";

export const metadata = { title: "Tabere" };

export type PublicCamp = {
  id: string; title: string; description: string | null; location: string | null; starts_on: string; ends_on: string; price: number;
  birth_year_from: number | null; birth_year_to: number | null; deadline: string | null; spots_left: number;
};

export default async function PublicCamps({ params }: { params: Promise<{ slug: string }> }) {
  const club = await getPublicClub((await params).slug);
  if (!club) notFound();
  const t = getT().club.camps;
  const { data } = await createAnonDb().rpc("public_camps", { p_slug: club.slug });
  const camps = (data ?? []) as PublicCamp[];
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl md:text-4xl">{t.public.title}</h1>
        <p className="max-w-prose text-lg text-ink-2">{t.public.lead}</p>
      </header>
      {!camps.length ? <p className="text-ink-3">{t.public.none}</p> : (
        <ul className="grid gap-4 md:grid-cols-2">
          {camps.map((c) => (
            <li key={c.id}>
              <Link href={`/c/${club.slug}/tabere/${c.id}`} className="flex h-full flex-col gap-3 rounded-[var(--radius-card)] border border-line/70 bg-surface p-5 hover:border-line-strong shadow-[var(--shadow-card)]">
                <span className="flex items-start justify-between gap-3">
                  <span className="text-xl font-bold">{c.title}</span>
                  <span className="shrink-0 text-lg font-bold">{c.price ? formatLei(c.price) : t.free}</span>
                </span>
                <span className="flex flex-wrap gap-x-4 gap-y-1 text-ink-2">
                  <span className="inline-flex items-center gap-1"><CalendarRange className="size-5" aria-hidden />{t.dates(formatDate(c.starts_on), formatDate(c.ends_on))}</span>
                  {c.location ? <span className="inline-flex items-center gap-1"><MapPin className="size-5" aria-hidden />{c.location}</span> : null}
                </span>
                <span className="text-sm text-ink-3">{t.years(c.birth_year_from, c.birth_year_to)} · {t.spotsLeft(c.spots_left)}</span>
                <span className="mt-auto inline-flex items-center gap-1 font-semibold text-brand">{t.public.register}<ArrowRight className="size-4" aria-hidden /></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
