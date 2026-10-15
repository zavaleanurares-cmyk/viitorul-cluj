"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { WEEKDAYS_RO, WEEKDAYS_SHORT_RO, average, formatDate, formatDateShort, isoWeekday, type WellnessEntry } from "@club/shared";
import { TableWrap } from "@/components/ui/misc";
import { ScoreCell } from "@/components/ui/scale";
import { cn } from "@/lib/cn";
import { useT } from "@/messages";
import { fmt1, hasPain, painFull, painShort, type Thresholds } from "./domain";
import { EntryDialog } from "./entry-dialog";

export type GridPlayer = { id: string; name: string };

/**
 * Grila săptămânală: jucătorii pe rânduri, zilele luni–duminică pe coloane; în fiecare celulă
 * oboseala (O), încărcătura musculară (Î) și, dedesubt, zona dureroasă. Celulă goală = necompletat.
 * Pentru preparator fiecare celulă este un buton care deschide corectarea / introducerea.
 */
export function WeekGrid({ players, dates, entries, today, thresholds, canEdit }: {
  players: GridPlayer[]; dates: string[]; entries: WellnessEntry[]; today: string; thresholds: Thresholds; canEdit: boolean;
}) {
  const t = useT().wellness.grid;
  const [editing, setEditing] = useState<{ player: GridPlayer; date: string } | null>(null);
  const byKey = useMemo(() => new Map(entries.map((e) => [`${e.player_id}:${e.entry_date}`, e])), [entries]);
  const ids = useMemo(() => new Set(players.map((p) => p.id)), [players]);

  const dayAverages = dates.map((d) => {
    const day = entries.filter((e) => e.entry_date === d && ids.has(e.player_id));
    return { fatigue: average(day.map((e) => e.fatigue)), muscle: average(day.map((e) => e.muscle_load)) };
  });

  const sticky = "sticky left-0 z-10 border-r border-line";

  return (
    <>
      <TableWrap>
        <caption className="sr-only">{t.caption}</caption>
        <thead>
          <tr>
            <th scope="col" className={cn(sticky, "min-w-28 max-w-36 bg-canvas px-2! md:min-w-40 md:max-w-none md:px-3!")}>{t.player}</th>
            {dates.map((d) => (
              <th
                key={d}
                scope="col"
                aria-current={d === today ? "date" : undefined}
                className={cn("min-w-[5.25rem] px-1! text-center", d === today && "border-b-[3px] border-brand text-ink!")}
              >
                <span title={WEEKDAYS_RO[isoWeekday(d) - 1]}>{WEEKDAYS_SHORT_RO[isoWeekday(d) - 1]}</span>{" "}
                <span className="font-normal">{formatDateShort(d, false)}</span>
                <span className="mt-0.5 flex justify-center gap-1 text-2xs font-normal" aria-hidden>
                  <span className="w-8">{t.fatigueAbbr}</span>
                  <span className="w-8">{t.muscleAbbr}</span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.id}>
              <th scope="row" className={cn(sticky, "min-w-28 max-w-36 bg-surface px-2! py-1! border-t border-line text-base! font-semibold! text-ink! md:max-w-none md:px-3!")}>
                <Link href={`/lot/jucatori/${p.id}/wellness`} className="block truncate hover:underline" title={p.name}>{p.name}</Link>
              </th>
              {dates.map((d) => {
                const e = byKey.get(`${p.id}:${d}`) ?? null;
                const future = d > today;
                const content = <Cell entry={e} thresholds={thresholds} future={future} />;
                const label = `${p.name}, ${formatDate(d, { weekday: true, year: false })}: ${describe(e, t)}`;
                return (
                  <td key={d} className={cn("p-0! text-center align-top", e?.needs_review && "bg-st-orange-soft")}>
                    {canEdit && !future ? (
                      <button
                        type="button"
                        onClick={() => setEditing({ player: p, date: d })}
                        aria-label={`${label}. ${e ? t.editCell : t.addCell}`}
                        className="block min-h-11 w-full px-1 py-1.5 hover:bg-canvas active:bg-sunken"
                      >
                        {content}
                      </button>
                    ) : (
                      <div className="min-h-11 px-1 py-1.5" aria-label={label} role="group">{content}</div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className={cn(sticky, "bg-canvas px-2! md:px-3!")}>{t.groupAverage}</th>
            {dayAverages.map((a, i) => (
              <td key={dates[i]} className="bg-canvas px-1! text-center text-sm font-semibold">
                <span className="flex justify-center gap-1">
                  <span className="w-8">{a.fatigue === null ? "" : fmt1(a.fatigue)}</span>
                  <span className="w-8">{a.muscle === null ? "" : fmt1(a.muscle)}</span>
                </span>
              </td>
            ))}
          </tr>
        </tfoot>
      </TableWrap>
      {editing ? (
        <EntryDialog
          key={`${editing.player.id}:${editing.date}`}
          open
          onClose={() => setEditing(null)}
          player={editing.player}
          date={editing.date}
          entry={byKey.get(`${editing.player.id}:${editing.date}`) ?? null}
          today={today}
        />
      ) : null}
    </>
  );
}

type GridTexts = ReturnType<typeof useT>["wellness"]["grid"];

function describe(e: WellnessEntry | null, t: GridTexts): string {
  if (!e) return t.notFilled;
  const parts = [
    e.fatigue !== null ? t.fatigueValue(e.fatigue) : null,
    e.muscle_load !== null ? t.muscleValue(e.muscle_load) : null,
    hasPain(e) ? t.painValue(painFull(e) || painShort(e), e.pain_intensity) : null,
    e.needs_review ? t.toReview : null,
  ].filter(Boolean);
  return parts.join(", ") || t.notFilled;
}

function Cell({ entry: e, thresholds, future }: { entry: WellnessEntry | null; thresholds: Thresholds; future: boolean }) {
  if (!e) return <span className="flex h-8 items-center justify-center text-ink-3" aria-hidden>{future ? "" : "·"}</span>;
  const pain = hasPain(e);
  return (
    <span className="relative block">
      <span className="flex justify-center gap-1">
        <ScoreCell value={e.fatigue} threshold={thresholds.fatigue} />
        <ScoreCell value={e.muscle_load} threshold={thresholds.muscle} />
      </span>
      {pain ? (
        <span className="mx-auto mt-0.5 block max-w-[5.5rem] text-xs leading-tight font-semibold text-ink [overflow-wrap:anywhere]" title={painFull(e) || undefined}>
          {painShort(e)}
          {e.pain_intensity ? <span className="font-normal text-ink-2"> {e.pain_intensity}/10</span> : null}
        </span>
      ) : null}
      {e.needs_review ? (
        <TriangleAlert className="absolute -top-1 right-0 size-4 text-ink" strokeWidth={2.5} aria-hidden>
          <title>{e.review_note ?? ""}</title>
        </TriangleAlert>
      ) : null}
    </span>
  );
}
