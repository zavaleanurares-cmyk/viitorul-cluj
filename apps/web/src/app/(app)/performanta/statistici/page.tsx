import Link from "next/link";
import { Ban, CircleAlert, TriangleAlert } from "lucide-react";
import { ABSENCE_REASON_LABELS, addDays, formatDateShort, seasonStart, weekStart, type AbsenceReason, type AppContext, type Db } from "@club/shared";
import { requireCapability, visibleGroups } from "@/lib/auth";
import { Card, CardBody, CardHeader, EmptyState, Notice, PageHeader, Stat } from "@/components/ui/card";
import { TabLinks, TableWrap } from "@/components/ui/misc";
import { NavSelect } from "@/components/planning/nav-select";
import { StackedBarsChart, TrendChart } from "@/components/charts";
import { cn } from "@/lib/cn";
import { getT } from "@/messages";

export const metadata = { title: "Statistici" };

type View = "attendance" | "discipline" | "goals" | "activity";
const VIEWS: Record<string, View> = { prezenta: "attendance", disciplina: "discipline", goluri: "goals", activitate: "activity" };
const SLUG: Record<View, string> = { attendance: "prezenta", discipline: "disciplina", goals: "goluri", activity: "activitate" };
const UNDER = 70;
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
const dec = (n: number) => n.toLocaleString("ro-RO", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

type Ev = { id: string; kind: string; starts_at: string; ends_at: string; status: string; deleted_at: string | null; attendance_saved_at: string | null };

/** Evenimentele echipelor, cu o singură interogare (event_teams → events). */
async function teamEvents(db: Db, groupIds: string[], kind: "training" | "match", fromIso: string) {
  if (!groupIds.length) return [] as Array<Ev & { group_id: string }>;
  const { data } = await db.from("event_teams")
    .select("group_id, events!inner(id, kind, starts_at, ends_at, status, deleted_at, attendance_saved_at)")
    .in("group_id", groupIds).eq("events.kind", kind).gte("events.starts_at", fromIso).limit(5000);
  const now = new Date().toISOString();
  return (data ?? []).map((r) => ({ ...(r.events as unknown as Ev), group_id: r.group_id }))
    .filter((e) => !e.deleted_at && e.status !== "cancelled" && e.ends_at <= now);
}

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ vedere?: string; echipa?: string; perioada?: string }> }) {
  const { db, ctx } = await requireCapability("viewAnalysis");
  const sp = await searchParams;
  const t = getT().performance.stats;
  const manager = ctx.role === "sporting_director" || ctx.role === "physio";
  const view: View = VIEWS[sp.vedere ?? ""] && (VIEWS[sp.vedere ?? ""] !== "activity" || manager) ? VIEWS[sp.vedere!] : "attendance";
  const teams = visibleGroups(ctx);
  const team = teams.find((g) => g.id === sp.echipa) ?? (teams.length === 1 ? teams[0] : null);
  const season = seasonStart(ctx.today, ctx.settings.season_start);
  const href = (o: { vedere?: View; echipa?: string | null; perioada?: string | null }) => {
    const u = new URLSearchParams();
    const v = o.vedere ?? view;
    if (v !== "attendance") u.set("vedere", SLUG[v]);
    const e = o.echipa === undefined ? team?.id : o.echipa;
    if (e) u.set("echipa", e);
    const p = o.perioada === undefined ? sp.perioada : o.perioada;
    if (p) u.set("perioada", p);
    const q = u.toString();
    return `/performanta/statistici${q ? `?${q}` : ""}`;
  };
  const tabs = (["attendance", "discipline", "goals", ...(manager ? ["activity"] : [])] as View[]).map((v) => ({ key: v, href: href({ vedere: v }), label: t.views[v] }));

  return (
    <>
      <PageHeader title={t.title} description={t.description}
        action={view !== "activity" && teams.length > 1 ? (
          <NavSelect label={t.team} value={team?.id ?? ""} className="w-full sm:w-56"
            options={[{ value: "", label: t.allTeams, href: href({ echipa: null }) }, ...teams.map((g) => ({ value: g.id, label: g.name, href: href({ echipa: g.id }) }))]} />
        ) : undefined} />
      <TabLinks className="mb-4" current={view} tabs={tabs} />
      {view === "attendance" ? <AttendanceView db={db} ctx={ctx} groupIds={team ? [team.id] : teams.map((g) => g.id)} season={season} period={sp.perioada === "sezon" ? "season" : "d30"} href={href} /> : null}
      {view === "discipline" ? <DisciplineView db={db} ctx={ctx} groups={team ? [team] : teams} season={season} /> : null}
      {view === "goals" ? (team ? <GoalsView db={db} team={team} season={season} /> : <EmptyState title={t.goals.pickTeam} />) : null}
      {view === "activity" ? <ActivityView db={db} ctx={ctx} /> : null}
    </>
  );
}

