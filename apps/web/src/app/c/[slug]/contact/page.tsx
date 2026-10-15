import { notFound } from "next/navigation";
import { Mail, MapPin, Phone } from "lucide-react";
import { getPublicClub } from "@/lib/public-site";
import { getT } from "@/messages";

export const metadata = { title: "Contact" };

export default async function PublicContact({ params }: { params: Promise<{ slug: string }> }) {
  const club = await getPublicClub((await params).slug);
  if (!club) notFound();
  const t = getT().club.website;
  const s = club.site as Record<string, string | undefined>;
  const social = (["facebook", "instagram", "youtube", "tiktok"] as const).filter((k) => s[k]?.startsWith("https://"));
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <section className="space-y-4">
        <h1 className="text-3xl md:text-4xl">{t.public.contact}</h1>
        {!s.address && !s.phone && !s.email && !social.length ? <p className="text-lg text-ink-3">{t.public.contactEmpty}</p> : null}
        <ul className="space-y-3 text-lg">
          {s.address ? <li className="flex gap-3"><MapPin className="mt-1 size-6 shrink-0 text-ink-3" aria-hidden /><span>{s.address}{s.map_url?.startsWith("https://") ? <> · <a className="font-semibold underline underline-offset-4" href={s.map_url} target="_blank" rel="noreferrer">{t.settings.mapUrl}</a></> : null}</span></li> : null}
          {s.phone ? <li className="flex gap-3"><Phone className="mt-1 size-6 shrink-0 text-ink-3" aria-hidden /><a className="font-semibold underline underline-offset-4" href={`tel:${s.phone.replace(/\s/g, "")}`}>{s.phone}</a></li> : null}
          {s.email ? <li className="flex gap-3"><Mail className="mt-1 size-6 shrink-0 text-ink-3" aria-hidden /><a className="font-semibold underline underline-offset-4" href={`mailto:${s.email}`}>{s.email}</a></li> : null}
        </ul>
        {social.length ? (
          <ul className="flex flex-wrap gap-2">
            {social.map((k) => <li key={k}><a href={s[k]} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center rounded-full border border-line-strong px-4 font-semibold capitalize hover:bg-surface">{k === "youtube" ? "YouTube" : k === "tiktok" ? "TikTok" : k[0].toUpperCase() + k.slice(1)}</a></li>)}
          </ul>
        ) : null}
      </section>
      {s.about ? (
        <section className="space-y-3">
          <h2 className="text-2xl">{t.public.about}</h2>
          <p className="whitespace-pre-line text-lg leading-relaxed text-ink-2">{s.about}</p>
        </section>
      ) : null}
    </div>
  );
}
