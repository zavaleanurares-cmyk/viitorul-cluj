import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { getT } from "@/messages";
import { formatValue } from "./domain";

/** Diferența față de un reper (rezultatul anterior sau media grupei), cu sensul scris în cuvinte. */
export function Delta({ cmp, unit }: { cmp: { diff: number; better: boolean | null } | null; unit: string }) {
  const t = getT().physical.delta;
  if (!cmp) return <span className="text-ink-3">—</span>;
  const Icon = cmp.better === null ? Minus : cmp.better ? ArrowUpRight : ArrowDownRight;
  const sign = cmp.diff > 0 ? "+" : cmp.diff < 0 ? "−" : "";
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <Icon className="size-4 shrink-0" aria-hidden />
      {cmp.better === null ? t.equal : (
        <>
          <span className="font-semibold">{sign}{formatValue(Math.abs(cmp.diff))} {unit}</span>
          <span className="text-ink-2">· {cmp.better ? t.better : t.worse}</span>
        </>
      )}
    </span>
  );
}
