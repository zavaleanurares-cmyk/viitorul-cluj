import { notFound } from "next/navigation";
import { createAnonDb } from "@club/db";
import { getPublicClub } from "@/lib/public-site";
import { getT } from "@/messages";

export const metadata = { title: "Echipe" };
type Team = { id: string; name: string; from: number | null; to: number | null; coaches: string[]; roster: Array<{ name: string; number: number | null; position: string | null }> };

export default async function PublicTeams({ params }: { params: Promise<{ slug: string }> }) {
  const club = await getPublicClub((await params).slug);
  if (!club) notFound();
  const t = getT().club.website.public;
  const pos = getT().club.enrolment.positions;
  const years = getT().site.enrol.years;
  const { data } = await createAnonDb().rpc("public_teams", { p_slug: club.slug });
  const teams = (data ?? []) as Team[];
  return (
    <div className="space-y-6">
      <h1 className="text-3xl md:text-4xl">{t.teams}</h1>
      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {teams.map((g) => (
          <li key={g.id} className="space-y-3 rounded-[var(--radius-card)] border border-line/70 bg-surface p-5 shadow-[var(--shadow-card)]">
            <div>
              <h2 className="text-2xl">{g.name}</h2>
              {g.from ? <p className="text-ink-3">{years(g.from, g.to)}</p> : null}
            </div>
            {g.coaches.length ? <p><span className="font-semibold">{t.coaches}:</span> {g.coaches.join(", ")}</p> : null}
            {g.roster.length ? (
              <div>
                <h3 className="mb-1 text-base">{t.roster}</h3>
                <ul className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
                  {g.roster.map((p, i) => (
                    <li key={i} className="flex items-baseline gap-2 border-b border-line py-1.5">
                      <span className="w-7 text-right font-bold tabular-nums text-ink-3">{p.number ?? ""}</span>
                      <span className="flex-1 font-semibold">{p.name}</span>
                      <span className="text-sm text-ink-3">{p.position ? pos[p.position as keyof typeof pos] : ""}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
