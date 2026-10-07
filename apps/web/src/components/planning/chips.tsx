"use client";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

/** Selecție multiplă cu butoane mari (zone, echipament, zilele săptămânii). */
export function ChipToggles<T extends string | number>({ label, options, value, onChange, className, compact }: {
  label: string;
  options: Array<{ value: T; label: string; title?: string }>;
  value: T[];
  onChange: (value: T[]) => void;
  className?: string;
  /** butoane de lățime egală, fără bifă (zilele săptămânii) */
  compact?: boolean;
}) {
  const toggle = (v: T) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div role="group" aria-label={label} className={cn(compact ? "grid grid-cols-7 gap-1" : "flex flex-wrap gap-2", className)}>
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={on}
            title={o.title}
            onClick={() => toggle(o.value)}
            className={cn(
              "inline-flex h-12 items-center justify-center gap-1.5 rounded-[var(--radius-control)] border font-semibold",
              compact ? "px-0" : "px-3",
              on ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-ink hover:bg-canvas",
            )}
          >
            {on && !compact ? <Check className="size-4" strokeWidth={3} aria-hidden /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
