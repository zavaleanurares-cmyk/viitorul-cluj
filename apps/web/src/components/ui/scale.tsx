"use client";
import { cn } from "@/lib/cn";

/**
 * Scală 1–10 cu butoane mari, pentru chestionar: o atingere = un răspuns.
 * Capetele sunt etichetate (1 = deloc, 10 = maxim); se acceptă doar valori întregi.
 */
export function ScaleInput({ label, value, onChange, minLabel = "deloc", maxLabel = "maxim", name }: {
  label: string; value: number | null; onChange: (v: number) => void; minLabel?: string; maxLabel?: string; name?: string;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-[1.0625rem] font-semibold">{label}</legend>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} din 10${n === 1 ? `, ${minLabel}` : n === 10 ? `, ${maxLabel}` : ""}`}
            onClick={() => onChange(n)}
            className={cn(
              "h-14 rounded-[var(--radius-control)] border-2 text-xl font-semibold transition-colors",
              value === n ? "border-brand bg-brand text-brand-ink" : "border-transparent bg-sunken text-ink active:bg-line",
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-sm text-ink-3">
        <span>1 = {minLabel}</span>
        <span>10 = {maxLabel}</span>
      </div>
      {name ? <input type="hidden" name={name} value={value ?? ""} /> : null}
    </fieldset>
  );
}

/** Afișare compactă a unui scor 1–10 într-o celulă de tabel; culoarea întărește cifra, nu o înlocuiește. */
export function ScoreCell({ value, threshold = 8 }: { value: number | null | undefined; threshold?: number }) {
  if (value === null || value === undefined) return <span className="text-ink-3">·</span>;
  const tone = value >= threshold ? "bg-st-red text-white" : value >= threshold - 2 ? "bg-st-yellow-soft text-ink" : "text-ink";
  return <span className={cn("inline-flex size-8 items-center justify-center rounded-full font-semibold", tone)}>{value}</span>;
}
