import { CalendarX } from "lucide-react";
import { addDays, diffDays, formatDate, getPlayerCalendar, getPlayerDay, relativeDay, weekDates, weekStart } from "@club/shared";
import { requireRole } from "@/lib/auth";
import { EmptyState, Notice, PageHeader } from "@/components/ui/card";
import { PrevNext } from "@/components/ui/misc";
import { DayList } from "@/components/player/day-list";
import { NoPlayer } from "@/components/player/no-player";
import { canTickOn, isIsoDate } from "@/components/player/queries";
import { WeekStrip } from "@/components/player/week-strip";
import { getT } from "@/messages";

export const metadata = { title: "Plan" };

function weekLabel(days: string[]): string {
  const first = days[0];
  const last = days[6];
  const sameMonth = first.slice(0, 7) === last.slice(0, 7);
  return `${sameMonth ? Number(first.slice(8)) : formatDate(first, { year: false })} – ${formatDate(last, { year: false })}`;
}

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ zi?: string | string[] }> }) {
  const { db, ctx } = await requireRole("player");
  const t = getT().player.plan;
  if (!ctx.player) return <NoPlayer />;

  const { zi } = await searchParams;
  const selected = isIsoDate(zi) ? zi : ctx.today;
  const days = weekDates(weekStart(selected));
  const href = (d: string) => (d === ctx.today ? "/plan" : `/plan?zi=${d}`);

  const [marks, day] = await Promise.all([
    getPlayerCalendar(db, ctx.player.id, days[0], days[6]),
    getPlayerDay(db, ctx.player.id, selected),
  ]);
  const editable = canTickOn(selected, ctx.today);
  const isToday = selected === ctx.today;
  const hasContent = !!day.plan || day.programs.length > 0;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={t.title} />
      <PrevNext
        prevHref={href(addDays(selected, -7))}
        nextHref={href(addDays(selected, 7))}
        todayHref={isToday ? undefined : "/plan"}
        label={weekLabel(days)}
      />
      <WeekStrip days={days} marks={marks} selected={selected} today={ctx.today} hrefFor={href} />

      <section aria-labelledby="zi-selectata" className="space-y-4 pt-2">
        <h2 id="zi-selectata" className="text-xl first-letter:uppercase">
          {formatDate(selected, { weekday: true, year: false })}
          {Math.abs(diffDays(ctx.today, selected)) <= 1 ? (
            <span className="font-normal text-ink-3"> · {relativeDay(selected, ctx.today)}</span>
          ) : null}
        </h2>
        {hasContent ? (
          <>
            {!editable ? <Notice tone="gray">{selected > ctx.today ? t.readOnlyFuture : t.readOnlyPast}</Notice> : null}
            <DayList key={selected} day={day} editable={editable} upcoming={selected > ctx.today} backHref={href(selected)} />
          </>
        ) : (
          <EmptyState
            icon={<CalendarX className="size-8" aria-hidden />}
            title={isToday ? t.emptyToday : t.emptyDay}
            description={t.emptyHint}
          />
        )}
      </section>
    </div>
  );
}
