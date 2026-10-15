"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Textarea } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { cn } from "@/lib/cn";
import { saveEvaluation } from "@/app/(app)/performanta/evaluari/actions";
import { CATEGORIES, type Category } from "./evaluation-templates";

type Criterion = { id: string; category: Category; name: string; description: string | null };

/**
 * Notarea unui jucător, pe telefon: criteriile pe categorii, fiecare cu cinci butoane mari (1–5),
 * obiectivele pentru familie și nota internă. „Trimite" duce direct la următorul jucător.
 */
export function RatingForm({ roundId, playerId, criteria, initial, prevHref, nextHref, roundHref, readOnly }: {
  roundId: string; playerId: string; criteria: Criterion[];
  initial: { scores: Record<string, number>; strengths: string; nextGoals: string; comment: string };
  prevHref: string | null; nextHref: string | null; roundHref: string; readOnly: boolean;
}) {
  const t = useT().performance.evaluations;
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, number>>(initial.scores);
  const [strengths, setStrengths] = useState(initial.strengths);
  const [nextGoals, setNextGoals] = useState(initial.nextGoals);
  const [comment, setComment] = useState(initial.comment);
  const [submitting, setSubmitting] = useState(false);
  const save = useAction(saveEvaluation, {
    onSuccess: () => { if (submitting) router.push(nextHref ?? roundHref); },
  });
  const missing = criteria.filter((c) => !scores[c.id]).length;
  const send = (submit: boolean) => {
    setSubmitting(submit);
    save.run({ roundId, playerId, scores, strengths, nextGoals, comment, submit });
  };
  return (
    <div className="space-y-5">
      {CATEGORIES.filter((cat) => criteria.some((c) => c.category === cat)).map((cat) => (
        <section key={cat} className="rounded-[var(--radius-card)] border border-line/70 bg-surface p-4 shadow-[var(--shadow-card)]">
          <h2 className="mb-3 text-lg">{t.categories[cat]}</h2>
          <ul className="space-y-4">
            {criteria.filter((c) => c.category === cat).map((c) => (
              <li key={c.id}>
                <p className="font-semibold" id={`c-${c.id}`}>{c.name}</p>
                {c.description ? <p className="text-sm text-ink-3">{c.description}</p> : null}
                <div role="radiogroup" aria-labelledby={`c-${c.id}`} className="mt-2 grid grid-cols-5 gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => {
                    const on = scores[c.id] === n;
                    return (
                      <button key={n} type="button" role="radio" aria-checked={on} disabled={readOnly} title={t.scores[n]}
                        onClick={() => setScores({ ...scores, [c.id]: n })}
                        className={cn("flex h-12 flex-col items-center justify-center rounded-[var(--radius-control)] border text-lg font-bold disabled:opacity-60",
                          on ? "border-brand bg-brand text-brand-ink" : "border-transparent bg-sunken hover:bg-line")}>
                        {n}
                        <span className="sr-only"> — {t.scores[n]}</span>
                      </button>
                    );
                  })}
                </div>
                {scores[c.id] ? <p className="mt-1 text-sm text-ink-2">{t.scores[scores[c.id]]}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="space-y-4 rounded-[var(--radius-card)] border border-line/70 bg-surface p-4 shadow-[var(--shadow-card)]">
        <Field label={t.strengths} optional><Textarea rows={2} value={strengths} maxLength={1000} disabled={readOnly} onChange={(e) => setStrengths(e.target.value)} /></Field>
        <Field label={t.nextGoals} hint={t.nextGoalsHint} optional><Textarea rows={3} value={nextGoals} maxLength={1000} disabled={readOnly} onChange={(e) => setNextGoals(e.target.value)} /></Field>
        <Field label={t.comment} optional><Textarea rows={2} value={comment} maxLength={2000} disabled={readOnly} onChange={(e) => setComment(e.target.value)} /></Field>
      </section>

      <FormError>{save.error}</FormError>
      {readOnly ? <p className="text-ink-3">{t.roundClosed}</p> : (
        <div className="sticky bottom-20 z-10 flex flex-wrap items-center justify-end gap-2 rounded-[var(--radius-card)] border border-line/70 bg-surface p-3 shadow-sm md:bottom-4 shadow-[var(--shadow-card)]">
          {missing ? <span className="mr-auto text-sm font-semibold text-ink-2">{t.missingScores(missing)}</span> : null}
          <Button variant="ghost" pending={save.pending && !submitting} icon={<Save className="size-5" aria-hidden />} onClick={() => send(false)}>{t.saveDraft}</Button>
          <Button disabled={missing > 0} pending={save.pending && submitting} icon={<Send className="size-5" aria-hidden />} onClick={() => send(true)}>
            {nextHref ? t.submitNext : t.submit}
          </Button>
        </div>
      )}
      <nav className="flex justify-between gap-2" aria-label={t.backToRound}>
        {prevHref ? <Link href={prevHref} className="inline-flex h-12 items-center gap-1 font-semibold text-ink-2 hover:text-ink"><ChevronLeft className="size-5" aria-hidden />{t.previous}</Link> : <span />}
        {nextHref ? <Link href={nextHref} className="inline-flex h-12 items-center gap-1 font-semibold text-ink-2 hover:text-ink">{t.next}<ChevronRight className="size-5" aria-hidden /></Link> : null}
      </nav>
    </div>
  );
}
