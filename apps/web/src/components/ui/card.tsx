import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("rounded-[var(--radius-card)] border border-line bg-surface", className)} {...props} />;
}

export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <header className={cn("flex items-start justify-between gap-3 px-4 pt-4", className)}>
      <div className="min-w-0">
        <h2 className="text-lg">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-ink-3">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-4", className)} {...props} />;
}

/** Titlul unei pagini, cu acțiunea principală în dreapta. */
export function PageHeader({ title, description, action, back }: { title: ReactNode; description?: ReactNode; action?: ReactNode; back?: ReactNode }) {
  return (
    <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back ? <div className="mb-1 text-sm">{back}</div> : null}
        <h1 className="text-2xl md:text-3xl">{title}</h1>
        {description ? <p className="mt-1 max-w-prose text-ink-3">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2">{action}</div> : null}
    </header>
  );
}

export function EmptyState({ title, description, action, icon }: { title: ReactNode; description?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface px-6 py-10 text-center">
      {icon ? <div className="text-ink-3">{icon}</div> : null}
      <p className="text-lg font-semibold">{title}</p>
      {description ? <p className="max-w-sm text-ink-3">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** O cifră cu etichetă — pentru tablouri de bord. */
export function Stat({ label, value, hint, tone }: { label: ReactNode; value: ReactNode; hint?: ReactNode; tone?: "green" | "yellow" | "orange" | "red" | "gray" }) {
  const bar = { green: "bg-st-green", yellow: "bg-st-yellow", orange: "bg-st-orange", red: "bg-st-red", gray: "bg-st-gray" } as const;
  return (
    <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface p-4">
      {tone ? <span className={cn("absolute inset-y-0 left-0 w-1.5", bar[tone])} aria-hidden /> : null}
      <p className="text-sm text-ink-3">{label}</p>
      <p className="mt-1 text-3xl font-bold leading-none">{value}</p>
      {hint ? <p className="mt-2 text-sm text-ink-3">{hint}</p> : null}
    </div>
  );
}

export function Notice({ tone = "blue", title, children, className }: { tone?: "blue" | "yellow" | "red" | "green" | "gray"; title?: ReactNode; children?: ReactNode; className?: string }) {
  const tones = {
    blue: "bg-st-blue-soft border-st-blue",
    yellow: "bg-st-yellow-soft border-st-yellow",
    red: "bg-st-red-soft border-st-red",
    green: "bg-st-green-soft border-st-green",
    gray: "bg-st-gray-soft border-st-gray",
  } as const;
  return (
    <div role={tone === "red" ? "alert" : "note"} className={cn("rounded-[var(--radius-control)] border-l-4 px-4 py-3", tones[tone], className)}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={cn("text-ink-2", title && "mt-1")}>{children}</div> : null}
    </div>
  );
}
