import { Activity, Bandage, BatteryLow, Check, Circle, CircleHelp, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import type { StatusTone } from "@club/shared";
import { cn } from "@/lib/cn";

/** Culorile de stare. Textul are contrast suficient pe fiecare fond; culoarea nu apare niciodată singură. */
export const TONE_SOLID: Record<StatusTone, string> = {
  green: "bg-st-green text-white",
  yellow: "bg-st-yellow text-ink",
  orange: "bg-st-orange text-ink",
  red: "bg-st-red text-white",
  gray: "bg-st-gray text-white",
  blue: "bg-st-blue text-white",
};
export const TONE_SOFT: Record<StatusTone, string> = {
  green: "bg-st-green-soft",
  yellow: "bg-st-yellow-soft",
  orange: "bg-st-orange-soft",
  red: "bg-st-red-soft",
  gray: "bg-st-gray-soft",
  blue: "bg-st-blue-soft",
};
export const TONE_BAR: Record<StatusTone, string> = {
  green: "bg-st-green",
  yellow: "bg-st-yellow",
  orange: "bg-st-orange",
  red: "bg-st-red",
  gray: "bg-st-gray",
  blue: "bg-st-blue",
};
/** Valorile hex, pentru SVG și grafice. */
export const TONE_HEX: Record<StatusTone, string> = {
  green: "#248a3d",
  yellow: "#ffcc00",
  orange: "#ff9500",
  red: "#d70015",
  gray: "#6e6e73",
  blue: "#0071e3",
};

const ICONS: Record<string, typeof Check> = {
  check: Check,
  battery: BatteryLow,
  activity: Activity,
  cross: Bandage,
  help: CircleHelp,
  circle: Circle,
  alert: TriangleAlert,
};

export function StatusIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = ICONS[icon] ?? Circle;
  return <Icon className={cn("size-4 shrink-0", className)} strokeWidth={2.5} aria-hidden />;
}

export type StatusLike = { short_label: string; label: string; tone: string; icon: string } | null | undefined;

/**
 * Eticheta de stare a jucătorului (APT / OBOSEALĂ / READAPTARE / ACC / ALT MOTIV),
 * cu vocabularul și culoarea configurate de club. Mereu pictogramă + text.
 */
export function StatusChip({ status, size = "md", full, className }: { status: StatusLike; size?: "sm" | "md" | "lg"; full?: boolean; className?: string }) {
  if (!status) {
    return <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-sunken px-2.5 py-1 text-sm font-semibold text-ink-3", className)}>—</span>;
  }
  const sizes = { sm: "h-6 px-2 text-xs gap-1", md: "h-7 px-2.5 text-[0.8125rem] gap-1.5", lg: "h-10 px-4 text-base gap-2" } as const;
  return (
    <span
      className={cn("inline-flex items-center rounded-full font-semibold whitespace-nowrap", sizes[size], TONE_SOLID[status.tone as StatusTone] ?? TONE_SOLID.gray, className)}
      title={status.label}
    >
      <StatusIcon icon={status.icon} className={size === "lg" ? "size-5" : size === "sm" ? "size-3.5" : undefined} />
      {full ? status.label : status.short_label}
    </span>
  );
}

/** Etichetă neutră mică (categorie, nivel, „de verificat" etc.). */
export function Badge({ tone = "gray", children, className }: { tone?: StatusTone | "brand" | "outline"; children: ReactNode; className?: string }) {
  const tones: Record<string, string> = {
    ...TONE_SOFT,
    brand: "bg-brand text-brand-ink",
    outline: "bg-sunken text-ink-2",
  };
  return (
    <span className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-medium text-ink whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}

export function ReviewBadge({ note }: { note?: string | null }) {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-full bg-st-orange-soft px-2.5 text-xs font-semibold text-ink ring-1 ring-st-orange/60 ring-inset" title={note ?? undefined}>
      <TriangleAlert className="size-3.5" aria-hidden />
      De verificat
    </span>
  );
}
