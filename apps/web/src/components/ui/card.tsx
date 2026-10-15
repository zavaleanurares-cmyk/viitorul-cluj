import type { ComponentProps, ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("rounded-[var(--radius-card)] border border-line/70 bg-surface shadow-[var(--shadow-card)]", className)} {...props} />;
}

export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 pt-4 md:px-5 md:pt-5", className)}>
      <div className="min-w-0 flex-1 basis-56">
        <h2 className="text-[1.0625rem] leading-snug">{title}</h2>
        {description ? <p className="mt-1 text-sm text-ink-3">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-4 md:p-5", className)} {...props} />;
}

/** Titlul unei pagini, cu acțiunea principală în dreapta. */
export function PageHeader({ title, description, action, back }: { title: ReactNode; description?: ReactNode; action?: ReactNode; back?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {back ? <div className="mb-2 text-sm">{back}</div> : null}
        <h1 className="text-[1.75rem] leading-tight md:text-[2.125rem]">{title}</h1>
        {description ? <p className="mt-2 max-w-prose text-[0.9375rem] text-ink-3">{description}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap gap-2 max-sm:w-full sm:shrink-0 sm:pt-1 has-[>[data-desktop-only]:only-child]:max-md:hidden">{action}</div> : null}
    </header>
  );
}

export function EmptyState({ title, description, action, icon }: { title: ReactNode; description?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-line/70 bg-surface px-6 py-12 text-center shadow-[var(--shadow-card)]">
      {icon ? <div className="mb-1 text-ink-3 [&_svg]:size-8 [&_svg]:stroke-[1.5]">{icon}</div> : null}
      <p className="max-w-md text-[1.0625rem] font-semibold">{title}</p>
      {description ? <p className="max-w-sm text-ink-3">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** O cifră cu etichetă — pentru tablouri de bord. Starea apare ca punct colorat lângă etichetă (nu ca bară laterală). */
export function Stat({ label, value, hint, tone }: { label: ReactNode; value: ReactNode; hint?: ReactNode; tone?: "green" | "yellow" | "orange" | "red" | "gray" }) {
  const dot = { green: "bg-st-green", yellow: "bg-st-yellow", orange: "bg-st-orange", red: "bg-st-red", gray: "bg-st-gray" } as const;
  return (
    // etichetă, cifră și explicație pe trei rânduri comune cu celelalte carduri din grilă (subgrid):
    // cifrele stau pe aceeași linie chiar dacă o etichetă sau o explicație are două rânduri
    <div className="row-span-3 grid grid-rows-subgrid gap-y-2 rounded-[var(--radius-card)] border border-line/70 bg-surface p-4 shadow-[var(--shadow-card)] md:p-5">
      <p className="flex items-start gap-2 text-sm font-medium text-ink-3">
        {tone ? <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", dot[tone])} aria-hidden /> : null}
        {label}
      </p>
      <p className="self-end text-[1.75rem] font-semibold leading-none tracking-tight md:text-[2rem]">{value}</p>
      <p className="text-sm text-ink-3">{hint}</p>
    </div>
  );
}

export function Notice({ tone = "blue", title, children, className }: { tone?: "blue" | "yellow" | "red" | "green" | "gray"; title?: ReactNode; children?: ReactNode; className?: string }) {
  const tones = {
    blue: "bg-st-blue-soft",
    yellow: "bg-st-yellow-soft",
    red: "bg-st-red-soft",
    green: "bg-st-green-soft",
    gray: "bg-st-gray-soft",
  } as const;
  const Icon = { blue: Info, yellow: TriangleAlert, red: CircleAlert, green: CircleCheck, gray: Info }[tone];
  return (
    <div role={tone === "red" ? "alert" : "note"} className={cn("flex items-start gap-3 rounded-[var(--radius-card)] px-4 py-3.5 text-[0.9375rem]", tones[tone], className)}>
      <Icon className="mt-0.5 size-5 shrink-0 opacity-80" aria-hidden />
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn("text-ink-2", title && "mt-1")}>{children}</div> : null}
      </div>
    </div>
  );
}
