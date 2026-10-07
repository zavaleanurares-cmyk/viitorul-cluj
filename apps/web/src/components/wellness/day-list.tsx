import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import type { WellnessEntry } from "@club/shared";
import { ReviewBadge } from "@/components/ui/status";
import { ScoreCell } from "@/components/ui/scale";
import { getT } from "@/messages";
import { hasPain, painFull, painShort, type Thresholds } from "./domain";
import { EntryButton } from "./entry-button";

export type DayPlayer = { id: string; name: string; hasAccount: boolean };

/** Vederea „pe zi": lista jucătorilor cu cele trei valori ale zilei (implicită pe telefon). */
export function DayList({ players, entries, date, today, thresholds, canEdit }: {
  players: DayPlayer[]; entries: WellnessEntry[]; date: string; today: string; thresholds: Thresholds; canEdit: boolean;
}) {
  const t = getT().wellness.day;
  const byPlayer = new Map(entries.filter((e) => e.entry_date === date).map((e) => [e.player_id, e]));
  const future = date > today;
  return (
    <div className="-mx-4 border-y border-line bg-surface md:mx-0 md:rounded-[var(--radius-card)] md:border">
      <div className="flex items-center gap-3 bg-canvas px-4 py-2 text-sm font-semibold text-ink-3 md:rounded-t-[var(--radius-card)]" aria-hidden>
        <span className="min-w-0 flex-1">{t.player}</span>
        <span className="w-8 text-center" title={t.fatigue}>{t.fatigueAbbr}</span>
        <span className="w-8 text-center" title={t.muscleLoad}>{t.muscleAbbr}</span>
        {canEdit ? <span className="w-12" /> : null}
      </div>
      <ul className="divide-y divide-line">
        {players.map((p) => {
          const e = byPlayer.get(p.id) ?? null;
          const pain = e && hasPain(e);
          return (
            <li key={p.id} className="flex items-center gap-3 px-4 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2">
                  <Link href={`/jucatori/${p.id}/wellness`} className="truncate font-semibold hover:underline">{p.name}</Link>
                  {e?.needs_review ? <ReviewBadge note={e.review_note} /> : null}
                </p>
                {pain ? (
                  <p className="text-sm font-semibold">
                    <span className="font-normal text-ink-3">{t.pain}: </span>
                    {painFull(e) || painShort(e)}
                    {e.pain_intensity ? `, ${e.pain_intensity}/10` : ""}
                    {e.pain_zone && e.pain_note ? <span className="font-normal text-ink-2"> — {e.pain_note}</span> : null}
                  </p>
                ) : !e ? (
                  <p className="text-sm text-ink-3">{future ? "" : p.hasAccount ? t.notFilled : t.notFilledNoAccount}</p>
                ) : null}
              </div>
              <span className="flex w-8 justify-center"><span className="sr-only">{t.fatigue}: </span><ScoreCell value={e?.fatigue} threshold={thresholds.fatigue} /></span>
              <span className="flex w-8 justify-center"><span className="sr-only">{t.muscleLoad}: </span><ScoreCell value={e?.muscle_load} threshold={thresholds.muscle} /></span>
              {canEdit ? (
                future ? <span className="w-12" /> : (
                  <EntryButton
                    iconOnly
                    player={p}
                    date={date}
                    entry={e}
                    today={today}
                    label={e ? t.edit(p.name) : t.add(p.name)}
                    icon={e ? <Pencil className="size-5" aria-hidden /> : <Plus className="size-5" aria-hidden />}
                  />
                )
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
