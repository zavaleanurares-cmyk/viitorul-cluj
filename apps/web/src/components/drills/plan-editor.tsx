"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, BookOpen, Plus, Search, X } from "lucide-react";
import { norm } from "@club/shared";
import { saveTrainingPlan, type PlanInput } from "@/app/(app)/program/sectiuni/actions";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Notice } from "@/components/ui/card";
import { Checkbox, Field, FormError, Input, Textarea } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { Badge } from "@/components/ui/status";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";

export type PickableDrill = { id: string; name: string; ageGroup: string | null; kind: string | null; minutes: number | null; players: number | null; goalkeepers: number | null };
type Item = { key: string; drillId: string | null; title: string; duration: string; notes: string };

const key = () => Math.random().toString(36).slice(2, 10);

/** Fereastra din care se aleg secțiunile din bibliotecă (mai multe deodată). */
function DrillPicker({ open, onClose, drills, onPick }: { open: boolean; onClose: () => void; drills: PickableDrill[]; onPick: (d: PickableDrill[]) => void }) {
  const t = useT().drills;
  const [q, setQ] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const shown = useMemo(() => {
    const n = norm(q);
    return drills.filter((d) => !n || norm(d.name).includes(n) || norm(d.kind).includes(n) || norm(d.ageGroup).includes(n)).slice(0, 200);
  }, [drills, q]);
  const close = () => { setChosen([]); setQ(""); onClose(); };
  return (
    <Dialog open={open} onClose={close} title={t.plan.pickTitle} wide
      footer={<>
        <Button variant="secondary" onClick={close}>{useT().common.actions.cancel}</Button>
        <Button disabled={!chosen.length} onClick={() => { onPick(drills.filter((d) => chosen.includes(d.id))); close(); }}>{t.plan.pickAdd(chosen.length || 1)}</Button>
      </>}>
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input type="search" aria-label={t.plan.pickSearch} placeholder={t.plan.pickSearch} value={q} className="pl-10" onChange={(e) => setQ(e.target.value)} />
        </div>
        {shown.length ? (
          <ul className="divide-y divide-line rounded-[var(--radius-control)] border border-line">
            {shown.map((d) => (
              <li key={d.id} className="px-3 py-1">
                <Checkbox
                  checked={chosen.includes(d.id)}
                  onChange={(e) => setChosen((c) => (e.target.checked ? [...c, d.id] : c.filter((x) => x !== d.id)))}
                  label={d.name}
                  description={[d.ageGroup, d.kind, d.minutes ? t.minutes(d.minutes) : null, d.players != null || d.goalkeepers != null ? t.playersGk(d.players, d.goalkeepers) : null].filter(Boolean).join(" · ") || undefined}
                />
              </li>
            ))}
          </ul>
        ) : <p className="py-6 text-center text-ink-3">{t.plan.pickEmpty}</p>}
      </div>
    </Dialog>
  );
}

