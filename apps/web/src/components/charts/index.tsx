"use client";
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { ReactNode } from "react";

/**
 * Grafice comune. Reguli:
 *  - culorile de serie vin din paleta categorială de mai jos, în ordine fixă (verificată pentru daltonism);
 *  - culorile de stare (verde / portocaliu / roșu) se folosesc DOAR pentru disponibilitate și praguri;
 *  - o singură axă Y; legendă doar de la două serii în sus; textul rămâne în culorile de text;
 *  - fiecare grafic are și un tabel echivalent pentru cititoarele de ecran.
 */
export const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"] as const;
export const AVAILABILITY_COLORS = { full: "#1b7a3d", limited: "#ef8a1d", out: "#c3281c" } as const;

export const AXIS = { stroke: "#a9b3bf", tick: { fill: "#596575", fontSize: 12 }, tickLine: false } as const;
export const GRID = "#e3e7ec";

export type Series = { key: string; label: string; color?: string };
export type Row = Record<string, string | number | null | undefined>;

export function tooltipStyle() {
  return {
    contentStyle: { background: "#fff", border: "1px solid #a9b3bf", borderRadius: 8, color: "#0e1726", fontSize: 14, padding: "8px 10px" },
    labelStyle: { fontWeight: 700, marginBottom: 4 },
    itemStyle: { color: "#0e1726" },
    cursor: { stroke: "#a9b3bf", strokeWidth: 1 },
  };
}

