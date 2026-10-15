import { notFound } from "next/navigation";
import { createAnonDb } from "@club/db";
import { formatDate } from "@club/shared";
import { getPublicClub } from "@/lib/public-site";
import { Notice } from "@/components/ui/card";
import { Form230 } from "@/components/site/form230";
import { SponsorStrip, type PublicSponsor } from "@/components/site/sponsors";
import { getT } from "@/messages";

export const metadata = { title: "Susține clubul" };
type Support = { beneficiary: string; fiscal_code: string | null; iban: string | null; campaign: { income_year: number; title: string; deadline: string | null } | null; sponsors: PublicSponsor[] };

export default async function PublicSupport({ params }: { params: Promise<{ slug: string }> }) {
  const club = await getPublicClub((await params).slug);
  if (!club) notFound();
  const t = getT().club.supporters.public;
  const { data } = await createAnonDb().rpc("public_support", { p_slug: club.slug });
  const s = data as Support;
  const open = !!s?.campaign && !!s.fiscal_code && !!s.iban;
  return (
    <div className="space-y-10">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-start">
        <section className="space-y-4">
          <h1 className="text-3xl md:text-4xl">{t.title}</h1>
          <p className="text-lg text-ink-2">{t.lead}</p>
          <h2 className="text-xl">{t.how}</h2>
          <ol className="list-decimal space-y-1 pl-6 text-lg">{t.steps.map((x) => <li key={x}>{x}</li>)}</ol>
          <p className="text-ink-2">{t.who}</p>
          {s?.campaign?.deadline ? <p className="font-semibold">{t.deadline(formatDate(s.campaign.deadline))}</p> : null}
          {s?.fiscal_code ? <p className="text-sm text-ink-3">{s.beneficiary} · CIF {s.fiscal_code} · {s.iban}</p> : null}
        </section>
        {open ? <Form230 slug={club.slug} /> : <Notice tone="gray" title={t.closed} />}
      </div>
      <SponsorStrip sponsors={s?.sponsors ?? []} media={`/c/${club.slug}/media`} title={t.sponsors} />
      <p className="max-w-prose text-ink-2">{t.sponsorCta}</p>
    </div>
  );
}
