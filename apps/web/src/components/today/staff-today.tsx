import Link from "next/link";
import { Bandage, ChevronRight, CircleAlert, ClipboardCheck, Clock, FileWarning, Trophy, Users } from "lucide-react";
import { addDays, can, diffDays, formatDate, formatDateShort, formatEventWhen, localDate, localTime, type AppContext, type Db } from "@club/shared";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { Badge } from "@/components/ui/status";
import { KIND_ICONS } from "@/components/schedule/calendar";
import { listEvents, type CalendarEvent } from "@/components/schedule/queries";
import { requestTime } from "@/lib/request-time";
import { getT } from "@/messages";
import { cn } from "@/lib/cn";
import { PendingSyncNotice, WarmOffline } from "./client-bits";
import { MoneyTodayCard } from "@/components/money/today-cards";

type Todo = { key: string; text: string; href: string; tone: "red" | "orange" | "blue"; icon: typeof Clock };

const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase("ro") + s.slice(1);

/** Azi pentru staff: antrenorul vede echipele lui, biroul vede tot clubul. */
export async function StaffToday({ db, ctx }: { db: Db; ctx: AppContext }) {
  const t = getT().today;
  const tz = ctx.settings.timezone;
  const now = requestTime();
  const isCoach = ctx.role === "coach";
  const groups = isCoach ? ctx.staffGroupIds : null;
  const runs = can(ctx.role, "runEvents");

  const [todayEvents, week, recent, players] = await Promise.all([
    listEvents(db, { from: ctx.today, to: ctx.today, timezone: tz, groupIds: groups }),
    listEvents(db, { from: ctx.today, to: addDays(ctx.today, 7), timezone: tz, groupIds: groups, kind: "match" }),
    listEvents(db, { from: addDays(ctx.today, -7), to: ctx.today, timezone: tz, groupIds: groups }),
    (() => {
      let q = db.from("players").select("id, full_name, group_id, status_id, status_return_on, medical_visa_expires_on").eq("is_active", true).is("anonymized_at", null);
      if (groups) q = q.in("group_id", groups.length ? groups : ["00000000-0000-0000-0000-000000000000"]);
      return q;
    })(),
  ]);
  const roster = players.data ?? [];
  const outStatus = new Set(ctx.statuses.filter((s) => s.availability === "out").map((s) => s.id));
  const teamName = new Map(ctx.groups.map((g) => [g.id, g.name]));
  const teamsOf = (e: CalendarEvent) => e.groupIds.map((g) => teamName.get(g)).filter(Boolean).join(", ");
  const dayShort = (ts: string) => formatDateShort(localDate(ts, tz), false);

  // următorul meci (nefinalizat) și starea lotului
  const nextMatch = week.find((e) => e.match && e.match.status !== "finished" && e.status !== "cancelled") ?? null;
  let blockedCount = 0;
  let squadCount = 0;
  if (nextMatch) {
    const [elig, squad] = await Promise.all([
      db.rpc("match_eligibility", { p_event: nextMatch.id }),
      db.from("match_squad").select("player_id", { count: "exact", head: true }).eq("event_id", nextMatch.id),
    ]);
    blockedCount = new Set(((elig.data ?? []) as Array<{ player_id: string }>).map((x) => x.player_id)).size;
    squadCount = squad.count ?? 0;
  }

  // de rezolvat
  const todos: Todo[] = [];
  for (const e of recent) {
    if (e.kind === "training" && e.status !== "cancelled" && !e.attendance_saved_at && Date.parse(e.ends_at) < now) {
      todos.push({ key: "a" + e.id, text: t.missingAttendance(`${e.title}`, dayShort(e.starts_at)), href: `/program/${e.id}/prezenta`, tone: "orange", icon: ClipboardCheck });
    }
    if (e.kind === "match" && e.match && e.match.status !== "finished" && e.status !== "cancelled" && Date.parse(e.ends_at) < now) {
      todos.push({ key: "m" + e.id, text: t.unclosed(e.match.opponent ?? e.title, dayShort(e.starts_at)), href: `/program/${e.id}/meci`, tone: "orange", icon: Trophy });
    }
  }
  if (nextMatch && !squadCount && diffDays(ctx.today, localDate(nextMatch.starts_at, tz)) <= 3) {
    todos.push({ key: "s" + nextMatch.id, text: t.noSquad(nextMatch.match?.opponent ?? nextMatch.title, dayShort(nextMatch.starts_at)), href: `/program/${nextMatch.id}/meci`, tone: "blue", icon: Users });
  }
  const warn = ctx.settings.alerts.visa_days_before;
  const visas = roster
    .map((p) => ({ p, days: p.medical_visa_expires_on ? diffDays(ctx.today, p.medical_visa_expires_on) : -1 }))
    .filter((x) => x.days <= warn)
    .sort((a, b) => a.days - b.days);
  for (const { p, days } of visas.slice(0, isCoach ? 10 : 5)) {
    todos.push({ key: "v" + p.id, text: t.visaExpiring(p.full_name, days), href: `/lot/jucatori/${p.id}`, tone: days < 0 ? "red" : "orange", icon: FileWarning });
  }
  const injured = roster.filter((p) => p.status_id && outStatus.has(p.status_id));
  if (isCoach) {
    for (const p of injured) todos.push({ key: "i" + p.id, text: t.injured(p.full_name, p.status_return_on ? formatDate(p.status_return_on, { year: false }) : null), href: `/lot/jucatori/${p.id}`, tone: "red", icon: Bandage });
  }
  const noTeam = isCoach ? 0 : roster.filter((p) => !p.group_id).length;
  if (noTeam) todos.push({ key: "noteam", text: t.noTeam(noTeam), href: "/lot?echipa=none", tone: "blue", icon: Users });

  // ecranele de prezență de azi, pregătite pentru teren (fără semnal)
  const warm = runs ? todayEvents.filter((e) => e.kind === "training" && e.status !== "cancelled").map((e) => `/program/${e.id}/prezenta`) : [];
  const rosterByGroup = (gids: string[]) => roster.filter((p) => p.group_id && gids.includes(p.group_id));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl md:text-3xl">{capitalize(formatDate(ctx.today, { weekday: true, year: false }))}</h1>
      <WarmOffline urls={warm} />
      {runs ? <PendingSyncNotice /> : null}
      <MoneyTodayCard db={db} ctx={ctx} />

      {!isCoach ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label={t.stats.trainings} value={todayEvents.filter((e) => e.kind === "training" && e.status !== "cancelled").length} />
          <Stat label={t.stats.matches} value={week.filter((e) => e.status !== "cancelled").length} />
          <Stat label={t.stats.visas} value={visas.length} tone={visas.some((v) => v.days < 0) ? "red" : visas.length ? "orange" : undefined} />
          <Stat label={t.stats.missing} value={todos.filter((x) => x.key.startsWith("a")).length} tone={todos.some((x) => x.key.startsWith("a")) ? "orange" : undefined} />
        </div>
      ) : null}

      {/* evenimentele de azi */}
      {todayEvents.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface p-5 text-center text-ink-3">{t.nothingToday}</p>
      ) : (
        <section aria-label={t.officeEvents} className="space-y-3">
          {todayEvents.map((e) => {
            const Icon = KIND_ICONS[e.kind];
            const r = rosterByGroup(e.groupIds);
            const out = r.filter((p) => p.status_id && outStatus.has(p.status_id)).length;
            const mine = !isCoach || e.groupIds.some((g) => ctx.staffGroupIds.includes(g));
            const cancelled = e.status === "cancelled";
            return (
              <Card key={e.id}>
                <CardBody className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-1.5 text-sm text-ink-3">{Icon ? <Icon className="size-4" aria-hidden /> : null}{teamsOf(e) || e.title}</p>
                      <h2 className={cn("text-lg", cancelled && "text-ink-3 line-through")}>
                        <Link href={`/program/${e.id}`} className="hover:underline">
                          {localTime(e.starts_at, tz)}–{localTime(e.ends_at, tz)}{e.venue ? ` · ${e.venue.name}` : ""}{e.match ? ` · ${e.match.is_home ? "" : "@ "}${e.match.opponent}` : ""}
                        </Link>
                      </h2>
                    </div>
                    {e.kind === "training" && !cancelled ? (
                      e.attendance_saved_at
                        ? <Badge tone="green">{t.attendanceDone}</Badge>
                        : <Badge tone="orange"><Clock className="size-3.5" aria-hidden />{t.attendanceMissing}</Badge>
                    ) : cancelled ? <Badge tone="gray">{getT().schedule.cancelled}</Badge> : null}
                  </div>
                  {e.kind === "training" && r.length ? <p className="text-ink-2">{t.rosterInfo(r.length, out)}</p> : null}
                  {e.kind === "training" && runs && mine && !cancelled ? (
                    // link complet (nu navigare client), ca pagina să poată fi servită și fără semnal
                    <a href={`/program/${e.id}/prezenta`}
                      className={cn("inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 font-semibold",
                        e.attendance_saved_at ? "border border-border-control bg-surface hover:bg-canvas" : "bg-brand text-brand-ink hover:brightness-110")}>
                      <ClipboardCheck className="size-5" aria-hidden />{e.attendance_saved_at ? t.editAttendance : t.takeAttendance}
                    </a>
                  ) : null}
                </CardBody>
              </Card>
            );
          })}
        </section>
      )}

      {/* următorul meci */}
      <Card>
        <CardHeader title={t.nextMatch} />
        <CardBody className="space-y-3">
          {!nextMatch ? <p className="text-ink-3">{t.noMatch}</p> : (
            <>
              <div>
                <p className="text-sm text-ink-3">{formatEventWhen(nextMatch.starts_at, null, tz)}{nextMatch.match?.competition ? ` · ${nextMatch.match.competition}` : ""}</p>
                <p className="text-lg font-bold">{teamsOf(nextMatch)} · {nextMatch.match?.is_home ? "" : "@ "}{nextMatch.match?.opponent ?? nextMatch.title}</p>
              </div>
              {blockedCount ? (
                <p className="flex items-center gap-2 rounded-[var(--radius-control)] bg-st-yellow-soft px-3 py-2 text-sm">
                  <CircleAlert className="size-5 shrink-0" aria-hidden />{t.blocked(blockedCount)} {squadCount ? t.squadPicked(squadCount) : t.squadNotPicked}
                </p>
              ) : <p className="text-sm text-ink-2">{squadCount ? t.squadPicked(squadCount) : t.squadNotPicked}</p>}
              <Link href={runs ? `/program/${nextMatch.id}/meci` : `/program/${nextMatch.id}`}
                className="inline-flex h-12 w-full items-center justify-center rounded-[var(--radius-control)] border border-border-control bg-surface px-4 font-semibold hover:bg-canvas">
                {squadCount || !runs ? t.openMatch : t.pickSquad}
              </Link>
            </>
          )}
        </CardBody>
      </Card>

      {/* de rezolvat */}
      <Card className="overflow-hidden">
        <CardHeader title={t.todo} />
        {todos.length === 0 ? <p className="p-4 text-ink-3">{t.allDone}</p> : (
          <ul className="mt-3 divide-y divide-line border-t border-line">
            {todos.slice(0, 12).map((x) => (
              <li key={x.key}>
                <Link href={x.href} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-canvas">
                  <x.icon className={cn("size-5 shrink-0", x.tone === "red" ? "text-st-red" : x.tone === "orange" ? "text-ink-2" : "text-st-blue")} aria-hidden />
                  <span className="flex-1">{x.text}</span>
                  <ChevronRight className="size-5 text-ink-3" aria-hidden />
                </Link>
              </li>
            ))}
            {todos.length > 12 ? <li className="px-4 py-2 text-sm text-ink-3">{t.more(todos.length - 12)}</li> : null}
          </ul>
        )}
      </Card>
    </div>
  );
}
