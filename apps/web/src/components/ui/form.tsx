import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "block w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-ink " +
  "placeholder:text-ink-3 disabled:bg-sunken disabled:text-ink-3 aria-[invalid=true]:border-st-red";

export function Field({ label, hint, error, optional, children, className }: {
  label: ReactNode; hint?: ReactNode; error?: ReactNode; optional?: boolean; children: ReactNode; className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 flex items-baseline justify-between gap-2 text-sm font-semibold text-ink-2">
        <span>{label}</span>
        {optional ? <span className="font-normal text-ink-3">opțional</span> : null}
      </span>
      {children}
      {error ? <span className="mt-1 block text-sm font-semibold text-st-red">{error}</span> : hint ? <span className="mt-1 block text-sm text-ink-3">{hint}</span> : null}
    </label>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-12", className)} {...props} />;
}

export function Textarea({ className, rows = 3, ...props }: ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cn(control, "py-2.5", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(control, "h-12 appearance-none bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat pr-9", className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='%23596575' stroke-width='2'%3E%3Cpath d='m3 6 5 5 5-5'/%3E%3C/svg%3E\")" }}
      {...props}
    >
      {children}
    </select>
  );
}

export function Checkbox({ label, description, className, ...props }: Omit<ComponentProps<"input">, "type"> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className={cn("flex min-h-12 cursor-pointer items-start gap-3 py-2", className)}>
      <input type="checkbox" className="mt-0.5 size-6 shrink-0 rounded border-line-strong accent-[var(--color-brand)]" {...props} />
      <span>
        <span className="font-semibold">{label}</span>
        {description ? <span className="block text-sm text-ink-3">{description}</span> : null}
      </span>
    </label>
  );
}

/** Rând de opțiuni exclusive, cu ținte mari (înlocuiește un select scurt). */
export function Segmented<T extends string>({ value, onChange, options, label, className }: {
  value: T | null; onChange: (v: T) => void; options: Array<{ value: T; label: ReactNode }>; label: string; className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-12 min-w-12 flex-1 rounded-[var(--radius-control)] border px-3 font-semibold",
            value === o.value ? "border-brand bg-brand text-brand-ink" : "border-line-strong bg-surface text-ink hover:bg-canvas",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="rounded-[var(--radius-control)] border-l-4 border-st-red bg-st-red-soft px-3 py-2 font-semibold text-ink">{children}</p>;
}
