import Link from "next/link";
import { WEEKDAYS_RO, WEEKDAYS_SHORT_RO, formatDate, isoWeekday } from "@club/shared";
import { cn } from "@/lib/cn";
import { getT } from "@/messages";

export type WeekMarks = Record<string, { plan: boolean; programs: number }>;

/**
 * Săptămâna luni–duminică, cu marcaje: punct plin = plan personalizat, inel = program.
 * Fiecare zi este un link (`?zi=`), deci „înapoi" și linkurile din notificări funcționează.
 */
export function WeekStrip({ days, marks, selected, today, hrefFor }: {
  days: string[]; marks: WeekMarks; selected: string; today: string; hrefFor: (day: string) => string;
}) {
  const t = getT().player.plan;
  return (
    <div>
      <ul className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const m = marks[d] ?? { plan: false, programs: 0 };
          const isSelected = d === selected;
          const isToday = d === today;
          const wd = isoWeekday(d) - 1;
          const what = [m.plan ? t.markPlan : null, m.programs ? t.markPrograms(m.programs) : null].filter(Boolean).join(", ") || t.markNothing;
          return (
            <li key={d}>
              <Link
                href={hrefFor(d)}
                scroll={false}
                aria-current={isSelected ? "date" : undefined}
                aria-label={`${WEEKDAYS_RO[wd]}, ${formatDate(d, { year: false })}${isToday ? ` (${t.todayTag})` : ""}: ${what}`}
                className={cn(
                  "flex h-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-lg border",
                  isSelected ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface text-ink active:bg-sunken",
                  isToday && !isSelected && "border-2 border-ink",
                )}
              >
                <span className={cn("text-xs font-semibold", isSelected ? "opacity-90" : "text-ink-3")}>{WEEKDAYS_SHORT_RO[wd]}</span>
                <span className="text-lg font-bold leading-none">{Number(d.slice(8))}</span>
                <span className="flex h-2.5 items-center gap-1" aria-hidden>
                  {m.plan ? <span className={cn("size-2.5 rounded-full", isSelected ? "bg-brand-ink" : "bg-ink")} /> : null}
                  {m.programs ? <span className={cn("size-2.5 rounded-full border-2", isSelected ? "border-brand-ink" : "border-ink")} /> : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-ink" aria-hidden /> {t.legendPlan}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border-2 border-ink" aria-hidden /> {t.legendProgram}
        </span>
      </p>
    </div>
  );
}
