import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarRange, ChevronLeft, MapPin } from "lucide-react";
import { createAnonDb } from "@club/db";
import { formatDate, formatLei } from "@club/shared";
import { getPublicClub } from "@/lib/public-site";
import { Notice } from "@/components/ui/card";
import { PublicCampForm } from "@/components/site/camp-form";
import { getT } from "@/messages";
import type { PublicCamp } from "../page";

export default async function PublicCamp({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const club = await getPublicClub(slug);
  if (!club) notFound();
  const { data } = await createAnonDb().rpc("public_camps", { p_slug: club.slug });
  const c = ((data ?? []) as PublicCamp[]).find((x) => x.id === id);
  if (!c) notFound();
  const t = getT().club.camps;
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="space-y-4">
        <Link href={`/c/${club.slug}/tabere`} className="inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink"><ChevronLeft className="size-5" aria-hidden />{t.public.back}</Link>
        <h1 className="text-3xl md:text-4xl">{c.title}</h1>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-lg text-ink-2">
          <span className="inline-flex items-center gap-1"><CalendarRange className="size-5" aria-hidden />{t.dates(formatDate(c.starts_on), formatDate(c.ends_on))}</span>
          {c.location ? <span className="inline-flex items-center gap-1"><MapPin className="size-5" aria-hidden />{c.location}</span> : null}
        </p>
        <p className="text-ink-2"><span className="text-2xl font-bold text-ink">{c.price ? formatLei(c.price) : t.free}</span> · {t.years(c.birth_year_from, c.birth_year_to)}{c.deadline ? ` · ${t.deadline(formatDate(c.deadline))}` : ""}</p>
        {c.description ? <p className="whitespace-pre-line text-lg leading-relaxed">{c.description}</p> : null}
      </div>
      <div className="space-y-3">
        <h2 className="text-2xl">{t.public.form}</h2>
        {c.spots_left === 0 ? <Notice tone="yellow" title={t.public.full} /> : null}
        <PublicCampForm slug={club.slug} campId={c.id} />
      </div>
    </div>
  );
}
