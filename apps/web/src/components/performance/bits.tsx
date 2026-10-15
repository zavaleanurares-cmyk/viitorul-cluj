import { ArrowDownRight, CircleAlert, CircleCheck, CircleHelp, TriangleAlert } from "lucide-react";
import type { AcwrZone } from "@club/shared";
import { cn } from "@/lib/cn";
import { getT } from "@/messages";

const ZONE = {
  low: { cls: "bg-st-blue-soft text-ink", Icon: ArrowDownRight },
  optimal: { cls: "bg-st-green-soft text-ink", Icon: CircleCheck },
  caution: { cls: "bg-st-orange text-ink", Icon: TriangleAlert },
  high: { cls: "bg-st-red text-white", Icon: CircleAlert },
  unknown: { cls: "bg-sunken text-ink-2", Icon: CircleHelp },
} as const;

/** Zona raportului acut:cronic: culoare + pictogramă + cuvânt (+ valoarea). */
export function AcwrChip({ zone, ratio }: { zone: AcwrZone; ratio: number | null }) {
  const t = getT().performance.load;
  const { cls, Icon } = ZONE[zone];
  return (
    <span className={cn("inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-sm font-semibold", cls)} title={t.zoneHelp[zone]}>
      <Icon className="size-4 shrink-0" aria-hidden />
      {t.zones[zone]}
      {ratio !== null ? <span className="tabular-nums">· {ratio.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> : null}
    </span>
  );
}
