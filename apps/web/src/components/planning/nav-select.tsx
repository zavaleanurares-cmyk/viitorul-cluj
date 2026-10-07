"use client";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/form";

/** Listă derulantă care schimbă adresa paginii (starea ecranului stă în URL). */
export function NavSelect({ label, value, options, className }: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string; href: string }>;
  className?: string;
}) {
  const router = useRouter();
  return (
    <Select
      aria-label={label}
      value={value}
      className={className}
      onChange={(e) => {
        const next = options.find((o) => o.value === e.target.value);
        if (next) router.push(next.href, { scroll: false });
      }}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </Select>
  );
}
