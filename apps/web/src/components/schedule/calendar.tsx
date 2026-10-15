import Link from "next/link";
import { CalendarDays, CircleCheck, Clock, Dumbbell, MapPin, Trophy, Users } from "lucide-react";
import { EVENT_KIND_LABELS, WEEKDAYS_RO, WEEKDAYS_SHORT_RO, MONTHS_RO, isoWeekday, localDate, localTime, type EventKind } from "@club/shared";
import { getT } from "@/messages";
import { cn } from "@/lib/cn";
import type { CalendarEvent } from "./queries";

export const KIND_ICONS: Record<string, typeof Dumbbell> = {
  training: Dumbbell, match: Trophy, booking: MapPin, meeting: Users, other: CalendarDays,
};

type Team = { id: string; name: string; color: string | null };

/** Un eveniment în calendar: oră, tip (pictogramă + cuvânt), titlu, echipe, teren, stare. */
export function EventItem({ e, teams, timezone, today, now, compact }: { e: CalendarEvent; teams: Map<string, Team>; timezone: string; today: string; now: number; compact?: boolean }) {
  const t = getT().schedule;
  const Icon = KIND_ICONS[e.kind] ?? CalendarDays;
  const cancelled = e.status === "cancelled";
  const past = localDate(e.ends_at, timezone) < today || (localDate(e.ends_at, timezone) === today && Date.parse(e.ends_at) < now);
  const needsAttendance = e.kind === "training" && !cancelled && past && !e.attendance_saved_at;
  const team = e.groupIds.map((g) => teams.get(g)).filter(Boolean) as Team[];
  const title = e.match ? `${e.match.is_home ? "" : "@ "}${e.match.opponent ?? e.title}` : e.title;
  return (
    <Link href={`/program/${e.id}`}
      className={cn("block rounded-[var(--radius-control)] border border-line bg-surface p-2 hover:border-border-control",
        cancelled && "bg-sunken", compact ? "text-sm" : "")}>
      <span className="flex flex-wrap items-center gap-x-1.5 text-xs font-semibold text-ink-2">
        <Icon className="size-3.5 shrink-0" aria-hidden />
        <span>{localTime(e.starts_at, timezone)}</span>
        <span className="sr-only">{EVENT_KIND_LABELS[e.kind as EventKind]}</span>
        {!compact ? team.map((g) => (
          <span key={g.id} className="inline-flex items-center gap-1">
            <span aria-hidden className="size-2 rounded-full" style={{ background: g.color ?? "var(--color-line-strong)" }} />{g.name}
          </span>
        )) : null}
      </span>
      <span className={cn("mt-0.5 block font-semibold leading-snug", cancelled && "text-ink-3 line-through")}>{title}</span>
      {compact && team.length ? (
        <span className="mt-0.5 flex flex-wrap gap-x-1.5 text-xs text-ink-2">
          {team.map((g) => (
            <span key={g.id} className="inline-flex items-center gap-1">
              <span aria-hidden className="size-2 rounded-full" style={{ background: g.color ?? "var(--color-line-strong)" }} />{g.name}
            </span>
          ))}
        </span>
      ) : null}
      {e.match && e.match.status !== "scheduled" ? (
        <span className="block text-sm font-bold tabular-nums">{t.event.score(e.match.goals_for, e.match.goals_against)}</span>
      ) : null}
      {!compact && e.venue ? <span className="block truncate text-xs text-ink-3">{e.venue.name}</span> : null}
      {cancelled ? <span className="mt-1 inline-flex h-5 items-center rounded bg-st-gray px-1.5 text-2xs font-bold text-white">{t.cancelled}</span> : null}
      {needsAttendance ? (
        <span className="mt-1 inline-flex h-5 items-center gap-1 rounded bg-st-orange px-1.5 text-2xs font-bold text-ink"><Clock className="size-3" aria-hidden />{t.attendanceMissing}</span>
      ) : e.kind === "training" && e.attendance_saved_at ? (
        <span className="mt-1 inline-flex items-center gap-1 text-2xs font-semibold text-st-green"><CircleCheck className="size-3" aria-hidden />{t.attendanceDone}</span>
      ) : null}
    </Link>
  );
}

export function dayLabel(iso: string) {
  return `${WEEKDAYS_RO[isoWeekday(iso) - 1]}, ${Number(iso.slice(8, 10))} ${MONTHS_RO[Number(iso.slice(5, 7)) - 1]}`;
}

