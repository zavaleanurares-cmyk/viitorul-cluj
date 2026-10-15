"use client";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { Check, ChevronRight, MessageSquareText, TriangleAlert } from "lucide-react";
import { RTP_STAGES, describeDose, type DayItem, type PlayerDay } from "@club/shared";
import { saveExerciseNote, toggleExercise } from "@/app/(app)/azi/actions";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, FormError, Textarea } from "@/components/ui/form";
import { ProgressBar } from "@/components/ui/misc";
import { Dialog } from "@/components/ui/overlay";
import { ScaleInput } from "@/components/ui/scale";
import { Badge } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";

type Tick = { done: boolean; pending: boolean };

function itemRef(date: string, item: DayItem) {
  return { date, planItemId: item.plan_item_id, assignmentId: item.assignment_id, programExerciseId: item.program_exercise_id };
}

/**
 * Lista de exerciții a unei zile (plan personalizat + programe), cu bifă la o atingere.
 * Bifa apare imediat (optimist) și revine singură dacă salvarea eșuează.
 * `editable = false`: listă doar de citit (zile viitoare sau mai vechi de 2 zile).
 * `upcoming`: zi viitoare — fără bife și fără progres, doar ce urmează.
 */
export function DayList({ day, editable, upcoming = false, backHref }: { day: PlayerDay; editable: boolean; upcoming?: boolean; backHref: string }) {
  const t = useT().player;
  const toast = useToast();
  const items = [...(day.plan?.items ?? []), ...day.programs.flatMap((p) => p.items)];
  const server: Record<string, Tick> = Object.fromEntries(items.map((i) => [i.key, { done: !!i.completion?.done, pending: false }]));
  const [ticks, setTick] = useOptimistic(server, (state, patch: { key: string; done: boolean }) => ({
    ...state,
    [patch.key]: { done: patch.done, pending: true },
  }));
  const [, startTransition] = useTransition();
  const [failed, setFailed] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<DayItem | null>(null);

  const doneCount = items.filter((i) => ticks[i.key]?.done).length;

  function toggle(item: DayItem) {
    const current = ticks[item.key];
    if (!editable || !current || current.pending) return;
    const next = !current.done;
    setFailed(null);
    startTransition(async () => {
      setTick({ key: item.key, done: next });
      let error: string | null = null;
      try {
        const res = await toggleExercise({ ...itemRef(day.date, item), done: next });
        if (!res.ok) error = res.error;
      } catch {
        error = t.errors.network;
      }
      if (error) {
        // la sfârșitul tranziției bifa optimistă dispare și rămâne starea de pe server
        setFailed(item.key);
        toast(error, "error");
      }
    });
  }

  const row = (item: DayItem) => {
    const tick = ticks[item.key] ?? { done: false, pending: false };
    const dose = describeDose(item);
    const c = item.completion;
    const name = item.exercise.name;
    const line = dose || t.day.details;
    const cut = line.lastIndexOf(" ") + 1;
    const lead = line.slice(0, cut);
    const last = line.slice(cut);
    return (
      <li key={item.key} className="py-3">
        <div className="flex items-center gap-3">
          {editable ? (
            <button
              type="button"
              role="checkbox"
              aria-checked={tick.done}
              aria-busy={tick.pending || undefined}
              aria-label={t.day.tick(name)}
              onClick={() => toggle(item)}
              className={cn(
                "relative inline-flex size-11 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                tick.done ? "border-st-green bg-st-green text-white" : "border-line-strong bg-surface text-transparent active:bg-sunken",
              )}
            >
              <Check className="size-6" strokeWidth={3} aria-hidden />
              {tick.pending ? (
                <span className="absolute -inset-1 animate-spin rounded-full border-2 border-ink-3 border-r-transparent" aria-hidden />
              ) : null}
            </button>
          ) : upcoming ? null : (
            <span
              role="img"
              aria-label={tick.done ? t.day.stateDone : t.day.stateNotDone}
              className={cn(
                "inline-flex size-11 shrink-0 items-center justify-center rounded-full border-2",
                tick.done ? "border-st-green bg-st-green text-white" : "border-line bg-sunken text-transparent",
              )}
            >
              <Check className="size-6" strokeWidth={3} aria-hidden />
            </span>
          )}
          <Link
            href={`/exercitii/${item.exercise.id}?inapoi=${encodeURIComponent(backHref)}`}
            className="block min-h-14 min-w-0 flex-1 content-center rounded-lg py-1"
          >
            <span className="block text-[1.0625rem] font-semibold leading-snug">{name}</span>
            <span className="block text-ink-2">
              {lead}
              {/* ultimul cuvânt rămâne lipit de săgeată, ca săgeata să nu cadă singură pe rândul următor */}
              <span className="whitespace-nowrap">
                {last}
                <ChevronRight className="ml-0.5 inline size-4 align-[-0.15em] text-ink-3" aria-hidden />
              </span>
            </span>
            {dose ? <span className="sr-only">{t.day.details}</span> : null}
          </Link>
          {editable ? (
            <button
              type="button"
              aria-label={t.day.noteFor(name)}
              title={t.day.noteTitle}
              onClick={() => setNoteFor(item)}
              className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink active:bg-line bg-sunken transition-colors"
            >
              <MessageSquareText className="size-6" aria-hidden />
            </button>
          ) : null}
        </div>
        {item.notes || c?.pain || c?.comment || failed === item.key ? (
          <div className={cn("mt-2 space-y-1.5", upcoming ? null : "pl-14")}>
            {item.notes ? <p className="text-sm text-ink-2">{item.notes}</p> : null}
            {c?.pain ? (
              <Badge tone="red">
                <TriangleAlert className="size-3.5" aria-hidden />
                {t.day.painBadge(c.pain_intensity)}
              </Badge>
            ) : null}
            {c?.comment ? <p className="text-sm text-ink-3">{t.day.yourComment}: {c.comment}</p> : null}
            {failed === item.key ? <p role="alert" className="text-sm font-semibold text-st-red">{t.day.tickFailed}</p> : null}
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <div className="space-y-4">
      {upcoming || items.length === 0 ? null : (
        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <p className="text-lg font-bold" aria-live="polite">{t.day.progress(doneCount, items.length)}</p>
            {doneCount === items.length ? (
              <Badge tone="green">
                <Check className="size-3.5" aria-hidden />
                {t.day.allDone}
              </Badge>
            ) : null}
          </div>
          <ProgressBar value={doneCount} max={items.length} label={t.day.progressLabel} />
        </div>
      )}

      {day.plan ? (
        <Card>
          <CardHeader
            title={day.plan.title || t.day.planTitle}
            description={t.day.planKind}
            action={day.plan.rtp_stage !== null && RTP_STAGES[day.plan.rtp_stage] ? <Badge tone="outline">{t.day.stage(day.plan.rtp_stage + 1)}</Badge> : null}
          />
          <CardBody className="pt-2">
            {day.plan.rtp_stage !== null && RTP_STAGES[day.plan.rtp_stage] ? (
              <p className="mb-2 text-sm text-ink-3">{RTP_STAGES[day.plan.rtp_stage]}</p>
            ) : null}
            {day.plan.notes ? (
              <p className="mb-1 rounded-lg bg-canvas px-3 py-2 text-ink-2">
                <span className="block text-sm font-semibold text-ink-3">{t.day.coachNote}</span>
                {day.plan.notes}
              </p>
            ) : null}
            {day.plan.items.length ? (
              <ul className="divide-y divide-line">{day.plan.items.map(row)}</ul>
            ) : (
              <p className="py-2 text-ink-3">{t.day.planEmpty}</p>
            )}
          </CardBody>
        </Card>
      ) : null}

      {day.programs.map((p) => (
        <Card key={p.assignment_id}>
          <CardHeader title={p.name} description={t.day.programKind} />
          <CardBody className="pt-2">
            {p.notes ? (
              <p className="mb-1 rounded-lg bg-canvas px-3 py-2 text-ink-2">
                <span className="block text-sm font-semibold text-ink-3">{t.day.coachNote}</span>
                {p.notes}
              </p>
            ) : null}
            {p.items.length ? (
              <ul className="divide-y divide-line">{p.items.map(row)}</ul>
            ) : (
              <p className="py-2 text-ink-3">{t.day.planEmpty}</p>
            )}
          </CardBody>
        </Card>
      ))}

      {noteFor ? <NoteDialog key={noteFor.key} date={day.date} item={noteFor} onClose={() => setNoteFor(null)} /> : null}
    </div>
  );
}

function NoteDialog({ date, item, onClose }: { date: string; item: DayItem; onClose: () => void }) {
  const t = useT().player;
  const [comment, setComment] = useState(item.completion?.comment ?? "");
  const [pain, setPain] = useState(item.completion?.pain ?? false);
  const [intensity, setIntensity] = useState<number | null>(item.completion?.pain_intensity ?? null);
  const [localError, setLocalError] = useState<string | null>(null);
  const save = useAction(saveExerciseNote, { onSuccess: onClose });

  return (
    <Dialog
      open
      onClose={onClose}
      title={item.exercise.name}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t.common.cancel}</Button>
          <Button
            pending={save.pending}
            onClick={() => {
              if (pain && intensity === null) return setLocalError(t.errors.painIntensityNeeded);
              setLocalError(null);
              save.run({ ...itemRef(date, item), comment, pain, painIntensity: pain ? intensity : null });
            }}
          >
            {t.day.noteSave}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Checkbox
          label={t.day.painQuestion}
          description={t.day.painHint}
          checked={pain}
          onChange={(e) => { setPain(e.target.checked); setLocalError(null); }}
        />
        {pain ? (
          <ScaleInput label={t.day.painScale} value={intensity} onChange={(v) => { setIntensity(v); setLocalError(null); }} minLabel={t.scales.painMin} maxLabel={t.scales.painMax} />
        ) : null}
        <Field label={t.day.commentLabel} optional>
          <Textarea value={comment} maxLength={500} onChange={(e) => setComment(e.target.value)} placeholder={t.day.commentPlaceholder} />
        </Field>
        <FormError>{localError ?? save.error}</FormError>
      </div>
    </Dialog>
  );
}
