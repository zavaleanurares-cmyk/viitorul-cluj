import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { INJURY_CONTEXT, INJURY_TYPES, RTP_STAGES, can, diffDays, formatDate, formatDateShort, label, seasonStart, zoneLabel } from "@club/shared";
import { requireCapability, visibleGroups } from "@/lib/auth";
import { BarsChart } from "@/components/charts";
import { Card, CardBody, CardHeader, EmptyState, PageHeader, Stat } from "@/components/ui/card";
import { TabLinks } from "@/components/ui/misc";
import { NavSelect } from "@/components/planning/nav-select";
import { daysLost, daysUnavailable, injuryZoneText } from "@/components/players/domain";
import { InjuryActions } from "@/components/performance/injury-actions";
import { cn } from "@/lib/cn";
import { getT } from "@/messages";

export const metadata = { title: "Medical" };

type Row = {
  id: string; player_id: string; zone: string | null; side: string | null; zone_detail: string | null; zone_uncertain: boolean;
  injury_type: string | null; context: string | null; severity: string | null; occurred_on: string; expected_return_on: string | null;
  actual_return_on: string | null; rtp_stage: number; diagnosis: string | null; recurrence_of: string | null;
  players: { display_name: string; group_id: string | null; is_active: boolean } | null;
};

/**
 * Accidentările clubului (preparatorul: toate; antrenorul: echipele lui, prin RLS).
 * Întâi ce trebuie verificat, apoi lista activă pe etape de revenire, apoi sezonul.
 */
