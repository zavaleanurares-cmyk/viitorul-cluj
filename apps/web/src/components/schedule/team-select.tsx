"use client";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/form";

/** Alegerea echipei într-un raport: schimbă parametrul din adresă. */
export function TeamSelect({ value, options, label, allLabel, hrefFor, className }: {
  value: string; options: Array<{ id: string; name: string }>; label: string; allLabel: string; hrefFor: Record<string, string>; className?: string;
}) {
  const router = useRouter();
  return (
    <Select aria-label={label} value={value} className={className} onChange={(e) => router.push(hrefFor[e.target.value] ?? hrefFor[""])}>
      <option value="">{allLabel}</option>
      {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </Select>
  );
}
