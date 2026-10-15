import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { can } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/status";
import { CompetitionDialogButton } from "@/components/schedule/competition-dialog";
import { listCompetitions } from "@/components/schedule/queries";
import { getT } from "@/messages";

export const metadata = { title: "Competiții" };

export default async function CompetitionsPage() {
  const { db, ctx } = await requireCapability("viewSchedule");
  const t = getT().schedule.competitions;
  const canManage = can(ctx.role, "manageSchedule");
  const [competitions, matches] = await Promise.all([
    listCompetitions(db),
    db.from("matches").select("competition_id, status"),
  ]);
  const counts = new Map<string, { played: number; upcoming: number }>();
  for (const m of matches.data ?? []) {
    if (!m.competition_id) continue;
    const c = counts.get(m.competition_id) ?? { played: 0, upcoming: 0 };
    if (m.status === "finished") c.played++; else c.upcoming++;
    counts.set(m.competition_id, c);
  }
  const visible = ctx.role === "coach" ? competitions.filter((c) => c.group_id && ctx.staffGroupIds.includes(c.group_id)) : competitions;

  return (
    <>
      <PageHeader title={t.title} action={canManage ? <CompetitionDialogButton teams={ctx.groups.filter((g) => g.is_active).map((g) => ({ id: g.id, name: g.name }))} clubName={ctx.club.name} /> : null} />
      {visible.length === 0 ? <EmptyState title={t.emptyTitle} description={t.emptyText} /> : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {visible.map((c) => {
            const n = counts.get(c.id) ?? { played: 0, upcoming: 0 };
            return (
              <li key={c.id}>
                <Link href={`/program/competitii/${c.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-canvas">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{c.name}</span>
                    <span className="block text-sm text-ink-3">{[c.groups?.name, t.played(n.played), t.upcoming(n.upcoming)].filter(Boolean).join(" · ")}</span>
                  </span>
                  <Badge tone="outline">{t.sources[c.source] ?? c.source}</Badge>
                  <ChevronRight className="size-5 text-ink-3" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