// ---------------------------------------------------------------------------
async function AttendanceView({ db, ctx, groupIds, season, period, href }: {
  db: Db; ctx: AppContext; groupIds: string[]; season: string; period: "d30" | "season";
  href: (o: { perioada?: string | null }) => string;
}) {
  const t = getT().performance.stats;
  const from = period === "season" ? season : addDays(ctx.today, -29);
  const events = (await teamEvents(db, groupIds, "training", `${from}T00:00:00Z`)).filter((e) => e.attendance_saved_at);
  const ids = [...new Set(events.map((e) => e.id))];
  const [{ data: att }, { data: players }] = await Promise.all([
    ids.length ? db.from("attendance").select("event_id, player_id, status, reason").in("event_id", ids).limit(20000) : Promise.resolve({ data: [] }),
    groupIds.length ? db.from("players").select("id, display_name, group_id").in("group_id", groupIds).eq("is_active", true).is("anonymized_at", null).order("display_name") : Promise.resolve({ data: [] }),
  ]);
  const evDay = new Map(events.map((e) => [e.id, e.starts_at.slice(0, 10)]));
  const per = new Map<string, { present: number; total: number; reasons: Map<string, number> }>();
  const weeks = new Map<string, { present: number; total: number }>();
  for (const a of att ?? []) {
    const p = per.get(a.player_id) ?? { present: 0, total: 0, reasons: new Map() };
    const ok = a.status === "present" || a.status === "late";
    // absența din cauza unei accidentări nu scade prezența (jucătorul nu putea veni); apare doar la motive
    const injured = !ok && (a.status === "injured" || a.reason === "injured");
    if (!injured) p.total++;
    if (ok) p.present++;
    else { const r = a.reason ?? a.status; p.reasons.set(r, (p.reasons.get(r) ?? 0) + 1); }
    per.set(a.player_id, p);
    if (injured) continue;
    const w = weekStart(evDay.get(a.event_id) ?? ctx.today);
    const wv = weeks.get(w) ?? { present: 0, total: 0 };
    wv.total++; if (ok) wv.present++;
    weeks.set(w, wv);
  }
  const rows = (players ?? []).map((p) => ({ ...p, ...(per.get(p.id) ?? { present: 0, total: 0, reasons: new Map<string, number>() }) }))
    .filter((r) => r.total > 0).map((r) => ({ ...r, rate: pct(r.present, r.total)! })).sort((a, b) => a.rate - b.rate || a.display_name.localeCompare(b.display_name, "ro"));
  const tot = rows.reduce((s, r) => ({ present: s.present + r.present, total: s.total + r.total }), { present: 0, total: 0 });
  const under = rows.filter((r) => r.rate < UNDER);
  const series = [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([w, v]) => ({ x: formatDateShort(w, false), rate: pct(v.present, v.total) }));
  const teamName = (gid: string | null) => ctx.groups.find((g) => g.id === gid)?.name ?? "—";
  const reasonLabel = (r: string) => ABSENCE_REASON_LABELS[r as AbsenceReason] ?? (r === "injured" ? ABSENCE_REASON_LABELS.injured : r === "absent" ? t.att.cols.absent : r);
  return (
    <div className="space-y-4">
      <TabLinks current={period} tabs={[{ key: "d30", href: href({ perioada: null }), label: t.period.d30 }, { key: "season", href: href({ perioada: "sezon" }), label: t.period.season }]} />
      {!rows.length ? <EmptyState title={t.att.noData} /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Stat label={t.att.teamRate} value={`${pct(tot.present, tot.total)}%`} hint={t.att.sessions(ids.length)} tone={(pct(tot.present, tot.total) ?? 0) < UNDER ? "red" : "green"} />
            <Stat label={t.att.under(UNDER)} value={under.length} tone={under.length ? "red" : undefined} />
          </div>
          {under.length ? <Notice tone="red" title={t.att.underTitle(under.length, UNDER)}>{under.map((r) => r.display_name).join(", ")}</Notice> : null}
          {series.length > 1 ? (
            <Card><CardHeader title={t.att.weekly} /><CardBody>
              <TrendChart data={series} series={[{ key: "rate", label: t.att.series }]} domain={[0, 100]} threshold={{ value: UNDER, label: `${UNDER}%` }} caption={t.att.weeklyCaption} />
            </CardBody></Card>
          ) : null}
          <TableWrap>
            <>
              <thead><tr><th scope="col">{t.att.cols.player}</th><th scope="col" className="text-right">{t.att.cols.rate}</th><th scope="col" className="text-right">{t.att.cols.present}</th><th scope="col">{t.att.cols.reasons}</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><Link href={`/lot/jucatori/${r.id}`} className="font-semibold hover:underline">{r.display_name}</Link><span className="block text-sm text-ink-3">{teamName(r.group_id)}</span></td>
                    <td className="text-right">
                      <span className={cn("inline-flex items-center gap-1 font-bold tabular-nums", r.rate < UNDER ? "text-st-red" : "")}>
                        {r.rate < UNDER ? <CircleAlert className="size-4" aria-hidden /> : null}{r.rate}%
                      </span>
                    </td>
                    <td className="text-right tabular-nums">{r.present}/{r.total}</td>
                    <td className="text-sm text-ink-2">{[...r.reasons.entries()].map(([k, n]) => `${reasonLabel(k)} ${n}`).join(", ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </>
          </TableWrap>
          <p className="text-sm text-ink-3">{t.att.parentsNote}</p>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
async function DisciplineView({ db, ctx, groups, season }: { db: Db; ctx: AppContext; groups: AppContext["groups"]; season: string }) {
  const t = getT().performance.stats.disc;
  const withCards = groups.filter((g) => !g.players_on_pitch || g.players_on_pitch >= 9);
  const hidden = groups.length - withCards.length;
  const groupIds = withCards.map((g) => g.id);
  const matches = await teamEvents(db, groupIds, "match", `${season}T00:00:00Z`);
  const matchIds = [...new Set(matches.map((m) => m.id))];
  const [{ data: players }, { data: susp }, { data: evs }, { data: comps }, { data: mrows }] = await Promise.all([
    groupIds.length ? db.from("players").select("id, display_name, group_id").in("group_id", groupIds).eq("is_active", true).is("anonymized_at", null) : Promise.resolve({ data: [] }),
    db.from("suspensions").select("player_id, reason, matches_remaining, competition_id, competitions(name)").gt("matches_remaining", 0),
    matchIds.length ? db.from("match_events").select("event_id, player_id, kind").in("event_id", matchIds).in("kind", ["yellow", "red"]) : Promise.resolve({ data: [] }),
    db.from("competitions").select("id, name, yellow_limit"),
    matchIds.length ? db.from("matches").select("event_id, competition_id").in("event_id", matchIds) : Promise.resolve({ data: [] }),
  ]);
  const inScope = new Map((players ?? []).map((p) => [p.id, p]));
  const compOf = new Map((mrows ?? []).map((m) => [m.event_id, m.competition_id]));
  const comp = new Map((comps ?? []).map((c) => [c.id, c]));
  const suspended = (susp ?? []).filter((s) => inScope.has(s.player_id));
  const suspendedIds = new Set(suspended.map((s) => s.player_id));
  const cards = new Map<string, { y: number; r: number }>();
  const yByComp = new Map<string, number>();
  for (const e of evs ?? []) {
    if (!e.player_id || !inScope.has(e.player_id)) continue;
    const c = cards.get(e.player_id) ?? { y: 0, r: 0 };
    if (e.kind === "yellow") c.y++; else c.r++;
    cards.set(e.player_id, c);
    const cid = compOf.get(e.event_id);
    if (e.kind === "yellow" && cid) yByComp.set(`${e.player_id}:${cid}`, (yByComp.get(`${e.player_id}:${cid}`) ?? 0) + 1);
  }
  const atRisk = [...yByComp.entries()].map(([k, y]) => { const [pid, cid] = k.split(":"); return { pid, c: comp.get(cid), y }; })
    .filter((x) => x.c && !suspendedIds.has(x.pid) && x.y % x.c.yellow_limit === x.c.yellow_limit - 1);
  const cardRows = [...cards.entries()].map(([pid, c]) => ({ p: inScope.get(pid)!, ...c })).sort((a, b) => b.r - a.r || b.y - a.y);
  const teamName = (gid: string | null) => ctx.groups.find((g) => g.id === gid)?.name ?? "—";
  return (
    <div className="space-y-4">
      {hidden ? <Notice tone="gray">{t.hiddenSmall}</Notice> : null}
      {!suspended.length && !atRisk.length ? <EmptyState title={t.none} /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title={`${t.suspended} · ${suspended.length}`} />
            <CardBody>
              <ul className="divide-y divide-line">
                {suspended.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 py-2">
                    <Ban className="mt-0.5 size-5 shrink-0 text-st-red" aria-hidden />
                    <span><Link href={`/lot/jucatori/${s.player_id}`} className="font-semibold hover:underline">{inScope.get(s.player_id)?.display_name}</Link>
                      <span className="block text-sm text-ink-2">{s.reason} · {t.remaining(s.matches_remaining)}{(s.competitions as { name: string } | null)?.name ? ` · ${(s.competitions as { name: string }).name}` : ""}</span></span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={`${t.atRisk} · ${atRisk.length}`} />
            <CardBody>
              <ul className="divide-y divide-line">
                {atRisk.map((x, i) => (
                  <li key={i} className="flex items-start gap-2 py-2">
                    <TriangleAlert className="mt-0.5 size-5 shrink-0 text-st-orange" aria-hidden />
                    <span><Link href={`/lot/jucatori/${x.pid}`} className="font-semibold hover:underline">{inScope.get(x.pid)?.display_name}</Link>
                      <span className="block text-sm text-ink-2">{t.atRiskText(x.y % x.c!.yellow_limit, x.c!.yellow_limit, x.c!.name)}</span></span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      )}
      <Card>
        <CardHeader title={t.cards} />
        <CardBody>
          {!cardRows.length ? <p className="text-ink-3">{t.noCards}</p> : (
            <TableWrap>
              <>
                <thead><tr><th scope="col">{t.cols.player}</th><th scope="col" className="text-right">{t.cols.yellow}</th><th scope="col" className="text-right">{t.cols.red}</th></tr></thead>
                <tbody>{cardRows.map((r) => (
                  <tr key={r.p.id}><td><span className="font-semibold">{r.p.display_name}</span><span className="block text-sm text-ink-3">{teamName(r.p.group_id)}</span></td>
                    <td className="text-right tabular-nums">{r.y}</td><td className="text-right tabular-nums">{r.r}</td></tr>
                ))}</tbody>
              </>
            </TableWrap>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
async function GoalsView({ db, team, season }: { db: Db; team: AppContext["groups"][number]; season: string }) {
  const t = getT().performance.stats.goals;
  const matches = await teamEvents(db, [team.id], "match", `${season}T00:00:00Z`);
  const ids = [...new Set(matches.map((m) => m.id))];
  const [{ data: ms }, { data: evs }, { data: comps }] = await Promise.all([
    ids.length ? db.from("matches").select("event_id, competition_id, status, goals_for, goals_against").in("event_id", ids).eq("status", "finished") : Promise.resolve({ data: [] }),
    ids.length ? db.from("match_events").select("event_id, minute, kind, player_id, players:players!match_events_player_id_fkey(display_name)").in("event_id", ids).in("kind", ["goal", "opp_own_goal", "goal_against", "own_goal"]) : Promise.resolve({ data: [] }),
    db.from("competitions").select("id, name, half_minutes, group_id, is_active, competition_standings(position, team_name, played, goals_for, goals_against, is_own)").eq("group_id", team.id),
  ]);
  const finished = new Set((ms ?? []).map((m) => m.event_id));
  if (!finished.size) return <EmptyState title={t.noMatches} />;
  const half = comps?.find((c) => c.half_minutes)?.half_minutes ?? team.half_minutes ?? 45;
  const len = half * 2;
  const step = len / 6;
  const buckets = Array.from({ length: 6 }, (_, i) => ({ x: `${Math.round(i * step)}–${Math.round((i + 1) * step)}'`, for: 0, against: 0 }));
  const scorers = new Map<string, { name: string; n: number }>();
  for (const e of evs ?? []) {
    if (!finished.has(e.event_id)) continue;
    const b = buckets[Math.min(5, Math.floor(e.minute / step))];
    const isFor = e.kind === "goal" || e.kind === "opp_own_goal";
    if (isFor) b.for++; else b.against++;
    if (e.kind === "goal" && e.player_id) {
      const s = scorers.get(e.player_id) ?? { name: (e.players as { display_name: string } | null)?.display_name ?? "—", n: 0 };
      s.n++; scorers.set(e.player_id, s);
    }
  }
  const gf = (ms ?? []).reduce((s, m) => s + m.goals_for, 0);
  const ga = (ms ?? []).reduce((s, m) => s + m.goals_against, 0);
  const n = finished.size;
  const league = (comps ?? []).map((c) => {
    const rows = c.competition_standings ?? [];
    const own = rows.find((r) => r.is_own);
    if (!own || !rows.length) return null;
    const played = rows.reduce((s, r) => s + r.played, 0);
    const goals = rows.reduce((s, r) => s + r.goals_for, 0);
    return { name: c.name, own, teams: rows.length, avg: played ? goals / played : 0 };
  }).filter((x): x is NonNullable<typeof x> => !!x);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t.for} value={gf} hint={t.perMatch(dec(gf / n))} />
        <Stat label={t.against} value={ga} hint={t.perMatch(dec(ga / n))} />
        <Stat label={t.matchesLabel} value={n} />
      </div>
      <Card><CardHeader title={t.byTime} /><CardBody>
        <StackedBarsChart grouped data={buckets} series={[{ key: "for", label: t.seriesFor }, { key: "against", label: t.seriesAgainst }]} caption={t.byTimeCaption(len)} />
        <p className="mt-2 text-sm text-ink-3">{t.byTimeCaption(len)}</p>
      </CardBody></Card>
      {league.map((l) => (
        <Notice key={l.name} tone="blue" title={`${t.league}: ${l.name}`}>
          {t.leagueText(l.own.position, l.teams, `${l.own.goals_for - l.own.goals_against > 0 ? "+" : ""}${l.own.goals_for - l.own.goals_against}`, l.own.played ? dec(l.own.goals_for / l.own.played) : "—", dec(l.avg))}
        </Notice>
      ))}
      {scorers.size ? (
        <Card><CardHeader title={t.scorers} /><CardBody>
          <ol className="divide-y divide-line">
            {[...scorers.entries()].sort((a, b) => b[1].n - a[1].n).map(([id, s]) => (
              <li key={id} className="flex justify-between py-2"><Link href={`/lot/jucatori/${id}`} className="font-semibold hover:underline">{s.name}</Link><span className="tabular-nums">{s.n}</span></li>
            ))}
          </ol>
        </CardBody></Card>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
async function ActivityView({ db, ctx }: { db: Db; ctx: AppContext }) {
  const t = getT().performance.stats.act;
  const from = addDays(ctx.today, -29);
  const [{ data: coaches }, { data: sg }, { data: rounds }] = await Promise.all([
    db.from("profiles").select("id, full_name").eq("role", "coach").eq("is_active", true).order("full_name"),
    db.from("staff_groups").select("user_id, group_id"),
    db.from("evaluation_rounds").select("id, evaluation_round_groups(group_id)").eq("status", "open"),
  ]);
  const groupsOf = new Map<string, string[]>();
  for (const r of sg ?? []) groupsOf.set(r.user_id, [...(groupsOf.get(r.user_id) ?? []), r.group_id]);
  const allGroups = [...new Set((sg ?? []).map((r) => r.group_id))];
  const [trainings, matchEvents] = await Promise.all([
    teamEvents(db, allGroups, "training", `${from}T00:00:00Z`),
    teamEvents(db, allGroups, "match", `${from}T00:00:00Z`),
  ]);
  const matchIds = [...new Set(matchEvents.map((m) => m.id))];
  const roundIds = (rounds ?? []).map((r) => r.id);
  const [{ data: ms }, { data: players }, { data: evals }] = await Promise.all([
    matchIds.length ? db.from("matches").select("event_id, status, closed_at").in("event_id", matchIds) : Promise.resolve({ data: [] }),
    allGroups.length ? db.from("players").select("id, group_id").in("group_id", allGroups).eq("is_active", true).is("anonymized_at", null) : Promise.resolve({ data: [] }),
    roundIds.length ? db.from("evaluations").select("round_id, player_id, status").in("round_id", roundIds).eq("status", "submitted") : Promise.resolve({ data: [] }),
  ]);
  const closed = new Set((ms ?? []).filter((m) => m.status === "finished" || m.closed_at).map((m) => m.event_id));
  const submitted = new Set((evals ?? []).map((e) => `${e.round_id}:${e.player_id}`));
  const rows = (coaches ?? []).filter((c) => groupsOf.has(c.id)).map((c) => {
    const gs = groupsOf.get(c.id)!;
    const tr = [...new Map(trainings.filter((e) => gs.includes(e.group_id)).map((e) => [e.id, e])).values()];
    const mt = [...new Map(matchEvents.filter((e) => gs.includes(e.group_id)).map((e) => [e.id, e])).values()];
    let evalTotal = 0, evalDone = 0;
    for (const r of rounds ?? []) {
      const rg = (r.evaluation_round_groups ?? []).map((x) => x.group_id).filter((g) => gs.includes(g));
      for (const p of (players ?? []).filter((p) => p.group_id && rg.includes(p.group_id))) { evalTotal++; if (submitted.has(`${r.id}:${p.id}`)) evalDone++; }
    }
    return {
      c, teams: gs.map((g) => ctx.groups.find((x) => x.id === g)?.name ?? "—").join(", "),
      att: { done: tr.filter((e) => e.attendance_saved_at).length, total: tr.length, missing: tr.filter((e) => !e.attendance_saved_at) },
      match: { done: mt.filter((e) => closed.has(e.id)).length, total: mt.length },
      ev: { done: evalDone, total: evalTotal },
    };
  });
  const Cell = ({ done, total }: { done: number; total: number }) => {
    const p = pct(done, total);
    return total ? (
      <span className={cn("inline-flex items-center gap-1 font-semibold tabular-nums", p !== null && p < 80 ? "text-st-red" : "")}>
        {p !== null && p < 80 ? <CircleAlert className="size-4" aria-hidden /> : null}{p}% <span className="font-normal text-ink-3">· {t.of(done, total)}</span>
      </span>
    ) : <span className="text-ink-3">—</span>;
  };
  return (
    <div className="space-y-3">
      <p className="max-w-prose text-ink-3">{t.description}</p>
      {!rows.length ? <EmptyState title={t.none} /> : (
        <TableWrap>
          <>
            <thead><tr><th scope="col">{t.cols.coach}</th><th scope="col">{t.cols.attendance}</th><th scope="col">{t.cols.matches}</th><th scope="col">{t.cols.evaluations}</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.c.id}>
                  <td><span className="font-semibold">{r.c.full_name}</span><span className="block text-sm text-ink-3">{r.teams}</span></td>
                  <td>
                    <Cell {...r.att} />
                    {r.att.missing.length ? (
                      <span className="mt-0.5 block text-sm text-ink-2">{t.missing}: {r.att.missing.slice(0, 4).map((e) => <Link key={e.id} href={`/program/${e.id}/prezenta`} className="mr-2 underline">{formatDateShort(e.starts_at.slice(0, 10), false)}</Link>)}</span>
                    ) : null}
                  </td>
                  <td><Cell {...r.match} /></td>
                  <td><Cell {...r.ev} /></td>
                </tr>
              ))}
            </tbody>
          </>
        </TableWrap>
      )}
    </div>
  );
}
