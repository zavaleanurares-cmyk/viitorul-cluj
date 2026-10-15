import Link from "next/link";
import { cn } from "@/lib/cn";

/** Alegerea intervalului (7 / 28 / 90 de zile etc.) prin linkuri: starea stă în URL. */
export function IntervalNav({ label, options, current, className }: {
  label: string; options: Array<{ value: string; label: string; href: string }>; current: string; className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("no-print flex w-full gap-1 rounded-[0.75rem] bg-sunken p-1 md:inline-flex md:w-auto", className)}>
      {options.map((o) => (
        <Link
          key={o.value}
          href={o.href}
          scroll={false}
          aria-current={o.value === current ? "true" : undefined}
          className={cn(
            "inline-flex h-8 min-w-0 flex-1 items-center justify-center rounded-[0.5rem] px-3.5 text-[0.875rem] font-medium whitespace-nowrap transition-colors md:flex-none",
            o.value === current ? "bg-surface text-ink shadow-[0_1px_3px_rgb(0_0_0/0.12)]" : "text-ink-2 hover:text-ink",
          )}
        >
          {o.label}
        </Link>
      ))}
    </nav>
  );
}
