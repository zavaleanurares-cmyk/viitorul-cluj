import Link from "next/link";
import { ChevronRight, Star } from "lucide-react";
import { can, formatDate, type Db } from "@club/shared";
import { requireCapability, visibleGroups } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { StartRoundButton, TemplatesManager } from "@/components/performance/evaluation-admin";
import { loadTemplates } from "@/components/performance/evaluation-queries";
import { cn } from "@/lib/cn";
import { getT } from "@/messages";

export const metadata = { title: "Evaluări" };

const SEASON_NAMES = ["Iarna", "Iarna", "Primăvara", "Primăvara", "Primăvara", "Vara", "Vara", "Vara", "Toamna", "Toamna", "Toamna", "Iarna"];

async function roundProgress(db: Db, roundIds: string[]) {
  if (!roundIds.length) return new Map<string, { submitted: number; drafts: number }>();
  const { data } = await db.from("evaluations").select("round_id, status").in("round_id", roundIds);
  const m = new Map<string, { submitted: number; drafts: number }>();
  for (const e of data ?? []) {
    const p = m.get(e.round_id) ?? { submitted: 0, drafts: 0 };
    if (e.status === "submitted") p.submitted++; else p.drafts++;
    m.set(e.round_id, p);
  }
  return m;
}

/** Rundele de evaluare: întâi cele deschise (cu ce mai e de notat), apoi cele publicate. */
export default async function EvaluationsPage() {
  const { db, ctx } = await requireCapability("viewAnalysis");
  const t = getT().performance.evaluations;
  const manager = ctx.role === "sporting_director" || ctx.role === "physio";
  const teams = visibleGroups(ctx);
  const [templates, { data: rounds }] = await Promise.all([
    manager ? loadTemplates(db) : Promise.resolve([]),
    db.from("evaluation_rounds").select("id, name, status, due_on, created_at, published_at, evaluation_round_groups(group_id)").order("created_at", { ascending: false }).limit(100),
  ]);
  const myTeams = new Set(teams.map((g) => g.id));
  const list = (rounds ?? []).filter((r) => manager || (r.evaluation_round_groups ?? []).some((g) => myTeams.has(g.group_id)));
  const allGroupIds = [...new Set(list.flatMap((r) => (r.evaluation_round_groups ?? []).map((g) => g.group_id)))].filter((g) => manager || myTeams.has(g));
  const { data: players } = allGroupIds.length
    ? await db.from("players").select("id, group_id").in("group_id", allGroupIds).eq("is_active", true).is("anonymized_at", null)
    : { data: [] };
  const progress = await roundProgress(db, list.map((r) => r.id));
  const month = Number(ctx.today.slice(5, 7));
  const defaultName = `${SEASON_NAMES[month - 1]} ${ctx.today.slice(0, 4)}`;
  const teamName = (id: string) => ctx.groups.find((g) => g.id === id)?.name ?? "—";

  return (
    <>
      <PageHeader title={t.title} description={t.description}
        action={manager ? (
          <div className="flex flex-wrap gap-2">
            <TemplatesManager templates={templates} />
            <StartRoundButton templates={templates.map((x) => ({ id: x.id, name: x.name }))} teams={teams.map((g) => ({ id: g.id, name: g.name }))} defaultName={defaultName} />
          </div>
        ) : undefined} />
      {!list.length ? (
        <EmptyState icon={<Star className="size-8" aria-hidden />} title={t.noRounds} description={manager ? t.noRoundsManager : t.noRoundsCoach} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {list.map((r) => {
            const groups = (r.evaluation_round_groups ?? []).map((g) => g.group_id).filter((g) => manager || myTeams.has(g));
            const total = (players ?? []).filter((p) => p.group_id && groups.includes(p.group_id)).length;
            const p = progress.get(r.id) ?? { submitted: 0, drafts: 0 };
            const left = Math.max(0, total - p.submitted);
            const overdue = r.status === "open" && r.due_on && r.due_on < ctx.today;
            const pct = total ? Math.round((p.submitted / total) * 100) : 0;
            return (
              <li key={r.id}>
                <Link href={`/performanta/evaluari/${r.id}`} className="grid gap-2 px-4 py-3 hover:bg-canvas sm:grid-cols-[minmax(0,1fr)_14rem_auto] sm:items-center">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{r.name}</span>
                      <span className={cn("inline-flex h-6 items-center rounded-md px-2 text-xs font-semibold", r.status === "published" ? "bg-st-green-soft text-ink" : "bg-st-blue-soft text-ink")}>{t.roundStatus[r.status as "open" | "published"]}</span>
                    </span>
                    <span className="block text-sm text-ink-3">
                      {groups.map(teamName).join(", ")}
                      {r.due_on && r.status === "open" ? ` · ${overdue ? t.overdue(formatDate(r.due_on)) : t.due(formatDate(r.due_on))}` : ""}
                    </span>
                    {r.status === "open" && left && !manager ? <span className="block text-sm font-semibold text-ink">{t.toRate(left)}</span> : null}
                  </span>
                  <span className="space-y-1">
                    <span className="block text-sm text-ink-2">{t.progress(p.submitted, total)}</span>
                    <span className="block h-2 overflow-hidden rounded-full bg-sunken" aria-hidden><span className="block h-full rounded-full bg-st-green" style={{ width: `${pct}%` }} /></span>
                  </span>
                  <ChevronRight className="hidden size-5 text-ink-3 sm:block" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
