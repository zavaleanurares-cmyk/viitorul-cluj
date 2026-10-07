import Link from "next/link";
import { WEEKDAYS_SHORT_RO, formatDateShort, isoWeekday } from "@club/shared";
import { TableWrap } from "@/components/ui/misc";
import { getT } from "@/messages";
import type { RpeEntry } from "./queries";

const nf = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 });

/** Încărcarea internă a săptămânii: jucător × zi, sRPE = RPE × minute, cu totalul săptămânii. */
export function RpeTable({ players, dates, rpe }: { players: Array<{ id: string; name: string }>; dates: string[]; rpe: RpeEntry[] }) {
  const t = getT().wellness.rpe;
  const cell = new Map<string, { load: number; parts: string[] }>();
  for (const r of rpe) {
    const k = `${r.player_id}:${r.entry_date}`;
    const c = cell.get(k) ?? { load: 0, parts: [] };
    c.load += r.load ?? r.rpe * r.duration_min;
    c.parts.push(t.detail(r.rpe, r.duration_min));
    cell.set(k, c);
  }
  const rows = players.map((p) => {
    const days = dates.map((d) => cell.get(`${p.id}:${d}`) ?? null);
    return { ...p, days, total: days.reduce((s, c) => s + (c?.load ?? 0), 0) };
  });
  const withData = rows.filter((r) => r.total > 0);
  const dayMeans = dates.map((_, i) => {
    const v = rows.map((r) => r.days[i]?.load).filter((x): x is number => typeof x === "number");
    return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null;
  });
  const totalMean = withData.length ? Math.round(withData.reduce((s, r) => s + r.total, 0) / withData.length) : null;

  return (
    <TableWrap>
      <caption className="sr-only">{t.caption}</caption>
      <thead>
        <tr>
          <th scope="col" className="sticky left-0 z-10 min-w-28 max-w-36 border-r border-line bg-canvas px-2! md:max-w-none md:px-3!">{t.player}</th>
          {dates.map((d) => (
            <th key={d} scope="col" className="px-2! text-right whitespace-nowrap">
              {WEEKDAYS_SHORT_RO[isoWeekday(d) - 1]} <span className="font-normal">{formatDateShort(d, false)}</span>
            </th>
          ))}
          <th scope="col" className="px-3! text-right text-ink!">{t.total}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <th scope="row" className="sticky left-0 z-10 min-w-28 max-w-36 border-r border-line bg-surface px-2! py-1.5! border-t border-line text-base! font-semibold! text-ink! md:max-w-none md:px-3!">
              <Link href={`/jucatori/${r.id}/wellness`} className="block truncate hover:underline" title={r.name}>{r.name}</Link>
            </th>
            {r.days.map((c, i) => (
              <td key={dates[i]} className="px-2! py-1.5! text-right" title={c ? c.parts.join(" + ") : undefined}>
                {c ? nf.format(c.load) : <span className="text-ink-3">·</span>}
              </td>
            ))}
            <td className="px-3! py-1.5! text-right font-bold">{r.total ? nf.format(r.total) : <span className="font-normal text-ink-3">·</span>}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row" className="sticky left-0 z-10 border-r border-line bg-canvas px-2! md:px-3!">{t.groupAverage}</th>
          {dayMeans.map((m, i) => (
            <td key={dates[i]} className="bg-canvas px-2! text-right text-sm font-semibold">{m === null ? "" : nf.format(m)}</td>
          ))}
          <td className="bg-canvas px-3! text-right text-sm font-bold">{totalMean === null ? "" : nf.format(totalMean)}</td>
        </tr>
      </tfoot>
    </TableWrap>
  );
}