export function DataTable({ data, xKey, series, caption }: { data: Row[]; xKey: string; series: Series[]; caption: string }) {
  return (
    <div className="sr-only">
    <table>
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">{xKey}</th>
          {series.map((s) => <th key={s.key} scope="col">{s.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {data.map((r, i) => (
          <tr key={i}>
            <th scope="row">{String(r[xKey] ?? "")}</th>
            {series.map((s) => <td key={s.key}>{r[s.key] ?? "—"}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

export function Frame({ height, children, empty }: { height: number; children: ReactNode; empty?: boolean }) {
  if (empty) {
    return <div className="flex items-center justify-center rounded-lg bg-canvas text-ink-3" style={{ height }}>Încă nu există date.</div>;
  }
  return <div style={{ height }} className="w-full">{children}</div>;
}

/** Evoluție în timp: una sau mai multe serii pe aceeași scară. */
export function TrendChart({ data, xKey = "x", series, caption, height = 220, domain, threshold, connectNulls = false }: {
  data: Row[]; xKey?: string; series: Series[]; caption: string; height?: number;
  domain?: [number, number]; threshold?: { value: number; label: string }; connectNulls?: boolean;
}) {
  const has = data.some((r) => series.some((s) => typeof r[s.key] === "number"));
  return (
    <>
      <Frame height={height} empty={!has}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -4 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey={xKey} {...AXIS} minTickGap={24} />
            <YAxis {...AXIS} axisLine={false} domain={domain ?? ["auto", "auto"]} allowDecimals={false} width={48} />
            <Tooltip {...tooltipStyle()} />
            {series.length > 1 ? <Legend iconType="plainline" wrapperStyle={{ fontSize: 13, color: "#36414f" }} formatter={(v) => <span style={{ color: "#36414f" }}>{v}</span>} /> : null}
            {threshold ? (
              <ReferenceLine y={threshold.value} stroke="#c3281c" strokeWidth={1} label={{ value: threshold.label, position: "insideTopRight", fill: "#596575", fontSize: 12 }} />
            ) : null}
            {series.map((s, i) => (
              <Line
                key={s.key} type="monotone" dataKey={s.key} name={s.label}
                stroke={s.color ?? SERIES_COLORS[i % SERIES_COLORS.length]} strokeWidth={2}
                dot={{ r: 3.5, strokeWidth: 2, stroke: "#fff", fill: s.color ?? SERIES_COLORS[i % SERIES_COLORS.length] }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }} connectNulls={connectNulls} isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </Frame>
      <DataTable data={data} xKey={xKey} series={series} caption={caption} />
    </>
  );
}

/** Bare simple pentru comparații între categorii (o singură serie). */
export function BarsChart({ data, xKey = "x", valueKey = "value", label, caption, height = 220, color = SERIES_COLORS[0], horizontal, colors }: {
  data: Row[]; xKey?: string; valueKey?: string; label: string; caption: string; height?: number; color?: string;
  horizontal?: boolean; colors?: string[];
}) {
  const has = data.some((r) => typeof r[valueKey] === "number" && (r[valueKey] as number) > 0);
  const series = [{ key: valueKey, label }];
  return (
    <>
      <Frame height={horizontal ? Math.max(height, data.length * 34 + 24) : height} empty={!has}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={horizontal ? { top: 0, right: 36, bottom: 0, left: 8 } : { top: 20, right: 8, bottom: 0, left: -4 }} barCategoryGap="28%">
            <CartesianGrid stroke={GRID} vertical={!!horizontal} horizontal={!horizontal} />
            {horizontal ? (
              <>
                <XAxis type="number" {...AXIS} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey={xKey} {...AXIS} width={120} tick={{ fill: "#36414f", fontSize: 13 }} />
              </>
            ) : (
              <>
                <XAxis dataKey={xKey} {...AXIS} interval={0} />
                <YAxis {...AXIS} axisLine={false} allowDecimals={false} width={48} />
              </>
            )}
            <Tooltip {...tooltipStyle()} cursor={{ fill: "#f2f4f6" }} />
            <Bar dataKey={valueKey} name={label} fill={color} maxBarSize={24} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} isAnimationActive={false}>
              {colors ? data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />) : null}
              <LabelList dataKey={valueKey} position={horizontal ? "right" : "top"} fill="#0e1726" fontSize={12} fontWeight={700} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Frame>
      <DataTable data={data} xKey={xKey} series={series} caption={caption} />
    </>
  );
}

/** Bare stivuite — folosite pentru disponibilitate (disponibil / parțial / indisponibil). */
export function StackedBarsChart({ data, xKey = "x", series, caption, height = 240 }: {
  data: Row[]; xKey?: string; series: Series[]; caption: string; height?: number;
}) {
  const has = data.some((r) => series.some((s) => typeof r[s.key] === "number" && (r[s.key] as number) > 0));
  return (
    <>
      <Frame height={height} empty={!has}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -4 }} barCategoryGap="30%">
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey={xKey} {...AXIS} minTickGap={8} />
            <YAxis {...AXIS} axisLine={false} allowDecimals={false} width={48} />
            <Tooltip {...tooltipStyle()} cursor={{ fill: "#f2f4f6" }} />
            <Legend iconType="square" wrapperStyle={{ fontSize: 13 }} formatter={(v) => <span style={{ color: "#36414f" }}>{v}</span>} />
            {series.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={s.color ?? SERIES_COLORS[i % SERIES_COLORS.length]}
                maxBarSize={28} stroke="#fff" strokeWidth={2} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Frame>
      <DataTable data={data} xKey={xKey} series={series} caption={caption} />
    </>
  );
}

/** Linie mică, fără axe, lângă o cifră. */
export function Sparkline({ values, color = "#596575", width = 96, height = 28, label }: { values: Array<number | null>; color?: string; width?: number; height?: number; label: string }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => typeof p.v === "number");
  if (pts.length < 2) return <span className="text-sm text-ink-3">—</span>;
  const min = Math.min(...pts.map((p) => p.v));
  const max = Math.max(...pts.map((p) => p.v));
  const x = (i: number) => (i / (values.length - 1)) * (width - 6) + 3;
  const y = (v: number) => height - 4 - ((v - min) / (max - min || 1)) * (height - 8);
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} role="img" aria-label={label}>
      <polyline fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={pts.map((p) => `${x(p.i)},${y(p.v)}`).join(" ")} />
      <circle cx={x(last.i)} cy={y(last.v)} r={3.5} fill={color} stroke="#fff" strokeWidth={1.5} />
    </svg>
  );
}