/** Săptămâna: grilă pe 7 coloane pe ecrane mari, listă pe zile pe telefon. */
export function WeekView({ days, events, teams, timezone, today, now }: { days: string[]; events: CalendarEvent[]; teams: Map<string, Team>; timezone: string; today: string; now: number }) {
  const t = getT().schedule;
  const byDay = new Map<string, CalendarEvent[]>(days.map((d) => [d, []]));
  for (const e of events) byDay.get(localDate(e.starts_at, timezone))?.push(e);
  return (
    <>
      <div className="hidden grid-cols-7 gap-2 xl:grid">
        {days.map((d) => (
          <section key={d} aria-label={dayLabel(d)} className={cn("min-h-64 rounded-[var(--radius-card)] border bg-canvas p-2", d === today ? "border-brand" : "border-line")}>
            <h2 className="mb-2 flex items-baseline justify-between text-sm">
              <span className="capitalize">{WEEKDAYS_RO[isoWeekday(d) - 1]}</span>
              <span className={cn("tabular-nums", d === today ? "rounded bg-brand px-1.5 text-brand-ink" : "text-ink-3")}>{Number(d.slice(8, 10))}</span>
            </h2>
            <div className="space-y-1.5">
              {byDay.get(d)!.map((e) => <EventItem key={e.id} e={e} teams={teams} timezone={timezone} today={today} now={now} compact />)}
            </div>
          </section>
        ))}
      </div>
      <div className="xl:hidden">
        <AgendaView days={days} events={events} teams={teams} timezone={timezone} today={today} now={now} emptyText={t.noEventsWeek} />
      </div>
    </>
  );
}

/** Lista pe zile (telefon și vederea „Listă"); zilele fără nimic nu apar. */
export function AgendaView({ days, events, teams, timezone, today, now, emptyText }: { days: string[]; events: CalendarEvent[]; teams: Map<string, Team>; timezone: string; today: string; now: number; emptyText: string }) {
  const t = getT().schedule;
  const byDay = new Map<string, CalendarEvent[]>(days.map((d) => [d, []]));
  for (const e of events) byDay.get(localDate(e.starts_at, timezone))?.push(e);
  const filled = days.filter((d) => byDay.get(d)!.length);
  if (!filled.length) return <p className="rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface p-6 text-center text-ink-3">{emptyText}</p>;
  return (
    <div className="space-y-4">
      {filled.map((d) => (
        <section key={d} aria-label={dayLabel(d)}>
          <h2 className="mb-2 flex items-center gap-2 text-base capitalize">
            {dayLabel(d)}
            {d === today ? <span className="rounded bg-brand px-1.5 text-sm normal-case text-brand-ink">{t.today}</span> : null}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {byDay.get(d)!.map((e) => <EventItem key={e.id} e={e} teams={teams} timezone={timezone} today={today} now={now} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Luna: grilă cu primele evenimente ale fiecărei zile (pe telefon: listă). */
export function MonthView({ month, events, teams, timezone, today, now }: { month: string; events: CalendarEvent[]; teams: Map<string, Team>; timezone: string; today: string; now: number }) {
  const t = getT().schedule;
  const first = `${month}-01`;
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = isoWeekday(first) - 1;
  const cells: Array<string | null> = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  while (cells.length % 7) cells.push(null);
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const d = localDate(e.starts_at, timezone);
    byDay.set(d, [...(byDay.get(d) ?? []), e]);
  }
  return (
    <>
      <div className="hidden lg:block">
        <div className="grid grid-cols-7 gap-1 pb-1 text-center text-2xs font-semibold text-ink-3">
          {WEEKDAYS_SHORT_RO.map((d) => <span key={d}>{d}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => (
            <div key={i} className={cn("min-h-28 rounded-[var(--radius-control)] border p-1.5", d ? "bg-surface" : "border-transparent", d === today ? "border-brand" : "border-line")}>
              {d ? (
                <>
                  <p className={cn("mb-1 text-right text-sm tabular-nums", d === today ? "font-bold" : "text-ink-3")}>{Number(d.slice(8, 10))}</p>
                  <ul className="space-y-0.5">
                    {(byDay.get(d) ?? []).slice(0, 3).map((e) => {
                      const team = e.groupIds.map((g) => teams.get(g)).filter(Boolean) as Team[];
                      const Icon = KIND_ICONS[e.kind] ?? CalendarDays;
                      return (
                        <li key={e.id}>
                          <Link href={`/program/${e.id}`} className={cn("flex items-center gap-1 truncate rounded px-1 text-xs hover:bg-sunken", e.status === "cancelled" && "text-ink-3 line-through")}>
                            <Icon className="size-3 shrink-0" aria-hidden />
                            <span className="sr-only">{EVENT_KIND_LABELS[e.kind as EventKind]}</span>
                            <span className="tabular-nums">{localTime(e.starts_at, timezone)}</span>
                            <span className="truncate font-semibold">{team.map((g) => g.name).join(", ") || e.title}</span>
                          </Link>
                        </li>
                      );
                    })}
                    {(byDay.get(d)?.length ?? 0) > 3 ? <li className="px-1 text-xs text-ink-3">{t.more(byDay.get(d)!.length - 3)}</li> : null}
                  </ul>
                </>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <div className="lg:hidden">
        <AgendaView days={cells.filter(Boolean) as string[]} events={events} teams={teams} timezone={timezone} today={today} now={now} emptyText={t.noEvents} />
      </div>
    </>
  );
}
