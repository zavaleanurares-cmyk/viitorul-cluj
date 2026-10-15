import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { SummaryStat } from "./types";

/** Pașii asistentului: pe telefon doar pasul curent, pe ecran lat toată secvența. */
export function Stepper({ steps, current, label }: { steps: string[]; current: number; label: string }) {
  return (
    <nav aria-label={label} className="mb-4">
      <p className="font-semibold md:hidden">
        <span className="text-ink-3">{current + 1}/{steps.length}</span> {steps[current]}
      </p>
      <div className="mt-2 flex gap-1 md:hidden" aria-hidden>
        {steps.map((s, i) => <span key={s} className={cn("h-1.5 flex-1 rounded-full", i <= current ? "bg-brand" : "bg-sunken")} />)}
      </div>
      <ol className="hidden items-center gap-2 md:flex">
        {steps.map((s, i) => (
          <li key={s} aria-current={i === current ? "step" : undefined} className="flex items-center gap-2">
            {i > 0 ? <span className="h-px w-6 bg-line-strong" aria-hidden /> : null}
            <span
              className={cn(
                "inline-flex size-7 items-center justify-center rounded-full border text-sm font-bold",
                i === current ? "border-brand bg-brand text-brand-ink" : i < current ? "border-line-strong bg-sunken text-ink" : "border-line-strong text-ink-3",
              )}
            >
              {i < current ? <Check className="size-4" aria-hidden /> : i + 1}
            </span>
            <span className={cn("text-sm font-semibold", i === current ? "text-ink" : "text-ink-3")}>{s}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Bara de jos a unui pas: înapoi în stânga, acțiunea principală în dreapta. */
export function StepNav({ back, onBack, next, onNext, disabled, pending, hint, final }: {
  back?: string; onBack?: () => void; next?: string; onNext?: () => void; disabled?: boolean; pending?: boolean; hint?: ReactNode; final?: boolean;
}) {
  return (
    <div className="mt-4 flex flex-col-reverse gap-3 border-t border-line pt-4 md:flex-row md:items-center md:justify-between">
      {onBack ? (
        <Button variant="secondary" className="w-full md:w-auto" onClick={onBack} disabled={pending} icon={<ArrowLeft className="size-5" aria-hidden />}>{back}</Button>
      ) : <span className="hidden md:block" />}
      <div className="flex min-w-0 flex-col gap-2 md:flex-1 md:flex-row md:items-center md:justify-end md:gap-3">
        {hint ? <p className="min-w-0 text-sm text-ink-3 md:text-right">{hint}</p> : null}
        {onNext ? (
          <Button className="w-full md:w-auto" onClick={onNext} disabled={disabled} pending={pending}>
            {next}
            {final ? null : <ArrowRight className="size-5" aria-hidden />}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Lista problemelor care opresc trecerea la pasul următor. */
export function Problems({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul role="alert" className="mt-4 space-y-1 rounded-[var(--radius-control)] bg-st-red-soft px-4 py-3 font-medium">
      {items.map((p) => <li key={p}>{p}</li>)}
    </ul>
  );
}

/** Motivul pentru care un rând rămâne „de verificat". */
export function FlagNote({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-start gap-1 text-sm text-ink-2">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-st-orange" aria-hidden />
      <span>{children}</span>
    </span>
  );
}

const STAT_BAR = { green: "bg-st-green", orange: "bg-st-orange", red: "bg-st-red", gray: "bg-st-gray" } as const;

/** Cifrele unui import, dense; valorile zero rămân vizibile, dar fără accent. */
export function StatRow({ stats, className }: { stats: SummaryStat[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-2 gap-2 md:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]", className)}>
      {stats.map((s) => (
        <div key={s.label} className="relative overflow-hidden rounded-[var(--radius-control)] border border-line bg-surface py-2 pl-4 pr-3">
          <span className={cn("absolute inset-y-0 left-0 w-1.5", s.value > 0 ? STAT_BAR[s.tone ?? "gray"] : "bg-line")} aria-hidden />
          <dd className={cn("text-2xl font-bold leading-tight", s.value === 0 && "text-ink-3")}>{s.value}</dd>
          <dt className="text-sm text-ink-3">{s.label}</dt>
        </div>
      ))}
    </dl>
  );
}

/** Secțiune a unui pas, cu titlu mic. */
export function Section({ title, description, action, children, className }: {
  title: ReactNode; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={cn("mt-5 first:mt-0", className)}>
      <header className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg">{title}</h2>
          {description ? <p className="max-w-prose text-sm text-ink-3">{description}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/** Filtru cu câteva opțiuni scurte; butoanele nu se îngustează sub textul lor. */
export function FilterTabs<T extends string>({ label, value, onChange, options }: {
  label: string; value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string }>;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cn(
            "h-10 rounded-[var(--radius-control)] border px-3 text-sm font-semibold whitespace-nowrap",
            value === o.value ? "border-brand bg-brand text-brand-ink" : "border-transparent bg-sunken text-ink hover:bg-line",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
