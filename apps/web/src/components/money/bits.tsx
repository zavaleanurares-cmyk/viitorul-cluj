import { Ban, BadgePercent, CircleAlert, CircleCheck, CircleDashed, Clock, CircleDot, FileCheck, FileX, Hourglass, ShoppingBag } from "lucide-react";
import { chargeDisplayState, formatLei } from "@club/shared";
import { getT } from "@/messages";
import { cn } from "@/lib/cn";

/** O sumă, cu cifre de aceeași lățime (coloanele se aliniază). */
export function Money({ value, className, decimals, sign }: { value: number | null | undefined; className?: string; decimals?: "auto" | "always"; sign?: boolean }) {
  return <span className={cn("whitespace-nowrap tabular-nums", className)}>{formatLei(value ?? 0, { decimals, sign })}</span>;
}

type ChipState = "open" | "partial" | "paid" | "waived" | "cancelled" | "overdue" | "future";

const CHIP: Record<ChipState, { cls: string; Icon: typeof Ban }> = {
  paid: { cls: "bg-st-green text-white", Icon: CircleCheck },
  partial: { cls: "bg-st-yellow-soft text-ink", Icon: CircleDot },
  overdue: { cls: "bg-st-red text-white", Icon: CircleAlert },
  open: { cls: "bg-sunken text-ink", Icon: Clock },
  waived: { cls: "bg-st-blue-soft text-ink", Icon: BadgePercent },
  cancelled: { cls: "bg-sunken text-ink-3 line-through", Icon: Ban },
  future: { cls: "bg-sunken text-ink-3", Icon: CircleDashed },
};

/** Starea unei taxe: culoare + pictogramă + cuvânt (niciodată doar culoare). */
export function ChargeStateChip({ state, dueOn, today, size = "sm", className }: { state: string; dueOn?: string; today?: string; size?: "sm" | "md"; className?: string }) {
  const t = getT().money.states;
  const s = (dueOn && today ? chargeDisplayState(state, dueOn, today) : state) as ChipState;
  const cfg = CHIP[s] ?? CHIP.open;
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold", size === "sm" ? "h-6 px-2.5 text-xs" : "h-7 px-3 text-[0.8125rem]", cfg.cls, className)}>
      <cfg.Icon className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden />
      {t[s] ?? s}
    </span>
  );
}

const PR: Record<string, { cls: string; Icon: typeof Ban }> = {
  draft: { cls: "bg-sunken text-ink-2", Icon: CircleDashed },
  submitted: { cls: "bg-st-yellow-soft text-ink", Icon: Hourglass },
  approved: { cls: "bg-st-green text-white", Icon: FileCheck },
  rejected: { cls: "bg-st-red text-white", Icon: FileX },
  completed: { cls: "bg-st-blue-soft text-ink", Icon: ShoppingBag },
  cancelled: { cls: "bg-sunken text-ink-3", Icon: Ban },
};

export function PurchaseStatusChip({ status, label, size = "sm" }: { status: string; label: string; size?: "sm" | "md" }) {
  const cfg = PR[status] ?? PR.draft;
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold", size === "sm" ? "h-6 px-2.5 text-xs" : "h-7 px-3 text-[0.8125rem]", cfg.cls)}>
      <cfg.Icon className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden />
      {label}
    </span>
  );
}

/** Procentul încasat, cu bară; sub 50%: semnalat cu pictogramă și cuvânt. */
export function CollectedMeter({ collected, expected, lowLabel }: { collected: number; expected: number; lowLabel?: string }) {
  const pct = expected > 0 ? Math.round((collected / expected) * 100) : 0;
  const low = expected > 0 && pct < 50;
  const tone = pct >= 85 ? "bg-st-green" : pct >= 50 ? "bg-st-yellow" : "bg-st-red";
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-2 w-20 overflow-hidden rounded-full bg-sunken" aria-hidden>
        <span className={cn("block h-full", tone)} style={{ width: `${Math.min(100, pct)}%` }} />
      </span>
      <span className="tabular-nums">{pct}%</span>
      {low && lowLabel ? (
        <span className="inline-flex h-6 items-center gap-1 rounded-full bg-st-red px-2.5 text-xs font-semibold text-white">
          <CircleAlert className="size-3.5" aria-hidden />{lowLabel}
        </span>
      ) : null}
    </span>
  );
}