/** Planul unui antrenament: temă, obiective și secțiunile, cu durata fiecăreia, comparate cu durata antrenamentului. */
export function PlanEditor({ eventId, available, drills, initial, cancelHref }: {
  eventId: string;
  cancelHref: string;
  /** durata antrenamentului, în minute */
  available: number;
  drills: PickableDrill[];
  initial: { theme: string; objectives: string; description: string; items: Array<{ drillId: string | null; title: string; durationMin: number | null; notes: string }> };
}) {
  const t = useT().drills.plan;
  const c = useT().common;
  const router = useRouter();
  const [theme, setTheme] = useState(initial.theme);
  const [objectives, setObjectives] = useState(initial.objectives);
  const [description, setDescription] = useState(initial.description);
  const [items, setItems] = useState<Item[]>(() => initial.items.map((i) => ({ key: key(), drillId: i.drillId, title: i.title, duration: i.durationMin ? String(i.durationMin) : "", notes: i.notes })));
  const [picking, setPicking] = useState(false);
  const save = useAction(saveTrainingPlan, { refresh: false, onSuccess: () => { router.push(`/program/${eventId}/plan`); router.refresh(); } });

  const update = (k: string, p: Partial<Item>) => setItems((xs) => xs.map((x) => (x.key === k ? { ...x, ...p } : x)));
  const move = (i: number, d: -1 | 1) => setItems((xs) => {
    const next = [...xs];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    return next;
  });
  const planned = items.reduce((s, i) => s + (parseInt(i.duration, 10) || 0), 0);
  const known = new Map(drills.map((d) => [d.id, d]));

  const input: PlanInput = {
    eventId, theme, objectives, description,
    items: items.filter((i) => i.title.trim()).map((i) => {
      const n = parseInt(i.duration, 10);
      return { drillId: i.drillId, title: i.title.trim(), durationMin: n >= 1 && n <= 240 ? n : null, notes: i.notes };
    }),
  };

  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); void save.run(input); }}>
      <Card>
        <CardBody className="space-y-4">
          <Field label={t.theme} optional><Input value={theme} maxLength={200} placeholder={t.themePlaceholder} onChange={(e) => setTheme(e.target.value)} /></Field>
          <Field label={t.objectives} optional><Textarea rows={2} value={objectives} maxLength={2000} onChange={(e) => setObjectives(e.target.value)} /></Field>
          <Field label={t.description} optional><Textarea rows={2} value={description} maxLength={4000} onChange={(e) => setDescription(e.target.value)} /></Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t.sections} action={<span className="text-sm font-semibold tabular-nums text-ink-2" aria-live="polite">{t.total(planned, available)}</span>} />
        <CardBody className="space-y-4">
          {planned > available ? <Notice tone="yellow">{t.over(planned - available)}</Notice> : null}
          {items.length ? (
            <ol className="space-y-3">
              {items.map((it, i) => {
                const lib = it.drillId ? known.get(it.drillId) : null;
                return (
                  <li key={it.key} className="rounded-[var(--radius-control)] border border-line p-3">
                    <div className="flex items-start gap-2">
                      <span className="mt-2.5 w-6 shrink-0 text-right font-semibold tabular-nums text-ink-3">{i + 1}.</span>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem]">
                          {it.drillId ? (
                            <p className="flex min-h-11 flex-wrap items-center gap-2 font-semibold">
                              {it.title}
                              <Badge tone="outline">{t.fromLibrary}</Badge>
                            </p>
                          ) : (
                            <Input aria-label={t.freeTitle} placeholder={t.freeTitle} value={it.title} maxLength={120} onChange={(e) => update(it.key, { title: e.target.value })} />
                          )}
                          <Input aria-label={t.duration} placeholder={lib?.minutes ? String(Math.round(lib.minutes)) : t.duration} inputMode="numeric" maxLength={3}
                            value={it.duration} onChange={(e) => update(it.key, { duration: e.target.value.replace(/\D/g, "") })} />
                        </div>
                        <Input aria-label={t.notes} placeholder={t.notes} value={it.notes} maxLength={1000} onChange={(e) => update(it.key, { notes: e.target.value })} />
                      </div>
                      <div className="flex shrink-0 flex-col">
                        <IconButton label={t.moveUp(it.title)} disabled={i === 0} onClick={() => move(i, -1)} className="size-9"><ArrowUp className="size-4" aria-hidden /></IconButton>
                        <IconButton label={t.moveDown(it.title)} disabled={i === items.length - 1} onClick={() => move(i, 1)} className="size-9"><ArrowDown className="size-4" aria-hidden /></IconButton>
                        <IconButton label={t.remove(it.title)} onClick={() => setItems((xs) => xs.filter((x) => x.key !== it.key))} className="size-9 text-st-red"><X className="size-4" aria-hidden /></IconButton>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : <p className="text-ink-3">{t.sectionsEmpty}</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={<BookOpen className="size-5" aria-hidden />} disabled={!drills.length} onClick={() => setPicking(true)}>{t.addFromLibrary}</Button>
            <Button variant="secondary" icon={<Plus className="size-5" aria-hidden />} onClick={() => setItems((xs) => [...xs, { key: key(), drillId: null, title: "", duration: "", notes: "" }])}>{t.addFree}</Button>
          </div>
        </CardBody>
      </Card>

      <FormError>{save.error}</FormError>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" pending={save.pending}>{c.actions.save}</Button>
        <Button variant="secondary" onClick={() => router.push(cancelHref)}>{c.actions.cancel}</Button>
      </div>

      <DrillPicker open={picking} onClose={() => setPicking(false)} drills={drills}
        onPick={(ds) => setItems((xs) => [...xs, ...ds.map((d) => ({ key: key(), drillId: d.id, title: d.name, duration: d.minutes ? String(Math.round(d.minutes)) : "", notes: "" }))])} />
    </form>
  );
}
