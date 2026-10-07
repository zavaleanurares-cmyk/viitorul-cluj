"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useT } from "@/messages";
import { Checkbox, Input, Select } from "@/components/ui/form";

export type LibraryFilterValues = { q: string; zona: string; categorie: string; echipament: string; dezactivate: boolean };

/** Căutarea și filtrele bibliotecii. Starea stă în URL, ca linkul să poată fi trimis și „înapoi" să meargă. */
export function LibraryFilters({ values, zones, categories, equipment }: {
  values: LibraryFilterValues;
  zones: Array<{ value: string; label: string }>;
  categories: Array<{ value: string; label: string }>;
  equipment: Array<{ value: string; label: string }>;
}) {
  const t = useT().library.filters;
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(values.q);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const go = (patch: Partial<LibraryFilterValues>) => {
    const next = { ...values, q, ...patch };
    const params = new URLSearchParams();
    if (next.q.trim()) params.set("q", next.q.trim());
    if (next.zona) params.set("zona", next.zona);
    if (next.categorie) params.set("categorie", next.categorie);
    if (next.echipament) params.set("echipament", next.echipament);
    if (next.dezactivate) params.set("dezactivate", "1");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <div className="space-y-2">
      <div className="grid gap-2 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <Input
          type="search"
          inputMode="search"
          value={q}
          aria-label={t.search}
          placeholder={t.search}
          onChange={(e) => {
            const value = e.target.value;
            setQ(value);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => go({ q: value }), 300);
          }}
        />
        <div className="grid grid-cols-3 gap-2 md:contents">
          <Select aria-label={t.zone} value={values.zona} onChange={(e) => go({ zona: e.target.value })}>
            <option value="">{t.allZones}</option>
            {zones.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <Select aria-label={t.category} value={values.categorie} onChange={(e) => go({ categorie: e.target.value })}>
            <option value="">{t.allCategories}</option>
            {categories.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <Select aria-label={t.equipment} value={values.echipament} onChange={(e) => go({ echipament: e.target.value })}>
            <option value="">{t.allEquipment}</option>
            {equipment.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>
      </div>
      <Checkbox label={t.showInactive} checked={values.dezactivate} onChange={(e) => go({ dezactivate: e.target.checked })} />
    </div>
  );
}
