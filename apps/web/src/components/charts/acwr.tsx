"use client";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AVAILABILITY_COLORS, AXIS, DataTable, Frame, GRID, SERIES_COLORS, tooltipStyle } from "./index";

type Point = { x: string; load: number | null; ratio: number | null };

/**
 * Încărcarea zilnică (bare) și raportul acut:cronic (linie) pe aceeași axă de timp, în două grafice
 * (unități diferite, deci axe diferite). Banda verde = 0,8–1,3, zona optimă.
 */
export function LoadCharts({ data, loadLabel, ratioLabel, caption, height = 180 }: {
  data: Point[]; loadLabel: string; ratioLabel: string; caption: string; height?: number;
}) {
  const hasLoad = data.some((d) => (d.load ?? 0) > 0);
  const hasRatio = data.some((d) => d.ratio !== null);
  const fmt = (v: unknown) => (typeof v === "number" ? v.toLocaleString("ro-RO", { maximumFractionDigits: 2 }) : "—");
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-ink-2">{loadLabel}</p>
      <Frame height={height} empty={!hasLoad}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -4 }} barCategoryGap="20%">
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="x" {...AXIS} interval="preserveStartEnd" minTickGap={18} />
            <YAxis {...AXIS} width={44} allowDecimals={false} />
            <Tooltip {...tooltipStyle()} formatter={(v) => [fmt(v), loadLabel]} />
            <Bar dataKey="load" name={loadLabel} fill={SERIES_COLORS[0]} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </Frame>
      <p className="pt-2 text-sm font-semibold text-ink-2">{ratioLabel}</p>
      <Frame height={height} empty={!hasRatio}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -4 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <ReferenceArea y1={0.8} y2={1.3} fill={AVAILABILITY_COLORS.full} fillOpacity={0.1} ifOverflow="extendDomain" />
            <ReferenceLine y={1.5} stroke={AVAILABILITY_COLORS.out} strokeDasharray="4 4" />
            <XAxis dataKey="x" {...AXIS} interval="preserveStartEnd" minTickGap={18} />
            <YAxis {...AXIS} width={44} domain={[0, (max: number) => Math.max(2, Math.ceil(max * 10) / 10)]} tickFormatter={(v) => fmt(v)} />
            <Tooltip {...tooltipStyle()} formatter={(v) => [fmt(v), ratioLabel]} />
            <Line type="monotone" dataKey="ratio" name={ratioLabel} stroke={SERIES_COLORS[1]} strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </Frame>
      <DataTable data={data} xKey="x" series={[{ key: "load", label: loadLabel }, { key: "ratio", label: ratioLabel }]} caption={caption} />
      <p className="text-sm text-ink-3">{caption}</p>
    </div>
  );
}

/** Mini-grafic pentru tabele (greutate, încărcare): o linie, fără axe. */
export function Sparkline({ values, label, width = 96, height = 28 }: { values: number[]; label: string; width?: number; height?: number }) {
  if (values.length < 2) return <span className="text-sm text-ink-3">—</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * (width - 4) + 2).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="shrink-0">
      <polyline points={pts} fill="none" stroke={SERIES_COLORS[0]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
