"use client";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { sessionLoad } from "@club/shared";
import { saveRpe } from "@/app/(app)/azi/actions";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, FormError, Input, Segmented } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { ScaleInput } from "@/components/ui/scale";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";

type SessionType = "training" | "match";
export type RpeToday = { session_type: string; rpe: number; duration_min: number; load: number | null };

const QUICK_DURATIONS = [45, 60, 75, 90, 120];

/** RPE după antrenament / meci: efort 1–10 × minute = încărcare. Câte o înregistrare pe tip, pe zi. */
export function RpeCard({ entries }: { entries: RpeToday[] }) {
  const t = useT().player;
  const [editing, setEditing] = useState<SessionType | null>(null);
  const known = entries.filter((e): e is RpeToday & { session_type: SessionType } => e.session_type === "training" || e.session_type === "match");
  const missing = (["training", "match"] as const).filter((s) => !known.some((e) => e.session_type === s));

  return (
    <Card>
      <CardHeader title={t.rpe.title} description={t.rpe.hint} />
      <CardBody className="space-y-3">
        {known.length ? (
          <ul className="divide-y divide-line">
            {known.map((e) => (
              <li key={e.session_type} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{t.rpe.types[e.session_type]}</p>
                  <p className="text-ink-2">{t.rpe.summary(e.rpe, e.duration_min)}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold leading-none">{e.load ?? sessionLoad(e.rpe, e.duration_min)}</p>
                  <p className="text-xs text-ink-3">{t.rpe.load}</p>
                </div>
                <button
                  type="button"
                  aria-label={t.rpe.editFor(t.rpe.types[e.session_type])}
                  onClick={() => setEditing(e.session_type)}
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-full active:bg-line bg-sunken transition-colors"
                >
                  <Pencil className="size-5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {missing.length ? (
          <Button variant="secondary" className="w-full" icon={<Plus className="size-5" aria-hidden />} onClick={() => setEditing(missing[0])}>
            {known.length ? t.rpe.addAnother : t.rpe.add}
          </Button>
        ) : null}
      </CardBody>
      {editing ? <RpeDialog key={editing} initialType={editing} entries={known} onClose={() => setEditing(null)} /> : null}
    </Card>
  );
}

function RpeDialog({ initialType, entries, onClose }: {
  initialType: SessionType; entries: Array<RpeToday & { session_type: SessionType }>; onClose: () => void;
}) {
  const t = useT().player;
  const find = (s: SessionType) => entries.find((e) => e.session_type === s);
  const first = find(initialType);
  const [type, setType] = useState<SessionType>(initialType);
  const [rpe, setRpe] = useState<number | null>(first?.rpe ?? null);
  const [duration, setDuration] = useState<string>(first ? String(first.duration_min) : "");
  const [localError, setLocalError] = useState<string | null>(null);
  const save = useAction(saveRpe, { onSuccess: onClose });

  const minutes = /^\d{1,3}$/.test(duration.trim()) ? Number(duration.trim()) : null;
  const load = rpe !== null && minutes ? sessionLoad(rpe, minutes) : null;

  function changeType(next: SessionType) {
    setType(next);
    const existing = find(next);
    setRpe(existing?.rpe ?? null);
    setDuration(existing ? String(existing.duration_min) : "");
    setLocalError(null);
  }

  function submit() {
    if (rpe === null) return setLocalError(t.errors.rpeRange);
    if (!minutes || minutes < 1 || minutes > 300) return setLocalError(t.errors.durationRange);
    setLocalError(null);
    save.run({ sessionType: type, rpe, durationMin: minutes });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={find(type) ? t.rpe.dialogEdit : t.rpe.dialogAdd}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t.common.cancel}</Button>
          <Button pending={save.pending} onClick={submit}>{t.rpe.save}</Button>
        </>
      }
    >
      <div className="space-y-5">
        <Segmented
          label={t.rpe.typeLabel}
          value={type}
          onChange={changeType}
          options={[
            { value: "training", label: t.rpe.types.training },
            { value: "match", label: t.rpe.types.match },
          ]}
        />
        <ScaleInput label={t.rpe.question} value={rpe} onChange={(v) => { setRpe(v); setLocalError(null); }} minLabel={t.scales.rpeMin} maxLabel={t.scales.rpeMax} />
        <div>
          <Field label={t.rpe.duration}>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={300}
              step={1}
              value={duration}
              onChange={(e) => { setDuration(e.target.value); setLocalError(null); }}
              placeholder={t.rpe.durationPlaceholder}
            />
          </Field>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={t.rpe.quick}>
            {QUICK_DURATIONS.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={minutes === m}
                onClick={() => { setDuration(String(m)); setLocalError(null); }}
                className={
                  "h-12 min-w-14 flex-1 rounded-[var(--radius-control)] border px-2 font-semibold " +
                  (minutes === m ? "border-brand bg-brand text-brand-ink" : "border-transparent bg-sunken text-ink active:bg-line")
                }
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <p className="rounded-lg bg-canvas px-3 py-2" aria-live="polite">
          <span className="text-ink-3">{t.rpe.load}: </span>
          <span className="text-lg font-bold">{load !== null ? t.rpe.formula(rpe!, minutes!, load) : t.rpe.loadPending}</span>
        </p>
        <FormError>{localError ?? save.error}</FormError>
      </div>
    </Dialog>
  );
}
