"use client";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatLei } from "@club/shared";
import { SERIES_COLORS } from "@/components/charts";

const AXIS = { stroke: "#a9b3bf", tick: { fill: "#596575", fontSize: 12 }, tickLine: false } as const;

export type MoneyChartRow = { label: string; [key: string]: string | number | null };
export type MoneySeries = { key: string; label: string; kind: "bar" | "line"; color?: string };

/**
 * Bani pe luni: bare grupate (ex. emis / încasat) și, opțional, o linie (ex. bani intrați în lună).
 * Sumele vin în bani; axa și eticheta arată lei. Are și tabel echivalent pentru cititoarele de ecran.
 */
export function MoneyChart({ data, series, caption, height = 260 }: { data: MoneyChartRow[]; series: MoneySeries[]; caption: string; height?: number }) {
  const colors = ["#c9d1da", SERIES_COLORS[0], SERIES_COLORS[1], SERIES_COLORS[2]];
  // null = lună viitoare / fără date: nu se desenează (linia nu coboară la zero)
  const shown = data.map((r) => ({ ...r, ...Object.fromEntries(series.map((s) => [s.key, r[s.key] === null ? null : Math.round(Number(r[s.key] ?? 0)) / 100])) }));
  return (
    <figure>
      <div style={{ height }} className="w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={shown} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#e3e7ec" vertical={false} />
            <XAxis dataKey="label" {...AXIS} />
            <YAxis {...AXIS} width={64} tickFormatter={(v: number) => formatLei(v * 100, { currency: false })} />
            <Tooltip formatter={(v) => formatLei(Number(v) * 100)}
              contentStyle={{ background: "#fff", border: "1px solid #a9b3bf", borderRadius: 8, color: "#0e1726", fontSize: 14 }} />
            <Legend wrapperStyle={{ fontSize: 13, color: "#36414f" }} />
            {series.map((s, i) => s.kind === "bar"
              ? <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color ?? colors[i]} radius={[3, 3, 0, 0]} maxBarSize={28} />
              : <Line key={s.key} dataKey={s.key} name={s.label} stroke={s.color ?? SERIES_COLORS[1]} strokeWidth={2.5} dot={{ r: 3 }} type="linear" connectNulls={false} />)}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">{caption}</figcaption>
      {/* tabelul ignoră lățimea de 1px a lui sr-only și ar lărgi pagina pe telefon; îl închidem într-un bloc */}
      <div className="sr-only"><table>
        <caption>{caption}</caption>
        <thead><tr><th scope="col">Luna</th>{series.map((s) => <th key={s.key} scope="col">{s.label}</th>)}</tr></thead>
        <tbody>{data.map((r) => <tr key={r.label}><th scope="row">{r.label}</th>{series.map((s) => <td key={s.key}>{r[s.key] === null ? "—" : formatLei(Number(r[s.key] ?? 0))}</td>)}</tr>)}</tbody>
      </table></div>
    </figure>
  );
}
