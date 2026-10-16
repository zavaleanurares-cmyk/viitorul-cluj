"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveTrainingRatings } from "@/app/(app)/program/[id]/note/actions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { FormError } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";

/** Lista jucătorilor cu nota 1–5. Atingerea notei alese o șterge. */
export function TrainingRatings({ eventId, players, initial, note }: {
  eventId: string;
  players: Array<{ id: string; name: string; number: number | null }>;
  initial: Record<string, number>;
  note: string;
}) {
  const t = useT().activity.ratings;
  const router = useRouter();
  const [ratings, setRatings] = useState<Record<string, number | null>>(initial);
  const save = useAction(saveTrainingRatings, { refresh: false, onSuccess: () => { router.push(`/program/${eventId}`); router.refresh(); } });
  if (!players.length) return <EmptyState title={t.empty} description={note} />;
  const rated = players.filter((p) => ratings[p.id]).length;
  // la salvare trimitem și ștergerile (null) pentru notele care existau
  const payload = Object.fromEntries(players.flatMap((p) => (ratings[p.id] ? [[p.id, ratings[p.id]]] : p.id in initial ? [[p.id, null]] : [])));

  return (
    <div className="space-y-3 pb-24 md:pb-0">
      <p className="text-sm text-ink-3">{t.hint} {note}</p>
      <p className="font-semibold tabular-nums" aria-live="polite">{t.count(rated, players.length)}</p>
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-card)] ring-1 ring-line">
        {players.map((p) => (
          <li key={p.id} className="space-y-2 px-4 py-3">
            <p className="font-semibold">{p.number != null ? <span className="tabular-nums text-ink-3">{p.number} · </span> : null}{p.name}</p>
            <div role="radiogroup" aria-label={t.rating(p.name)} className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((v) => (
                <button key={v} type="button" role="radio" aria-checked={ratings[p.id] === v}
                  onClick={() => setRatings((r) => ({ ...r, [p.id]: r[p.id] === v ? null : v }))}
                  className={cn("h-11 flex-1 rounded-[var(--radius-control)] font-semibold tabular-nums transition-colors",
                    ratings[p.id] === v ? "bg-brand text-brand-ink" : "bg-sunken text-ink hover:bg-line")}>
                  {v}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <FormError>{save.error}</FormError>
      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-line bg-surface/90 px-4 py-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
        <Button className="w-full md:w-auto" pending={save.pending} onClick={() => save.run({ eventId, ratings: payload })}>{t.save}</Button>
      </div>
    </div>
  );
}
