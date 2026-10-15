import Link from "next/link";
import { ChevronRight, Clapperboard } from "lucide-react";
import { addDays, formatDate } from "@club/shared";
import { requireCapability, visibleGroups } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { NavSelect } from "@/components/planning/nav-select";
import { AddVideoButton } from "@/components/performance/add-video";
import { getT } from "@/messages";

export const metadata = { title: "Video" };

/** Înregistrările (antrenorul: ale echipelor lui), cele mai noi primele, cu câte marcaje și clipuri au. */
export default async function VideosPage({ searchParams }: { searchParams: Promise<{ echipa?: string }> }) {
  const { db, ctx } = await requireCapability("viewAnalysis");
  const sp = await searchParams;
  const t = getT().performance.video;
  const teams = visibleGroups(ctx);
  const team = teams.find((g) => g.id === sp.echipa) ?? null;
  let q = db.from("videos").select("id, title, source, recorded_on, group_id, video_markers(id, shared)").order("recorded_on", { ascending: false }).limit(200);
  if (team) q = q.eq("group_id", team.id);
  const [{ data: videos }, { data: evs }] = await Promise.all([
    q,
    teams.length
      ? db.from("event_teams").select("group_id, events!inner(id, title, kind, starts_at, status, deleted_at)").in("group_id", teams.map((g) => g.id))
          .in("events.kind", ["match", "training"]).gte("events.starts_at", `${addDays(ctx.today, -120)}T00:00:00Z`).lte("events.starts_at", `${ctx.today}T23:59:59Z`).limit(2000)
      : Promise.resolve({ data: [] }),
  ]);
  const tz = ctx.settings.timezone;
  const dayOf = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  const byEvent = new Map<string, { id: string; date: string; groupIds: string[]; title: string; kind: string }>();
  for (const r of evs ?? []) {
    const e = r.events as unknown as { id: string; title: string; kind: string; starts_at: string; status: string; deleted_at: string | null };
    if (e.deleted_at || e.status === "cancelled") continue;
    const cur = byEvent.get(e.id) ?? { id: e.id, date: dayOf(e.starts_at), groupIds: [], title: e.title, kind: e.kind };
    cur.groupIds.push(r.group_id);
    byEvent.set(e.id, cur);
  }
  // meciurile înaintea antrenamentelor, pentru alegerea automată
  const events = [...byEvent.values()].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "match" ? -1 : 1));
  const teamName = (gid: string | null) => ctx.groups.find((g) => g.id === gid)?.name ?? "—";
  return (
    <>
      <PageHeader title={t.title} description={t.description}
        action={
          <div className="flex flex-wrap gap-2">
            {teams.length > 1 ? (
              <NavSelect label={t.team} value={team?.id ?? ""} className="w-full sm:w-48"
                options={[{ value: "", label: getT().performance.stats.allTeams, href: "/performanta/video" }, ...teams.map((g) => ({ value: g.id, label: g.name, href: `/performanta/video?echipa=${g.id}` }))]} />
            ) : null}
            {teams.length ? <AddVideoButton clubId={ctx.club.id} teams={teams.map((g) => ({ id: g.id, name: g.name }))} events={events} today={ctx.today} /> : null}
          </div>
        } />
      {!videos?.length ? <EmptyState icon={<Clapperboard className="size-8" aria-hidden />} title={t.empty} description={t.emptyText} /> : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {videos.map((v) => {
            const ms = v.video_markers ?? [];
            const shared = ms.filter((m) => m.shared).length;
            return (
              <li key={v.id}>
                <Link href={`/performanta/video/${v.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2 hover:bg-canvas">
                  <Clapperboard className="size-6 shrink-0 text-ink-3" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{v.title}</span>
                    <span className="block text-sm text-ink-3">
                      {formatDate(v.recorded_on)} · {teamName(v.group_id)} · {t.sources[v.source as keyof typeof t.sources]} · {t.markers(ms.length)}{shared ? ` · ${t.clipsShared(shared)}` : ""}
                    </span>
                  </span>
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
