import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { can, formatEventWhen } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Badge } from "@/components/ui/status";
import { TableWrap } from "@/components/ui/misc";
import { CompetitionDialogButton } from "@/components/schedule/competition-dialog";
import { ImportWizard } from "@/components/schedule/import-wizard";
import { getT } from "@/messages";
import { cn } from "@/lib/cn";

export const metadata = { title: "Competiție" };

export default async function CompetitionPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, ctx } = await requireCapability("viewSchedule");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: c } = await db.from("competitions").select("*, groups(name)").eq("id", id).maybeSingle();
  if (!c) notFound();
  const t = getT().schedule;
  const tz = ctx.settings.timezone;
  const canManage = can(ctx.role, "manageSchedule");
  const [fixtures, standings] = await Promise.all([
    db.from("matches").select("event_id, round, is_home, goals_for, goals_against, status, opponents(name), events!inner(starts_at, ends_at, status, deleted_at)")
      .eq("competition_id", id).is("events.deleted_at", null),
    db.from("competition_standings").select("*").eq("competition_id", id).order("position"),
  ]);
  const games = (fixtures.data ?? []).sort((a, b) => a.events!.starts_at.localeCompare(b.events!.starts_at));

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/program/competitii" className="mb-1 inline-flex h-10 items-center gap-1 text-sm font-semibold text-ink-2 hover:text-ink">
            <ChevronLeft className="size-4" aria-hidden /> {t.competitions.title}
          </Link>
          <h1 className="text-2xl md:text-3xl">{c.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-ink-3">
            <Badge tone="outline">{t.competitions.sources[c.source] ?? c.source}</Badge>
            {c.groups?.name ?? ""}{c.own_name ? ` · „${c.own_name}”` : ""}
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <CompetitionDialogButton teams={ctx.groups.map((g) => ({ id: g.id, name: g.name }))} clubName={ctx.club.name} competition={{
              id: c.id, name: c.name, groupId: c.group_id ?? "", source: c.source as "frf", ownName: c.own_name ?? "", halfMinutes: c.half_minutes ?? "", yellowLimit: c.yellow_limit,
            }} />
          </div>
        ) : null}
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card className="overflow-hidden">
          <CardHeader title={t.competitions.fixtures} action={canManage ? <ImportWizard mode="fixtures" competitionId={c.id} ownName={c.own_name ?? ""} timezone={tz} label={t.competitions.importFixtures} /> : null} />
          {games.length === 0 ? <div className="p-4"><EmptyState title={t.noEvents} /></div> : (
            <ul className="mt-3 divide-y divide-line border-t border-line">
              {games.map((g) => (
                <li key={g.event_id}>
                  <Link href={`/program/${g.event_id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-canvas">
                    <span className="w-14 shrink-0 text-sm text-ink-3">{g.round ? t.roundShort(g.round) : ""}</span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block font-semibold", g.events!.status === "cancelled" && "text-ink-3 line-through")}>{g.is_home ? "" : "@ "}{g.opponents?.name ?? "—"}</span>
                      <span className="block text-sm text-ink-3">{formatEventWhen(g.events!.starts_at, null, tz)}</span>
                    </span>
                    {g.status === "finished" ? (
                      <span className="text-lg font-bold tabular-nums">{g.goals_for}–{g.goals_against}</span>
                    ) : g.status === "live" ? <Badge tone="blue">{t.event.live}</Badge> : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title={t.competitions.standings} action={canManage ? <ImportWizard mode="standings" competitionId={c.id} ownName={c.own_name ?? ""} timezone={tz} label={t.competitions.importStandings} /> : null} />
          {(standings.data ?? []).length === 0 ? <p className="p-4 text-ink-3">{t.competitions.noStandings}</p> : (
            <TableWrap className="mt-3 md:rounded-none md:border-x-0 md:border-b-0">
              <thead>
                <tr>
                  <th scope="col">{t.competitions.standingsColumns.pos}</th>
                  <th scope="col">{t.competitions.standingsColumns.team}</th>
                  <th scope="col" className="text-right">{t.competitions.standingsColumns.played}</th>
                  <th scope="col" className="text-right">{t.competitions.standingsColumns.goals}</th>
                  <th scope="col" className="text-right">{t.competitions.standingsColumns.points}</th>
                </tr>
              </thead>
              <tbody>
                {(standings.data ?? []).map((s) => (
                  <tr key={s.position} className={s.is_own ? "bg-st-blue-soft font-semibold" : ""}>
                    <td className="tabular-nums">{s.position}</td>
                    <td>{s.team_name}</td>
                    <td className="text-right tabular-nums">{s.played}</td>
                    <td className="text-right tabular-nums">{s.goals_for}–{s.goals_against}</td>
                    <td className="text-right font-bold tabular-nums">{s.points}</td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>
      </div>
    </div>
  );
}
