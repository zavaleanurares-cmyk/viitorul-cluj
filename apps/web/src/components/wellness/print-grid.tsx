import { Fragment } from "react";
import { WEEKDAYS_RO, formatDateShort, isoWeekday, type WellnessEntry } from "@club/shared";
import { cn } from "@/lib/cn";
import { getT } from "@/messages";
import { hasPain, painShort } from "./domain";

/** Grila de tipărit: ca tabelul clubului — pentru fiecare zi oboseală, încărcătură, zonă; alb-negru lizibil. */
export function PrintGrid({ players, dates, entries, thresholds }: {
  players: Array<{ id: string; name: string }>; dates: string[]; entries: WellnessEntry[]; thresholds: { fatigue: number; muscle: number };
}) {
  const t = getT().wellness.print;
  const byKey = new Map(entries.map((e) => [`${e.player_id}:${e.entry_date}`, e]));
  const cell = "border border-ink/40 px-1 py-0.5";
  const num = (v: number | null | undefined, thr: number) =>
    v === null || v === undefined ? "" : <span className={cn(v >= thr && "font-bold underline")}>{v}</span>;
  return (
    <table className="hidden w-full border-collapse text-left text-[9pt] leading-tight print:table">
      <thead>
        <tr>
          <th scope="col" rowSpan={2} className={cn(cell, "w-6 text-right")}>#</th>
          <th scope="col" rowSpan={2} className={cell}>{t.player}</th>
          {dates.map((d) => (
            <th key={d} scope="colgroup" colSpan={3} className={cn(cell, "text-center")}>
              {WEEKDAYS_RO[isoWeekday(d) - 1]} {formatDateShort(d, false)}
            </th>
          ))}
        </tr>
        <tr>
          {dates.map((d) => (
            <Fragment key={d}>
              <th scope="col" className={cn(cell, "w-6 text-center")}>{t.fatigueAbbr}</th>
              <th scope="col" className={cn(cell, "w-6 text-center")}>{t.muscleAbbr}</th>
              <th scope="col" className={cell}>{t.zone}</th>
            </Fragment>
          ))}
        </tr>
      </thead>
      <tbody>
        {players.map((p, i) => (
          <tr key={p.id} className="break-inside-avoid">
            <td className={cn(cell, "text-right")}>{i + 1}</td>
            <th scope="row" className={cn(cell, "font-bold whitespace-nowrap")}>{p.name}</th>
            {dates.map((d) => {
              const e = byKey.get(`${p.id}:${d}`);
              return (
                <Fragment key={d}>
                  <td className={cn(cell, "text-center")}>{num(e?.fatigue, thresholds.fatigue)}</td>
                  <td className={cn(cell, "text-center")}>{num(e?.muscle_load, thresholds.muscle)}</td>
                  <td className={cell}>
                    {e && hasPain(e) ? `${painShort(e)}${e.pain_intensity ? ` ${e.pain_intensity}/10` : ""}` : ""}
                    {e?.needs_review ? ` (${t.toReview})` : ""}
                  </td>
                </Fragment>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
