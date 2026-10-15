import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { initials } from "@club/shared";
import { cn } from "@/lib/cn";

export function Avatar({ name, src, size = 40 }: { name: string; src?: string | null; size?: number }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-full bg-sunken font-bold text-ink-2" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials(name)}
    </span>
  );
}

export function ProgressBar({ value, max, label, className }: { value: number; max: number; label?: string; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className={className}>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label} className="h-2 overflow-hidden rounded-full bg-sunken">
        <div className={cn("h-full rounded-full", pct >= 100 ? "bg-st-green" : "bg-brand")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** File de navigație bazate pe linkuri (starea stă în URL). */
export function TabLinks({ tabs, current, className, variant = "segmented" }: {
  tabs: Array<{ href: string; label: ReactNode; key: string }>; current: string; className?: string;
  /** „pills" = al doilea nivel, sub un control segmentat (aceleași capsule ca sub-filele din meniul de sus) */
  variant?: "segmented" | "pills";
}) {
  if (variant === "pills") {
    return (
      <nav className={cn("-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0", className)} aria-label="Secțiuni">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <Link key={t.key} href={t.href} aria-current={t.key === current ? "page" : undefined}
              className={cn("inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-full px-3.5 text-[0.875rem] transition-colors",
                t.key === current ? "bg-brand/10 font-semibold text-brand" : "font-medium text-ink-2 hover:bg-sunken hover:text-ink")}>
              {t.label}
            </Link>
          ))}
        </div>
      </nav>
    );
  }
  return (
    <nav className={cn("-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0", className)} aria-label="Secțiuni">
      <div className="inline-flex gap-1 rounded-[0.75rem] bg-sunken p-1">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === current ? "page" : undefined}
          className={cn(
            "flex h-8 shrink-0 items-center rounded-[0.5rem] px-3.5 text-[0.875rem] font-medium whitespace-nowrap transition-colors",
            t.key === current ? "bg-surface text-ink shadow-[0_1px_3px_rgb(0_0_0/0.12)]" : "text-ink-2 hover:text-ink",
          )}
        >
          {t.label}
        </Link>
      ))}
      </div>
    </nav>
  );
}

/** Navigare înainte / înapoi pe zile sau săptămâni, cu linkuri. */
export function PrevNext({ prevHref, nextHref, label, todayHref }: { prevHref: string; nextHref: string; label: ReactNode; todayHref?: string }) {
  return (
    <div className="flex items-center gap-1">
      <Link href={prevHref} aria-label="Înapoi" className="inline-flex size-11 items-center justify-center rounded-full bg-sunken transition-colors hover:bg-line">
        <ChevronLeft className="size-5" aria-hidden />
      </Link>
      <div className="min-w-0 flex-1 px-2 text-center font-semibold">{label}</div>
      {todayHref ? (
        <Link href={todayHref} className="inline-flex h-11 items-center rounded-full bg-sunken px-4 font-medium transition-colors hover:bg-line">
          Azi
        </Link>
      ) : null}
      <Link href={nextHref} aria-label="Înainte" className="inline-flex size-11 items-center justify-center rounded-full bg-sunken transition-colors hover:bg-line">
        <ChevronRight className="size-5" aria-hidden />
      </Link>
    </div>
  );
}

/** Tabel simplu, derulabil pe orizontală pe telefon. Folosește <th scope> în conținut. */
export function TableWrap({ children, className, flush }: { children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <div className={cn(flush
      ? "-mx-4 overflow-x-auto md:-mx-5 [&_:is(td,th):first-child]:pl-4 [&_:is(td,th):last-child]:pr-4 md:[&_:is(td,th):first-child]:pl-5 md:[&_:is(td,th):last-child]:pr-5"
      : "overflow-x-auto rounded-[var(--radius-card)] border border-line/70 bg-surface shadow-[var(--shadow-card)]", className)}>
      <table className="w-full border-collapse bg-surface text-left [&_td]:border-t [&_td]:border-line [&_td]:px-4 [&_td]:py-2.5 [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-[0.8125rem] [&_th]:font-medium [&_th]:text-ink-3 [&_thead_th]:bg-surface">
        {children}
      </table>
    </div>
  );
}

/** Pereche etichetă–valoare pentru fișe. */
export function DataList({ items, className }: { items: Array<{ label: ReactNode; value: ReactNode }>; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-[auto_1fr] gap-x-4 gap-y-2", className)}>
      {items.map((it, i) => (
        <div key={i} className="contents">
          <dt className="text-ink-3">{it.label}</dt>
          <dd className="font-semibold">{it.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
