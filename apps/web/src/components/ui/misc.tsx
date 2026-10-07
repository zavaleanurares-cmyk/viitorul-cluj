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
      <div role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label} className="h-3 overflow-hidden rounded-full bg-sunken">
        <div className={cn("h-full rounded-full", pct >= 100 ? "bg-st-green" : "bg-brand")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** File de navigație bazate pe linkuri (starea stă în URL). */
export function TabLinks({ tabs, current, className }: { tabs: Array<{ href: string; label: ReactNode; key: string }>; current: string; className?: string }) {
  return (
    <nav className={cn("-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 md:mx-0 md:px-0", className)} aria-label="Secțiuni">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === current ? "page" : undefined}
          className={cn(
            "flex h-12 shrink-0 items-center border-b-[3px] px-3 font-semibold whitespace-nowrap",
            t.key === current ? "border-brand text-ink" : "border-transparent text-ink-3 hover:text-ink",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

/** Navigare înainte / înapoi pe zile sau săptămâni, cu linkuri. */
export function PrevNext({ prevHref, nextHref, label, todayHref }: { prevHref: string; nextHref: string; label: ReactNode; todayHref?: string }) {
  return (
    <div className="flex items-center gap-1">
      <Link href={prevHref} aria-label="Înapoi" className="inline-flex size-12 items-center justify-center rounded-lg border border-line-strong bg-surface hover:bg-canvas">
        <ChevronLeft className="size-6" aria-hidden />
      </Link>
      <div className="min-w-0 flex-1 px-2 text-center font-bold">{label}</div>
      {todayHref ? (
        <Link href={todayHref} className="inline-flex h-12 items-center rounded-lg border border-line-strong bg-surface px-3 font-semibold hover:bg-canvas">
          Azi
        </Link>
      ) : null}
      <Link href={nextHref} aria-label="Înainte" className="inline-flex size-12 items-center justify-center rounded-lg border border-line-strong bg-surface hover:bg-canvas">
        <ChevronRight className="size-6" aria-hidden />
      </Link>
    </div>
  );
}

/** Tabel simplu, derulabil pe orizontală pe telefon. Folosește <th scope> în conținut. */
export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("-mx-4 overflow-x-auto md:mx-0 md:rounded-[var(--radius-card)] md:border md:border-line", className)}>
      <table className="w-full border-collapse bg-surface text-left [&_td]:border-t [&_td]:border-line [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2 [&_th]:text-sm [&_th]:font-semibold [&_th]:text-ink-3 [&_thead_th]:bg-canvas">
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
