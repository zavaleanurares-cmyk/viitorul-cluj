"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Lock, Search } from "lucide-react";
import { norm } from "@club/shared";
import { EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/status";
import { useT } from "@/messages";
import { DrillThumb } from "./drill-thumb";
import { drillMinutes, type DrillRow } from "./queries";

type Filters = { q: string; age: string; kind: string; category: string; owner: "" | "mine" };
const NONE: Filters = { q: "", age: "", kind: "", category: "", owner: "" };

/** Biblioteca de secțiuni: căutare și filtre în browser, carduri cu schema. */
export function DrillLibrary({ drills, userId }: { drills: DrillRow[]; userId: string }) {
  const t = useT().drills;
  const [f, setF] = useState<Filters>(NONE);
  const set = (p: Partial<Filters>) => setF((x) => ({ ...x, ...p }));
  const kinds = useMemo(() => [...new Set(drills.map((d) => d.kind).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "ro")), [drills]);
  const ages = useMemo(() => t.ageGroups.filter((g) => drills.some((d) => d.age_group === g)), [drills, t.ageGroups]);

  const shown = useMemo(() => {
    const q = norm(f.q);
    return drills.filter((d) =>
      (!q || norm(d.name).includes(q) || norm(d.kind).includes(q) || norm(d.author).includes(q))
      && (!f.age || d.age_group === f.age)
      && (!f.kind || d.kind === f.kind)
      && (!f.category || d.category === f.category)
      && (!f.owner || d.created_by === userId));
  }, [drills, f, userId]);

  if (!drills.length) return <EmptyState title={t.empty.title} description={t.empty.description} />;

  return (
    <>
      <div className="mb-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_11rem_12rem_12rem_10rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input type="search" aria-label={t.filters.search} placeholder={t.filters.search} value={f.q} className="pl-10" onChange={(e) => set({ q: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-2 md:contents">
          <Select aria-label={t.filters.ageGroup} value={f.age} onChange={(e) => set({ age: e.target.value })}>
            <option value="">{t.filters.allAgeGroups}</option>
            {ages.map((g) => <option key={g} value={g}>{g}</option>)}
          </Select>
          <Select aria-label={t.filters.kind} value={f.kind} onChange={(e) => set({ kind: e.target.value })}>
            <option value="">{t.filters.allKinds}</option>
            {kinds.map((k) => <option key={k} value={k}>{k}</option>)}
          </Select>
          <Select aria-label={t.filters.category} value={f.category} onChange={(e) => set({ category: e.target.value })}>
            <option value="">{t.filters.allCategories}</option>
            {(Object.keys(t.categories) as Array<keyof typeof t.categories>).map((k) => <option key={k} value={k}>{t.categories[k]}</option>)}
          </Select>
          <Select aria-label={t.filters.owner} value={f.owner} onChange={(e) => set({ owner: e.target.value as Filters["owner"] })}>
            <option value="">{t.filters.allOwners}</option>
            <option value="mine">{t.mine}</option>
          </Select>
        </div>
      </div>
      <p className="mb-3 text-sm text-ink-3" aria-live="polite">{t.count(shown.length, drills.length)}</p>

      {!shown.length ? (
        <EmptyState title={t.empty.filteredTitle} description={t.empty.filteredDescription}
          action={<Button variant="secondary" onClick={() => setF(NONE)}>{t.filters.reset}</Button>} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((d) => {
            const minutes = drillMinutes(d);
            return (
              <li key={d.id}>
                <Link href={`/program/sectiuni/${d.id}`}
                  className="block h-full overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-card)] ring-1 ring-line transition-shadow hover:shadow-[var(--shadow-float)]">
                  <DrillThumb drill={d} />
                  <div className="space-y-2 p-4">
                    <p className="flex items-start gap-2 font-semibold leading-snug">
                      <span className="min-w-0 flex-1">{d.name}</span>
                      {d.visibility === "private" ? <Lock className="mt-0.5 size-4 shrink-0 text-ink-3" aria-label={t.private} /> : null}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {d.age_group ? <Badge tone="outline">{d.age_group}</Badge> : null}
                      {d.kind ? <Badge tone="outline">{d.kind}</Badge> : null}
                      {minutes ? <Badge tone="outline">{t.minutes(minutes)}</Badge> : null}
                      {d.players != null || d.goalkeepers != null ? <Badge tone="outline">{t.playersGk(d.players, d.goalkeepers)}</Badge> : null}
                    </div>
                    {d.author ? <p className="text-sm text-ink-3">{t.by(d.author)}</p> : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