export default async function MedicalPage({ searchParams }: { searchParams: Promise<{ vedere?: string; echipa?: string }> }) {
  const { db, ctx } = await requireCapability("viewMedicalFile");
  const sp = await searchParams;
  const t = getT().performance.medical;
  const view = sp.vedere === "istoric" ? "history" : "active";
  const teams = visibleGroups(ctx);
  const team = teams.find((g) => g.id === sp.echipa) ?? null;
  const season = seasonStart(ctx.today, ctx.settings.season_start);
  const canManage = can(ctx.role, "manage");

  const { data, error } = await db.from("injuries")
    .select("id, player_id, zone, side, zone_detail, zone_uncertain, injury_type, context, severity, occurred_on, expected_return_on, actual_return_on, rtp_stage, diagnosis, recurrence_of, players!inner(display_name, group_id, is_active)")
    .or(`actual_return_on.is.null,occurred_on.gte.${season},actual_return_on.gte.${season}`)
    .order("occurred_on", { ascending: false })
    .limit(1000);
  if (error) throw error;
  const all = ((data ?? []) as unknown as Row[]).filter((r) => r.players?.is_active && (!team || r.players.group_id === team.id));
  const open = all.filter((r) => !r.actual_return_on)
    .sort((a, b) => a.rtp_stage - b.rtp_stage || (a.expected_return_on ?? "9999").localeCompare(b.expected_return_on ?? "9999"));
  const closed = all.filter((r) => r.actual_return_on && r.actual_return_on >= season);
  const inSeason = all.filter((r) => r.occurred_on >= season);
  const ids = new Set(all.map((r) => r.id));
  const recurrences = inSeason.filter((r) => r.recurrence_of && ids.has(r.recurrence_of)).length;
  // zile pierdute: reuniunea perioadelor pe fiecare jucător
  const byPlayer = new Map<string, Row[]>();
  for (const r of all) byPlayer.set(r.player_id, [...(byPlayer.get(r.player_id) ?? []), r]);
  const lost = [...byPlayer.values()].reduce((s, list) => s + daysUnavailable(list, season, ctx.today), 0);

  const todos = [
    ...open.filter((r) => r.expected_return_on && r.expected_return_on < ctx.today)
      .map((r) => ({ r, text: t.todo.overdue(r.players!.display_name, diffDays(r.expected_return_on!, ctx.today)) })),
    ...open.filter((r) => !r.expected_return_on).map((r) => ({ r, text: t.todo.noReturn(r.players!.display_name) })),
    ...open.filter((r) => !r.severity || r.severity === "unknown").map((r) => ({ r, text: t.todo.noSeverity(r.players!.display_name) })),
  ];

  const count = (key: (r: Row) => string) => {
    const m = new Map<string, number>();
    for (const r of inSeason) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
    return [...m.entries()].map(([x, value]) => ({ x, value })).sort((a, b) => b.value - a.value || a.x.localeCompare(b.x, "ro"));
  };
  const byZone = count((r) => zoneLabel(r.zone, null, true) || getT().players.medical.zoneUnknown);
  const byContext = count((r) => label(INJURY_CONTEXT, r.context ?? "unknown"));

  const teamName = (gid: string | null) => ctx.groups.find((g) => g.id === gid)?.name ?? "—";
  const href = (o: { vedere?: string; echipa?: string | null }) => {
    const u = new URLSearchParams();
    const v = o.vedere ?? (view === "history" ? "istoric" : "");
    if (v) u.set("vedere", v);
    const e = o.echipa === undefined ? team?.id : o.echipa;
    if (e) u.set("echipa", e);
    const q = u.toString();
    return `/performanta/medical${q ? `?${q}` : ""}`;
  };
  const list = view === "history" ? closed : open;

  return (
    <>
      <PageHeader title={t.title} description={t.description}
        action={teams.length > 1 ? (
          <NavSelect label={t.team} value={team?.id ?? ""} className="w-full sm:w-56"
            options={[{ value: "", label: t.allTeams, href: href({ echipa: null }) }, ...teams.map((g) => ({ value: g.id, label: g.name, href: href({ echipa: g.id }) }))]} />
        ) : undefined} />

      {todos.length ? (
        <Card className="mb-4">
          <CardHeader title={t.todo.title} />
          <CardBody>
            <ul className="divide-y divide-line">
              {todos.map(({ r, text }, i) => (
                <li key={`${r.id}-${i}`}>
                  <Link href={`/lot/jucatori/${r.player_id}/medical`} className="flex min-h-12 items-center gap-2 py-2 font-semibold hover:underline">
                    <CircleAlert className="size-5 shrink-0 text-st-red" aria-hidden />{text}
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label={t.stats.out} value={open.filter((r) => r.rtp_stage < 2).length} tone={open.some((r) => r.rtp_stage < 2) ? "red" : "green"} />
        <Stat label={t.stats.rehab} value={open.filter((r) => r.rtp_stage >= 2).length} tone={open.some((r) => r.rtp_stage >= 2) ? "orange" : undefined} />
        <Stat label={t.stats.season} value={inSeason.length} hint={t.stats.recurrences(recurrences)} />
        <Stat label={t.stats.daysLost} value={lost} hint={t.stats.daysLostHint} />
      </div>

      <TabLinks className="mb-4" current={view} tabs={[
        { key: "active", href: href({ vedere: "" }), label: `${t.views.active}${open.length ? ` · ${open.length}` : ""}` },
        { key: "history", href: href({ vedere: "istoric" }), label: t.views.history },
      ]} />

      {list.length === 0 ? (
        view === "history" ? <EmptyState title={t.emptyHistory} /> : <EmptyState title={t.emptyActive} description={t.emptyActiveText} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line/70 bg-surface shadow-[var(--shadow-card)]">
          {list.map((r) => {
            const zone = injuryZoneText(r) || label(INJURY_TYPES, r.injury_type ?? "other");
            const overdue = !r.actual_return_on && !!r.expected_return_on && r.expected_return_on < ctx.today;
            // ca în fișă: etapa 0 = repaus, apoi 1–5 până la „Apt de joc"
            const stages = RTP_STAGES.length - 1;
            return (
              <li key={r.id} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] md:items-center">
                <div className="min-w-0">
                  <Link href={`/lot/jucatori/${r.player_id}/medical`} className="font-bold hover:underline">{r.players!.display_name}</Link>
                  <span className="text-ink-3"> · {teamName(r.players!.group_id)}</span>
                  <p className="text-[0.9375rem]">{zone}{r.injury_type && injuryZoneText(r) ? ` · ${label(INJURY_TYPES, r.injury_type)}` : ""}</p>
                  <p className="text-sm text-ink-3">
                    {r.actual_return_on
                      ? t.closedOn(formatDateShort(r.actual_return_on), daysLost(r, ctx.today))
                      : t.since(formatDateShort(r.occurred_on), daysLost(r, ctx.today))}
                  </p>
                </div>
                {r.actual_return_on ? <div /> : (
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{t.stage(r.rtp_stage, stages, RTP_STAGES[r.rtp_stage] ?? "")}</p>
                    <div className="mt-1 flex gap-1" aria-hidden>
                      {RTP_STAGES.slice(1).map((_, i) => (
                        <span key={i} className={cn("h-2 flex-1 rounded-full", i < r.rtp_stage ? (r.rtp_stage >= 3 ? "bg-st-green" : r.rtp_stage >= 2 ? "bg-st-orange" : "bg-st-red") : "bg-sunken")} />
                      ))}
                    </div>
                    <p className={cn("mt-1 text-sm", overdue ? "font-semibold text-st-red" : "text-ink-3")}>
                      {overdue ? <CircleAlert className="mr-1 inline size-4 align-[-3px]" aria-hidden /> : null}
                      {r.expected_return_on ? (overdue ? t.expectedOverdue(formatDate(r.expected_return_on)) : t.expected(formatDate(r.expected_return_on))) : t.noExpected}
                    </p>
                  </div>
                )}
                <div className="md:justify-self-end">
                  {canManage && !r.actual_return_on ? (
                    <InjuryActions injuryId={r.id} playerName={r.players!.display_name} canAdvance={r.rtp_stage < RTP_STAGES.length - 2} />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {inSeason.length ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title={t.byZone} />
            <CardBody><BarsChart data={byZone} horizontal label={t.seriesLabel} caption={t.byZoneCaption(formatDate(season))} /></CardBody>
          </Card>
          <Card>
            <CardHeader title={t.byContext} />
            <CardBody><BarsChart data={byContext} horizontal label={t.seriesLabel} caption={t.byContextCaption} /></CardBody>
          </Card>
        </div>
      ) : null}
    </>
  );
}
