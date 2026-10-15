"use client";
import { MONTHS_RO, WEEKDAYS_RO, WEEKDAYS_SHORT_RO, addDays, formatDate, weekDates } from "@club/shared";
import { cn } from "@/lib/cn";

/** Mini-calendar pe câteva săptămâni, cu zile care se bifează (copierea unui plan pe alte zile). */
export function DayPicker({ start, weeks = 3, value, onChange, today, disabledDay, disabledLabel, marks, markLabel, label }: {
  /** lunea primei săptămâni afișate */
  start: string;
  weeks?: number;
  value: string[];
  onChange: (days: string[]) => void;
  today: string;
  /** zi care nu poate fi aleasă (ziua planului-sursă) */
  disabledDay?: string | null;
  disabledLabel?: string;
  /** zile marcate cu punct (au deja plan) */
  marks?: Set<string>;
  markLabel?: string;
  label: string;
}) {
  const rows = Array.from({ length: weeks }, (_, w) => weekDates(addDays(start, w * 7)));
  const toggle = (d: string) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort());
  return (
    <div role="group" aria-label={label}>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-ink-3" aria-hidden>
        {WEEKDAYS_SHORT_RO.map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="mt-1 space-y-1">
        {rows.map((days) => (
          <div key={days[0]} className="grid grid-cols-7 gap-1">
            {days.map((d, i) => {
              const on = value.includes(d);
              const off = d === disabledDay;
              const day = Number(d.slice(8));
              const month = MONTHS_RO[Number(d.slice(5, 7)) - 1].slice(0, 3);
              const marked = marks?.has(d);
              const name = `${WEEKDAYS_RO[i]}, ${formatDate(d, { year: false })}${off && disabledLabel ? ` (${disabledLabel})` : ""}${marked && markLabel ? ` (${markLabel})` : ""}`;
              return (
                <button
                  key={d}
                  type="button"
                  disabled={off}
                  aria-pressed={on}
                  aria-label={name}
                  title={name}
                  onClick={() => toggle(d)}
                  className={cn(
                    "relative flex h-12 flex-col items-center justify-center rounded-[var(--radius-control)] font-semibold leading-none",
                    off ? "border border-dashed border-line bg-sunken text-ink-3"
                      : on ? "border border-brand bg-brand text-brand-ink"
                      : d === today ? "border-2 border-ink bg-surface hover:bg-canvas"
                      : "border border-line-strong bg-surface hover:bg-canvas",
                  )}
                >
                  <span>{day}</span>
                  <span className={cn("mt-0.5 text-2xs font-normal", on ? "text-white" : "text-ink-3")}>{month}</span>
                  {marked ? <span className={cn("absolute right-1 top-1 size-1.5 rounded-full", on ? "bg-white" : "bg-ink")} aria-hidden /> : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
