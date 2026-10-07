import { Check, Contrast, TriangleAlert, X } from "lucide-react";
import { formatDate } from "@club/shared";
import { cn } from "@/lib/cn";
import type { DayState } from "./adherence";

const STYLE: Record<DayState, string> = {
  full: "bg-st-green text-white",
  partial: "bg-st-yellow text-ink",
  none: "border border-st-red bg-st-red-soft text-st-red",
};

export function DayStateIcon({ state, className }: { state: DayState; className?: string }) {
  const Icon = state === "full" ? Check : state === "partial" ? Contrast : X;
  return <Icon className={cn("size-4", className)} strokeWidth={3} aria-hidden />;
}

/** Un pătrat de stare: culoare + simbol (✓ integral, cerc pe jumătate = parțial, ✕ deloc). */
export function DayStateMark({ state, title, className }: { state: DayState; title: string; className?: string }) {
  return (
    <span title={title} className={cn("inline-flex size-6 shrink-0 items-center justify-center rounded", STYLE[state], className)}>
      <DayStateIcon state={state} className="size-3.5" />
      <span className="sr-only">{title}</span>
    </span>
  );
}

/** Banda compactă cu ultimele zile programate ale unei alocări, cea mai veche prima. */
export function DayStrip({ days, total, labels, empty }: {
  days: Array<{ date: string; done: number; state: DayState }>;
  total: number;
  labels: Record<DayState, string>;
  empty: string;
}) {
  if (!days.length) return <span className="text-sm text-ink-3">{empty}</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {days.map((d) => (
        <DayStateMark key={d.date} state={d.state} title={`${formatDate(d.date, { year: false })}: ${labels[d.state]} (${d.done}/${total})`} />
      ))}
    </span>
  );
}

export function PainFlag({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md bg-st-red-soft px-1.5 py-0.5 text-sm font-semibold text-ink", className)}>
      <TriangleAlert className="size-4 text-st-red" aria-hidden />{text}
    </span>
  );
}
