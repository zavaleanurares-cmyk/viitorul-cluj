import Link from "next/link";
import { cn } from "@/lib/cn";

/** Alegerea intervalului (7 / 28 / 90 de zile etc.) prin linkuri: starea stă în URL. */
export function IntervalNav({ label, options, current, className }: {
  label: string; options: Array<{ value: string; label: string; href: string }>; current: string; className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("no-print flex gap-2", className)}>
      {options.map((o) => (
        <Link
          key={o.value}
          href={o.href}
          scroll={false}
          aria-current={o.value === current ? "true" : undefined}
          className={cn(
            "inline-flex h-12 min-w-0 flex-1 items-center justify-center rounded-[var(--radius-control)] border px-2 font-semibold whitespace-nowrap md:flex-none md:px-4",
            o.value === current ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-ink hover:bg-canvas",
          )}
        >
          {o.label}
        </Link>
      ))}
    </nav>
  );
}
