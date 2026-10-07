"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, CircleDashed, MessageSquare, Plus, Repeat, Timer, Trash2, TriangleAlert } from "lucide-react";
import { useT } from "@/messages";
import { cn } from "@/lib/cn";
import { Button, IconButton } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Badge } from "@/components/ui/status";
import { ExercisePicker } from "./exercise-picker";
import { exerciseMeta } from "./format";
import { itemProblem, newItem, type ExerciseOption, type ItemCompletion, type ItemDraft } from "./types";

/**
 * Lista de exerciții a unui program sau a unui plan: parametri, reordonare cu butoane, ștergere,
 * adăugare din selector. Ecranul cel mai folosit de preparator — totul se completează din câteva atingeri.
 */
export function ItemsEditor({ items, onChange, exercises, completions, showProblems, actions }: {
  items: ItemDraft[];
  onChange: (items: ItemDraft[]) => void;
  exercises: ExerciseOption[];
  /** ce a bifat jucătorul, pe id-ul itemului (doar la planuri) */
  completions?: Record<string, ItemCompletion>;
  showProblems?: boolean;
  /** butoane suplimentare lângă „Adaugă exerciții" */
  actions?: React.ReactNode;
}) {
  const t = useT().planning.items;
  const [picking, setPicking] = useState(false);
  const byId = new Map(exercises.map((e) => [e.id, e]));

  const update = (key: string, patch: Partial<ItemDraft>) => onChange(items.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const move = (index: number, delta: number) => {
    const to = index + delta;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    [next[index], next[to]] = [next[to], next[index]];
    onChange(next);
  };

  return (
    <div>
      {items.length ? (
        <ol className="space-y-2">
          {items.map((item, index) => (
            <ItemCard
              key={item.key}
              item={item}
              index={index}
              count={items.length}
              exercise={byId.get(item.exercise_id)}
              completion={item.id ? completions?.[item.id] : undefined}
              showCompletion={!!completions}
              showProblems={showProblems}
              onUpdate={(patch) => update(item.key, patch)}
              onMove={(delta) => move(index, delta)}
              onRemove={() => onChange(items.filter((i) => i.key !== item.key))}
            />
          ))}
        </ol>
      ) : (
        <p className="rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface px-4 py-8 text-center text-ink-3">{t.empty}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" icon={<Plus className="size-5" aria-hidden />} onClick={() => setPicking(true)}>{t.add}</Button>
        {actions}
      </div>
      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        exercises={exercises}
        onAdd={(id) => onChange([...items, newItem(id)])}
        countInList={(id) => items.filter((i) => i.exercise_id === id).length}
      />
    </div>
  );
}

function ItemCard({ item, index, count, exercise, completion, showCompletion, showProblems, onUpdate, onMove, onRemove }: {
  item: ItemDraft;
  index: number;
  count: number;
  exercise: ExerciseOption | undefined;
  completion: ItemCompletion | undefined;
  showCompletion: boolean;
  showProblems?: boolean;
  onUpdate: (patch: Partial<ItemDraft>) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const t = useT().planning.items;
  const [more, setMore] = useState(!!item.tempo || !!item.notes);
  const name = exercise?.name ?? t.missingExercise;
  const problem = showProblems ? itemProblem(item) : null;
  const numeric = { inputMode: "numeric" as const, pattern: "[0-9]*", autoComplete: "off", className: "px-2 text-center font-semibold" };

  return (
    <li className="rounded-[var(--radius-card)] border border-line bg-surface p-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-sunken text-sm font-bold" aria-hidden>{index + 1}</span>
        <div className="min-w-0 flex-1">
          <p className="font-bold leading-snug">{name}</p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-3">
            {exercise ? <span>{exerciseMeta(exercise)}</span> : null}
            {exercise && !exercise.is_active ? <Badge tone="outline">{t.inactive}</Badge> : null}
          </p>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-[4.25rem_minmax(0,1fr)_5rem] gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-3">{t.sets}</span>
          <Input {...numeric} value={item.sets} onChange={(e) => onUpdate({ sets: e.target.value })} aria-invalid={problem === "sets"} />
        </label>
        <div>
          <label htmlFor={`amount-${item.key}`} className="mb-1 block text-xs font-semibold text-ink-3">{item.mode === "reps" ? t.reps : t.duration}</label>
          <div className="flex gap-1">
            {item.mode === "reps" ? (
              <Input id={`amount-${item.key}`} value={item.reps} onChange={(e) => onUpdate({ reps: e.target.value })} maxLength={60} autoComplete="off"
                placeholder={t.repsPlaceholder} className="min-w-0 px-2 font-semibold" />
            ) : (
              <Input id={`amount-${item.key}`} {...numeric} value={item.duration_sec} onChange={(e) => onUpdate({ duration_sec: e.target.value })}
                placeholder="30" aria-invalid={problem === "duration"} className="min-w-0 px-2 text-center font-semibold" />
            )}
            <IconButton
              label={item.mode === "reps" ? t.switchToTime : t.switchToReps}
              className="shrink-0 border border-line-strong"
              onClick={() => onUpdate({ mode: item.mode === "reps" ? "time" : "reps" })}
            >
              {item.mode === "reps" ? <Timer className="size-5" aria-hidden /> : <Repeat className="size-5" aria-hidden />}
            </IconButton>
          </div>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-3">{t.rest}</span>
          <Input {...numeric} value={item.rest_sec} onChange={(e) => onUpdate({ rest_sec: e.target.value })} aria-invalid={problem === "rest"} />
        </label>
      </div>
      {problem ? <p role="alert" className="mt-1 text-sm font-semibold text-st-red">{t.problems[problem]}</p> : null}

      {more ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-[9rem_1fr]">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">{t.tempo}</span>
            <Input value={item.tempo} onChange={(e) => onUpdate({ tempo: e.target.value })} maxLength={30} placeholder="3-1-1" autoComplete="off" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-3">{t.notes}</span>
            <Input value={item.notes} onChange={(e) => onUpdate({ notes: e.target.value })} maxLength={500} placeholder={t.notesPlaceholder} autoComplete="off" />
          </label>
        </div>
      ) : null}

      {showCompletion && item.id ? <CompletionLine completion={completion} /> : null}

      <div className="mt-1 flex items-center justify-between gap-2">
        <button type="button" onClick={() => setMore((m) => !m)} aria-expanded={more}
          className="inline-flex h-12 items-center gap-1 rounded-[var(--radius-control)] px-1 text-sm font-semibold text-ink-2 hover:bg-sunken">
          <ChevronDown className={cn("size-4", more && "rotate-180")} aria-hidden />
          {t.more}
        </button>
        <div className="flex">
          <IconButton label={t.moveUp(name)} disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp className="size-5" aria-hidden /></IconButton>
          <IconButton label={t.moveDown(name)} disabled={index === count - 1} onClick={() => onMove(1)}><ArrowDown className="size-5" aria-hidden /></IconButton>
          <IconButton label={t.remove(name)} onClick={onRemove}><Trash2 className="size-5" aria-hidden /></IconButton>
        </div>
      </div>
    </li>
  );
}

/** Ce a bifat jucătorul la un exercițiu: făcut / nefăcut, comentariu, durere. Mereu pictogramă + text. */
export function CompletionLine({ completion, className }: { completion: ItemCompletion | undefined; className?: string }) {
  const t = useT().planning.items;
  return (
    <div className={cn("mt-2 rounded-[var(--radius-control)] bg-canvas px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-semibold">
        {completion?.done ? (
          <span className="inline-flex items-center gap-1 text-st-green"><Check className="size-4" strokeWidth={3} aria-hidden />{t.done}</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-ink-3"><CircleDashed className="size-4" aria-hidden />{t.notDone}</span>
        )}
        {completion?.pain ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-st-red-soft px-1.5 py-0.5 text-ink">
            <TriangleAlert className="size-4 text-st-red" aria-hidden />{t.pain(completion.pain_intensity)}
          </span>
        ) : null}
      </p>
      {completion?.comment ? (
        <p className="mt-1 flex gap-1.5 text-ink-2"><MessageSquare className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden /><span>„{completion.comment}”</span></p>
      ) : null}
    </div>
  );
}
