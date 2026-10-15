import { notFound } from "next/navigation";
import { getPublicClub, siteOn } from "@/lib/public-site";
import { PublicEnrolmentForm } from "@/components/site/enrolment-form";
import { Notice } from "@/components/ui/card";
import { getT } from "@/messages";

export const metadata = { title: "Înscriere" };

export default async function PublicEnrolmentPage({ params }: { params: Promise<{ slug: string }> }) {
  const club = await getPublicClub((await params).slug);
  if (!club) notFound();
  const t = getT().site.enrol;
  const open = siteOn(club, "enrolment");
  const teams = club.groups.filter((g) => g.from);
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-4">
        <h1 className="text-3xl md:text-4xl">{t.title}</h1>
        <p className="max-w-prose text-lg text-ink-2">{t.lead}</p>
        {open ? <PublicEnrolmentForm slug={club.slug} groups={club.groups.map((g) => ({ id: g.id, name: g.name }))} privacyHref={null} />
          : <Notice tone="yellow" title={t.closed} />}
      </div>
      {teams.length ? (
        <aside className="lg:pt-24">
          <h2 className="mb-2 text-lg">{t.groupsTitle}</h2>
          <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line bg-surface">
            {teams.map((g) => (
              <li key={g.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                <span className="font-semibold">{g.name}</span>
                <span className="text-sm text-ink-3">{t.years(g.from!, g.to)}</span>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
    </div>
  );
}
