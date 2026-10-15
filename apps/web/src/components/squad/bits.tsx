import Link from "next/link";
import { CircleAlert, CircleCheck, Clock, FileQuestion } from "lucide-react";
import { formatDateShort } from "@club/shared";
import { getT } from "@/messages";
import { cn } from "@/lib/cn";
import type { VisaState } from "./queries";

/** Starea vizei medicale: culoare + pictogramă + cuvânt. */
export function VisaChip({ state, days, expires, size = "sm" }: { state: VisaState; days: number | null; expires: string | null; size?: "sm" | "md" }) {
  const t = getT().squad.visa;
  const cfg = {
    ok: { cls: "bg-st-green-soft text-ink", Icon: CircleCheck, text: t.chipOk },
    expiring: { cls: "bg-st-orange-soft text-ink", Icon: Clock, text: t.expiring(days ?? 0) },
    expired: { cls: "bg-st-red text-white", Icon: CircleAlert, text: t.expired },
    missing: { cls: "bg-st-red text-white", Icon: FileQuestion, text: t.missing },
  }[state];
  return (
    <span title={expires ? t.ok(formatDateShort(expires)) : undefined}
      className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold", size === "sm" ? "h-6 px-2.5 text-xs" : "h-7 px-3 text-[0.8125rem]", cfg.cls)}>
      <cfg.Icon className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden />
      {cfg.text}
    </span>
  );
}

/** Prezența ca „17 din 20" cu bară; fără date: liniuță. */
export function AttendanceMeter({ present, total }: { present: number; total: number }) {
  const pct = total ? Math.round((present / total) * 100) : 0;
  const tone = pct >= 85 ? "bg-st-green" : pct >= 70 ? "bg-st-yellow" : "bg-st-red";
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-2 w-16 overflow-hidden rounded-full bg-sunken" aria-hidden>
        <span className={cn("block h-full", tone)} style={{ width: `${pct}%` }} />
      </span>
      <span className="tabular-nums">{present}/{total}</span>
    </span>
  );
}

/** Rând de filtre ca linkuri (starea stă în URL). */
export function FilterLinks({ items, label }: { items: Array<{ href: string; label: string; active: boolean; count?: number }>; label: string }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex gap-2">
        {items.map((it) => (
          <li key={it.href}>
            <Link href={it.href} aria-current={it.active ? "page" : undefined}
              className={cn("inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-[0.9375rem] font-medium transition-colors",
                it.active ? "border-brand bg-brand text-brand-ink" : "border-transparent bg-sunken hover:bg-line")}>
              {it.label}
              {it.count !== undefined ? <span className={cn("text-sm", it.active ? "opacity-90" : "text-ink-3")}>{it.count}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
