"use client";
import { useMemo, useState } from "react";
import { Check, Plus } from "lucide-react";
import { BODY_ZONES, EQUIPMENT, EXERCISE_CATEGORIES, EXERCISE_LEVELS, label, norm, zoneLabel } from "@club/shared";
import { useT } from "@/messages";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { ExerciseThumb } from "./exercise-thumb";
import { exerciseMeta } from "./format";
import type { ExerciseOption } from "./types";

/**
 * Selectorul de exerciții, folosit la programe și la planuri: căutare după nume și filtre
 * după zonă, categorie și echipament. Rămâne deschis cât timp se adaugă exerciții.
 */
export function ExercisePicker({ open, onClose, exercises, onAdd, countInList }: {
  open: boolean;
  onClose: () => void;
  /** doar exercițiile active pot fi alese */
  exercises: ExerciseOption[];
  onAdd: (exerciseId: string) => void;
  /** de câte ori apare deja exercițiul în listă */
  countInList: (exerciseId: string) => number;
}) {
  const t = useT().planning.picker;
  const [q, setQ] = useState("");
  const [zone, setZone] = useState("");
  const [category, setCategory] = useState("");
  const [equipment, setEquipment] = useState("");
  const [added, setAdded] = useState(0);

  const active = useMemo(() => exercises.filter((e) => e.is_active), [exercises]);
  const zones = useMemo(() => BODY_ZONES.filter((z) => active.some((e) => e.zones.includes(z.code))), [active]);
  const equipmentCodes = useMemo(() => Object.keys(EQUIPMENT).filter((c) => active.some((e) => e.equipment.includes(c))), [active]);
  const categories = useMemo(() => Object.keys(EXERCISE_CATEGORIES).filter((c) => active.some((e) => e.category === c)), [active]);

  const shown = useMemo(() => {
    const needle = norm(q);
    return active.filter((e) =>
      (!needle || norm(e.name).includes(needle)) &&
      (!zone || e.zones.includes(zone)) &&
      (!category || e.category === category) &&
      (!equipment || e.equipment.includes(equipment)));
  }, [active, q, zone, category, equipment]);

  const close = () => {
    setAdded(0);
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} title={t.title} wide
      footer={<Button onClick={close}>{added ? t.doneAdded(added) : t.done}</Button>}>
      <div className="space-y-2">
        <Input type="search" inputMode="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.search} aria-label={t.search} />
        <div className="grid grid-cols-3 gap-2">
          <Select aria-label={t.zone} value={zone} onChange={(e) => setZone(e.target.value)}>
            <option value="">{t.zone}</option>
            {zones.map((z) => <option key={z.code} value={z.code}>{zoneLabel(z.code, null, true)}</option>)}
          </Select>
          <Select aria-label={t.category} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">{t.category}</option>
            {categories.map((c) => <option key={c} value={c}>{label(EXERCISE_CATEGORIES, c)}</option>)}
          </Select>
          <Select aria-label={t.equipment} value={equipment} onChange={(e) => setEquipment(e.target.value)}>
            <option value="">{t.equipment}</option>
            {equipmentCodes.map((c) => <option key={c} value={c}>{label(EQUIPMENT, c)}</option>)}
          </Select>
        </div>
      </div>
      <p className="mt-3 text-sm text-ink-3" aria-live="polite">{t.results(shown.length)}</p>
      {shown.length ? (
        <ul className="mt-1 divide-y divide-line border-y border-line">
          {shown.map((e) => {
            const n = countInList(e.id);
            return (
              <li key={e.id}>
                <button type="button" onClick={() => { onAdd(e.id); setAdded((x) => x + 1); }}
                  className="flex min-h-16 w-full items-center gap-3 py-2 text-left hover:bg-canvas active:bg-sunken">
                  <ExerciseThumb imageUrl={e.image_url} hasVideo={e.has_video} className="w-20" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-snug">{e.name}</span>
                    <span className="block truncate text-sm text-ink-3">
                      {exerciseMeta(e)} · {label(EXERCISE_LEVELS, e.level)}
                    </span>
                  </span>
                  <span className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-1 rounded-[var(--radius-control)] border px-2.5 text-sm font-semibold",
                    n ? "border-brand bg-brand text-brand-ink" : "border-transparent bg-sunken",
                  )}>
                    {n ? <Check className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
                    {n ? t.inList(n) : t.add}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 rounded-[var(--radius-control)] bg-sunken px-4 py-6 text-center text-ink-3">
          {active.length ? t.noResults : t.noExercises}
        </p>
      )}
    </Dialog>
  );
}
