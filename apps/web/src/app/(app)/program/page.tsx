import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { MONTHS_RO, addDays, can, weekDates, weekStart } from "@club/shared";
import { requireCapability, visibleGroups } from "@/lib/auth";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { FilterLinks } from "@/components/squad/bits";
import { AgendaView, MonthView, WeekView } from "@/components/schedule/calendar";
import { listEvents } from "@/components/schedule/queries";
import { getT } from "@/messages";
import { requestTime } from "@/lib/request-time";
import { cn } from "@/lib/cn";

export const metadata = { title: "Program" };

type View = "saptamana" | "luna" | "lista";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ zi?: string; vedere?: string; echipa?: string; tip?: string }> }) {
  const { db, ctx } = await requireCapability("viewSchedule");
  const sp = await searchParams;
  const t = getT().schedule;
  const tz = ctx.settings.timezone;
  const view: View = sp.vedere === "luna" || sp.vedere === "lista" ? sp.vedere : "saptamana";
  const day = typeof sp.zi === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.zi) ? sp.zi : ctx.today;
  const kind = sp.tip === "training" || sp.tip === "match" ? sp.tip : null;
  const isCoach = ctx.role === "coach";
  const mine = ctx.staffGroupIds;
  // antrenorul vede implicit echipele lui; poate trece pe tot clubul
  const team = typeof sp.echipa === "string" ? sp.echipa : isCoach ? "mele" : "";
  const groupFilter = team === "mele" ? mine : team && ctx.groups.some((g) => g.id === team) ? [team] : null;

  let from: string, to: string, label: string, prev: string, next: string;
  if (view === "luna") {
    const month = day.slice(0, 7);
    const [y, m] = month.split("-").map(Number);
    from = `${month}-01`;
    to = addDays(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`, -1);
    label = `${MONTHS_RO[m - 1]} ${y}`;
    prev = addDays(from, -1);
    next = addDays(to, 1);
  } else {
    from = weekStart(day);
    to = addDays(from, view === "lista" ? 27 : 6);
    const f = (d: string) => `${Number(d.slice(8, 10))} ${MONTHS_RO[Number(d.slice(5, 7)) - 1].slice(0, 3)}.`;
    label = t.weekLabel(f(from), f(to));
    prev = addDays(from, view === "lista" ? -28 : -7);
    next = addDays(from, view === "lista" ? 28 : 7);
  }
  const now = requestTime();
  const events = await listEvents(db, { from, to, timezone: tz, groupIds: groupFilter, kind });
  const teams = new Map(ctx.groups.map((g) => [g.id, { id: g.id, name: g.name, color: g.color ?? null }]));
  const groups = visibleGroups(ctx);
  const canAdd = can(ctx.role, "manageSchedule") || (isCoach && mine.length > 0);

  const href = (p: Partial<{ zi: string; vedere: View; echipa: string; tip: string | null }>) => {
    const u = new URLSearchParams();
    const z = p.zi ?? day;
    if (z !== ctx.today) u.set("zi", z);
    const v = p.vedere ?? view;
    if (v !== "saptamana") u.set("vedere", v);
    const e = p.echipa ?? team;
    if (e && !(isCoach && e === "mele")) u.set("echipa", e);
    if (isCoach && e === "") u.set("echipa", "toate");
    const k = p.tip === undefined ? kind : p.tip;
    if (k) u.set("tip", k);
    const s = u.toString();
    return s ? `/program?${s}` : "/program";
  };
  const teamItems = [
    ...(isCoach ? [{ href: href({ echipa: "mele" }), label: t.myTeams, active: team === "mele" }] : []),
    { href: href({ echipa: isCoach ? "toate" : "" }), label: t.allTeams, active: !groupFilter },
    ...(isCoach ? ctx.groups.filter((g) => g.is_active && !mine.includes(g.id)) : groups).map((g) => ({ href: href({ echipa: g.id }), label: g.name, active: team === g.id })),
  ];

  return (
    <>
      <PageHeader title={t.title}
        action={canAdd ? <LinkButton href={`/program/nou${day !== ctx.today ? `?zi=${day}` : ""}`} variant="primary" icon={<Plus className="size-5" aria-hidden />}>{t.add}</LinkButton> : null} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Link href={href({ zi: prev })} aria-label={t.prev} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-line bg-sunken transition-colors"><ChevronLeft className="size-6" aria-hidden /></Link>
          <Link href={href({ zi: ctx.today })} className="inline-flex h-11 items-center rounded-full px-3 font-medium hover:bg-line bg-sunken transition-colors">{t.today}</Link>
          <Link href={href({ zi: next })} aria-label={t.next} className="inline-flex size-11 items-center justify-center rounded-full hover:bg-line bg-sunken transition-colors"><ChevronRight className="size-6" aria-hidden /></Link>
        </div>
        <p className="px-2 text-lg font-semibold" aria-live="polite">{label.charAt(0).toLocaleUpperCase("ro") + label.slice(1)}</p>
        <nav aria-label={t.viewLabel} className="flex w-full gap-1 rounded-[0.75rem] bg-sunken p-1 sm:ml-auto sm:w-auto">
          {(["saptamana", "luna", "lista"] as View[]).map((v) => (
            <Link key={v} href={href({ vedere: v })} aria-current={view === v ? "page" : undefined}
              className={cn("inline-flex h-8 flex-1 items-center justify-center rounded-[0.5rem] px-3.5 text-[0.875rem] font-medium transition-colors sm:flex-none", view === v ? "bg-surface text-ink shadow-[0_1px_3px_rgb(0_0_0/0.12)]" : "text-ink-2 hover:text-ink")}>
              {v === "saptamana" ? t.views.week : v === "luna" ? t.views.month : t.views.agenda}
            </Link>
          ))}
        </nav>
      </div>
      <div className="mb-4 space-y-2">
        {teamItems.length > 1 ? <FilterLinks label={t.allTeams} items={teamItems} /> : null}
        <FilterLinks label={t.kindFilter} items={[
          { href: href({ tip: null }), label: t.allKinds, active: !kind },
          { href: href({ tip: "training" }), label: t.trainings, active: kind === "training" },
          { href: href({ tip: "match" }), label: t.matches, active: kind === "match" },
        ]} />
      </div>

      {view === "luna" ? (
        <MonthView month={from.slice(0, 7)} events={events} teams={teams} timezone={tz} today={ctx.today} now={now} />
      ) : view === "lista" ? (
        <AgendaView days={weekDates(from).concat(weekDates(addDays(from, 7)), weekDates(addDays(from, 14)), weekDates(addDays(from, 21)))} events={events} teams={teams} timezone={tz} today={ctx.today} now={now} emptyText={t.noEvents} />
      ) : (
        <WeekView days={weekDates(from)} events={events} teams={teams} timezone={tz} today={ctx.today} now={now} />
      )}
    </>
  );
}
