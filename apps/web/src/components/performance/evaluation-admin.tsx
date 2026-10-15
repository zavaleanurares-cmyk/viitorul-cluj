"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ListChecks, Pencil, Play, Plus, Send, Trash2, X } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/players/confirm-dialog";
import { useAction } from "@/lib/use-action";
import { useToast } from "@/components/ui/toast";
import { useT } from "@/messages";
import { addStandardTemplate, deleteEvaluationRound, publishEvaluationRound, saveEvaluationTemplate, startEvaluationRound } from "@/app/(app)/performanta/evaluari/actions";
import { CATEGORIES, STANDARD_TEMPLATES, type Category } from "./evaluation-templates";

export type TemplateRow = { id: string; name: string; age_label: string | null; criteria: Array<{ id: string; category: Category; name: string; description: string | null }> };
type Draft = { id: string | null; name: string; ageLabel: string; criteria: Array<{ id: string | null; category: Category; name: string; description: string }> };

const blank = (): Draft => ({ id: null, name: "", ageLabel: "", criteria: CATEGORIES.map((c) => ({ id: null, category: c, name: "", description: "" })) });

/** Modelele de evaluare: cele gata făcute (un clic) și editorul de criterii. */
export function TemplatesManager({ templates }: { templates: TemplateRow[] }) {
  const t = useT().performance.evaluations;
  const c = useT().common;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const std = useAction(addStandardTemplate);
  const save = useAction(saveEvaluationTemplate, { onSuccess: () => setDraft(null) });
  const has = new Set(templates.map((x) => x.name));
  const edit = (x: TemplateRow) => setDraft({ id: x.id, name: x.name, ageLabel: x.age_label ?? "", criteria: x.criteria.map((k) => ({ id: k.id, category: k.category, name: k.name, description: k.description ?? "" })) });
  const setCrit = (i: number, patch: Partial<Draft["criteria"][number]>) => draft && setDraft({ ...draft, criteria: draft.criteria.map((k, j) => (j === i ? { ...k, ...patch } : k)) });
  const valid = !!draft && draft.name.trim().length >= 2 && draft.criteria.some((k) => k.name.trim().length >= 2);
  return (
    <>
      <Button variant="secondary" icon={<ListChecks className="size-5" aria-hidden />} onClick={() => setOpen(true)}>{t.templates}</Button>
      <Dialog open={open} onClose={() => { setOpen(false); setDraft(null); }} title={draft ? (draft.id ? t.editTemplate : t.newTemplate) : t.templatesTitle} wide
        footer={draft ? (
          <>
            <Button variant="ghost" onClick={() => setDraft(null)}>{c.actions.cancel}</Button>
            <Button disabled={!valid} pending={save.pending} onClick={() => save.run({
              id: draft.id, name: draft.name, ageLabel: draft.ageLabel || null,
              criteria: draft.criteria.filter((k) => k.name.trim()).map((k) => ({ id: k.id, category: k.category, name: k.name, description: k.description || null })),
            })}>{c.actions.save}</Button>
          </>
        ) : <Button variant="ghost" onClick={() => setOpen(false)}>{c.actions.close}</Button>}>
        {draft ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
              <Field label={t.templateName}><Input value={draft.name} maxLength={80} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
              <Field label={t.ageLabel} optional><Input value={draft.ageLabel} maxLength={40} onChange={(e) => setDraft({ ...draft, ageLabel: e.target.value })} /></Field>
            </div>
            <ul className="space-y-2">
              {draft.criteria.map((k, i) => (
                <li key={i} className="grid gap-2 sm:grid-cols-[11rem_minmax(0,1fr)_auto] sm:items-center">
                  <Select aria-label={t.categories[k.category]} value={k.category} onChange={(e) => setCrit(i, { category: e.target.value as Category })}>
                    {CATEGORIES.map((cat) => <option key={cat} value={cat}>{t.categories[cat]}</option>)}
                  </Select>
                  <Input aria-label={t.criterion} placeholder={t.criterion} value={k.name} maxLength={80} onChange={(e) => setCrit(i, { name: e.target.value })} />
                  <IconButton label={t.removeCriterion} onClick={() => setDraft({ ...draft, criteria: draft.criteria.filter((_, j) => j !== i) })}><X className="size-5" aria-hidden /></IconButton>
                </li>
              ))}
            </ul>
            <Button variant="secondary" size="sm" icon={<Plus className="size-4" aria-hidden />} onClick={() => setDraft({ ...draft, criteria: [...draft.criteria, { id: null, category: draft.criteria.at(-1)?.category ?? "technical", name: "", description: "" }] })}>{t.addCriterion}</Button>
            <FormError>{save.error}</FormError>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-ink-2">{t.templatesHint}</p>
            {templates.length ? (
              <ul className="divide-y divide-line rounded-[var(--radius-control)] border border-line">
                {templates.map((x) => (
                  <li key={x.id} className="flex items-center gap-2 px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{x.name}{x.age_label ? <span className="font-normal text-ink-3"> · {x.age_label}</span> : null}</span>
                      <span className="block text-sm text-ink-3">{t.criteriaCount(x.criteria.length)}</span>
                    </span>
                    <IconButton label={t.editTemplate} onClick={() => edit(x)}><Pencil className="size-5" aria-hidden /></IconButton>
                  </li>
                ))}
              </ul>
            ) : <p className="text-ink-3">{t.noTemplates}</p>}
            <section className="space-y-2">
              <h3 className="font-semibold">{t.standardTemplates}</h3>
              <ul className="grid gap-2 sm:grid-cols-3">
                {STANDARD_TEMPLATES.map((s) => (
                  <li key={s.key} className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-line p-3">
                    <span className="font-semibold">{s.name}</span>
                    <span className="text-sm text-ink-3">{s.age_label} · {t.criteriaCount(s.criteria.length)}</span>
                    {has.has(s.name) ? <span className="inline-flex items-center gap-1 text-sm font-semibold text-st-green"><Check className="size-4" aria-hidden />{t.added}</span> : (
                      <Button size="sm" variant="secondary" className="self-start" pending={std.pending} icon={<Plus className="size-4" aria-hidden />} onClick={() => std.run({ key: s.key })}>{t.add}</Button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
            <Button variant="secondary" icon={<Plus className="size-5" aria-hidden />} onClick={() => setDraft(blank())}>{t.newTemplate}</Button>
            <FormError>{std.error}</FormError>
          </div>
        )}
      </Dialog>
    </>
  );
}

/** Pornirea unei runde: model, echipe, termen. */
export function StartRoundButton({ templates, teams, defaultName }: { templates: Array<{ id: string; name: string }>; teams: Array<{ id: string; name: string }>; defaultName: string }) {
  const t = useT().performance.evaluations;
  const c = useT().common;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [groups, setGroups] = useState<string[]>([]);
  const [due, setDue] = useState("");
  const start = useAction(startEvaluationRound, { onSuccess: (r) => { setOpen(false); router.push(`/performanta/evaluari/${r.id}`); } });
  return (
    <>
      <Button icon={<Play className="size-5" aria-hidden />} disabled={!templates.length} onClick={() => setOpen(true)}>{t.start}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t.startTitle}
        footer={<>
          <Button variant="ghost" onClick={() => setOpen(false)}>{c.actions.cancel}</Button>
          <Button disabled={!name.trim() || !templateId || !groups.length} pending={start.pending} onClick={() => start.run({ name, templateId, groupIds: groups, dueOn: due || null })}>{t.start}</Button>
        </>}>
        <div className="space-y-4">
          <Field label={t.roundName} hint={t.roundNameHint}><Input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label={t.template}>
            <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>{templates.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select>
          </Field>
          <fieldset>
            <legend className="mb-1 text-sm font-semibold text-ink-2">{t.teams}</legend>
            <div className="flex flex-wrap gap-2">
              {teams.map((g) => {
                const on = groups.includes(g.id);
                return (
                  <button key={g.id} type="button" aria-pressed={on} onClick={() => setGroups(on ? groups.filter((x) => x !== g.id) : [...groups, g.id])}
                    className={on ? "inline-flex h-11 items-center gap-1 rounded-full bg-ink px-4 font-semibold text-surface" : "inline-flex h-11 items-center rounded-full border border-line-strong px-4 font-semibold hover:bg-canvas"}>
                    {on ? <Check className="size-4" aria-hidden /> : null}{g.name}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <Field label={t.dueOn} optional><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
          <FormError>{start.error}</FormError>
        </div>
      </Dialog>
    </>
  );
}

export function PublishRoundButton({ roundId, submitted, total }: { roundId: string; submitted: number; total: number }) {
  const t = useT().performance.evaluations;
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const publish = useAction(publishEvaluationRound, { successMessage: false, onSuccess: (r) => { setOpen(false); toast(t.published(r.notified)); } });
  return (
    <>
      <Button icon={<Send className="size-5" aria-hidden />} disabled={!submitted} onClick={() => setOpen(true)}>{t.publish}</Button>
      <ConfirmDialog open={open} onClose={() => setOpen(false)} title={t.publishTitle} confirmLabel={t.publish} danger={false}
        pending={publish.pending} error={publish.error} onConfirm={() => publish.run({ roundId })}>
        {t.publishText(submitted, total)}
      </ConfirmDialog>
    </>
  );
}

export function DeleteRoundButton({ roundId }: { roundId: string }) {
  const t = useT().performance.evaluations;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const del = useAction(deleteEvaluationRound, { onSuccess: () => router.push("/performanta/evaluari") });
  return (
    <>
      <Button variant="ghost" icon={<Trash2 className="size-5" aria-hidden />} onClick={() => setOpen(true)}>{t.deleteRound}</Button>
      <ConfirmDialog open={open} onClose={() => setOpen(false)} title={t.deleteRound} confirmLabel={t.deleteRound} pending={del.pending} error={del.error} onConfirm={() => del.run({ roundId })} />
    </>
  );
}
