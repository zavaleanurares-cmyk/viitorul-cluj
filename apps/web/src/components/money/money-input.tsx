"use client";
import { useId, useState, type ComponentProps } from "react";
import { formatLei, parseLei } from "@club/shared";
import { cn } from "@/lib/cn";

/**
 * Câmp pentru sume în lei: tastatură numerică pe telefon, „lei" afișat în câmp, se citește la fel ca
 * în extrase („450", „450,50", „1.250,00"). Valoarea trimisă mai departe este în bani (întreg) sau null.
 */
export function MoneyInput({ value, onChange, className, invalid, id, ...props }: Omit<ComponentProps<"input">, "value" | "onChange" | "type"> & {
  value: number | null;
  onChange: (bani: number | null) => void;
  invalid?: boolean;
}) {
  const autoId = useId();
  const [text, setText] = useState(value === null ? "" : formatLei(value, { currency: false }));
  const [focused, setFocused] = useState(false);
  // când valoarea se schimbă din afară (ex. împărțirea automată), afișăm noua valoare
  const shown = focused ? text : value === null ? "" : formatLei(value, { currency: false });
  return (
    <div className={cn("relative", className)}>
      <input
        {...props}
        id={id ?? autoId}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={shown}
        aria-invalid={invalid || undefined}
        onFocus={() => { setText(value === null ? "" : formatLei(value, { currency: false })); setFocused(true); }}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setText(e.target.value);
          const v = parseLei(e.target.value);
          onChange(v === null || v < 0 ? null : v);
        }}
        className={cn(
          "h-12 w-full rounded-[var(--radius-control)] border bg-surface pl-3 pr-12 text-right tabular-nums",
          invalid ? "border-st-red" : "border-border-control",
        )}
      />
      <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-ink-3">lei</span>
    </div>
  );
}
