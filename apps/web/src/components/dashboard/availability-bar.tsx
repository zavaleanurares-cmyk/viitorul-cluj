"use client";
// componentă client doar ca să poată citi AVAILABILITY_COLORS din modulul (client) de grafice
import { AVAILABILITY_COLORS } from "@/components/charts";
import { cn } from "@/lib/cn";

type Counts = { full: number; limited: number; out: number };
const ORDER = ["full", "limited", "out"] as const;

/**
 * Bară orizontală stivuită: disponibili / parțial / indisponibili.
 * Segmentele sunt despărțite de un spațiu de 2 px; cifrele stau scrise lângă bară (vezi `AvailabilityLegend`),
 * niciodată doar în culoare.
 */
export function AvailabilityBar({ counts, label, titles, className }: {
  counts: Counts; label: string; titles?: Record<keyof Counts, string>; className?: string;
}) {
  const total = counts.full + counts.limited + counts.out;
  return (
    <div role="img" aria-label={label} className={cn("flex h-4 w-full gap-0.5 overflow-hidden rounded-[4px]", className)}>
      {total === 0 ? <span className="flex-1 bg-sunken" /> : null}
      {ORDER.filter((k) => counts[k] > 0).map((k) => (
        <span key={k} title={titles ? `${counts[k]} ${titles[k]}` : undefined} className="min-w-1.5 [print-color-adjust:exact]" style={{ flexGrow: counts[k], flexBasis: 0, background: AVAILABILITY_COLORS[k] }} />
      ))}
    </div>
  );
}

/** Cifrele barei, cu pătrat de culoare + text. */
export function AvailabilityLegend({ items, className }: {
  items: Array<{ key: keyof Counts; value: number; label: string; extra?: string }>; className?: string;
}) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2", className)}>
      {items.map((it) => (
        <li key={it.key} className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span aria-hidden className="size-3 shrink-0 rounded-[3px] [print-color-adjust:exact]" style={{ background: AVAILABILITY_COLORS[it.key] }} />
          <span><strong className="font-bold text-ink">{it.value}</strong> {it.label}{it.extra ? <span className="text-ink-3"> · {it.extra}</span> : null}</span>
        </li>
      ))}
    </ul>
  );
}
