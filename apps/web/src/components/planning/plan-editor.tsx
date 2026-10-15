"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, ClipboardCopy, ListPlus, Trash2, Users } from "lucide-react";
import { PROGRAM_KINDS, RTP_STAGES, label } from "@club/shared";
import { useT } from "@/messages";
import { useAction } from "@/lib/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { Badge } from "@/components/ui/status";
import { Dialog } from "@/components/ui/overlay";
import { copyYesterdayPlan, deletePlan, savePlan } from "@/app/(app)/planuri/actions";
import { CopyToDaysDialog, CopyToPlayersDialog } from "./copy-dialogs";
import { ItemsEditor } from "./items-editor";
import { SaveBar, useUnsavedWarning } from "./save-bar";
import {
  itemFromRow, itemProblem, itemToPayload,
  type ExerciseOption, type GroupOption, type ItemCompletion, type ItemRow, type PlayerOption, type ProgramTemplate,
} from "./types";

export type PlanValues = {
  id: string;
  title: string | null;
  notes: string | null;
  injury_id: string | null;
  rtp_stage: number | null;
  items: ItemRow[];
  completions: Record<string, ItemCompletion>;
};
export type InjuryChoice = { id: string; label: string; rtp_stage: number | null };

/** Editorul planului unei zile pentru un jucător. */
export function PlanEditor({ playerId, date, today, backHref, plan, exercises, templates, injuries, hasYesterday, players, groups, calendarStart, planDates }: {
  playerId: string;
  date: string;
  today: string;
  /** unde ajunge preparatorul după ștergerea planului */
  backHref: string;
  plan: PlanValues | null;
  exercises: ExerciseOption[];
  templates: ProgramTemplate[];
  injuries: InjuryChoice[];
  hasYesterday: boolean;
  players: PlayerOption[];
  groups: GroupOption[];
  calendarStart: string;
  planDates: Record<string, string[]>;
}) {
  const all = useT();
  const t = all.planning.editor;
  const c = all.planning.copy;
  const router = useRouter();

  const [v, setV] = useState(() => ({
    title: plan?.title ?? "",
    notes: plan?.notes ?? "",
    injuryId: plan?.injury_id ?? "",
    rtpStage: plan?.rtp_stage === null || plan?.rtp_stage === undefined ? "" : String(plan.rtp_stage),
  }));
  const set = (patch: Partial<typeof v>) => setV((old) => ({ ...old, ...patch }));
  const [items, setItems] = useState(() => (plan?.items ?? []).map((r) => itemFromRow(r)));
  const [problem, setProblem] = useState<string | null>(null);
  const [showProblems, setShowProblems] = useState(false);
  const [dialog, setDialog] = useState<"program" | "days" | "players" | "delete" | null>(null);
  const [replace, setReplace] = useState(false);

  const payload = useMemo(() => JSON.stringify({ ...v, items: items.map(itemToPayload) }), [v, items]);
  const [baseline] = useState(payload);
  const dirty = payload !== baseline;
  useUnsavedWarning(dirty);

  const save = useAction(savePlan, { successMessage: t.saved });
  const remove = useAction(deletePlan, { successMessage: t.deleted, refresh: false, onSuccess: () => router.push(backHref) });
  const yesterday = useAction(copyYesterdayPlan, { successMessage: t.copiedYesterday });

  const submit = () => {
    setProblem(null);
    save.clearError();
    if (!items.length && !v.notes.trim()) return setProblem(t.emptyPlan);
    if (items.some((i) => itemProblem(i))) {
      setShowProblems(true);
      return setProblem(all.planning.items.fixProblems);
    }
    void save.run({
      playerId,
      date,
      title: v.title,
      notes: v.notes,
      injuryId: v.injuryId || null,
      rtpStage: v.injuryId && v.rtpStage !== "" ? Number(v.rtpStage) : null,
      items: items.map(itemToPayload),
    });
  };

  const applyProgram = (program: ProgramTemplate) => {
    const added = program.items.map((r) => itemFromRow(r, false));
    setItems(replace ? added : [...items, ...added]);
    if (!v.title.trim()) set({ title: program.name });
    setDialog(null);
    setReplace(false);
  };

  const pickInjury = (id: string) => {
    const injury = injuries.find((i) => i.id === id);
    set({ injuryId: id, rtpStage: !id ? "" : v.rtpStage !== "" ? v.rtpStage : injury?.rtp_stage === null || injury?.rtp_stage === undefined ? "" : String(injury.rtp_stage) });
  };

  const done = plan ? plan.items.filter((i) => plan.completions[i.id]?.done).length : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-4">
          <Field label={t.planTitle} optional>
            <Input value={v.title} onChange={(e) => set({ title: e.target.value })} maxLength={120} placeholder={t.planTitlePlaceholder} autoComplete="off" />
          </Field>
          <Field label={t.notes} optional>
            <Textarea value={v.notes} onChange={(e) => set({ notes: e.target.value })} maxLength={2000} rows={2} placeholder={t.notesPlaceholder} />
          </Field>
          {injuries.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.injury} optional>
                <Select value={v.injuryId} onChange={(e) => pickInjury(e.target.value)}>
                  <option value="">{t.noInjury}</option>
                  {injuries.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
                </Select>
              </Field>
              {v.injuryId ? (
                <Field label={t.rtpStage} optional>
                  <Select value={v.rtpStage} onChange={(e) => set({ rtpStage: e.target.value })}>
                    <option value="">{t.rtpNone}</option>
                    {RTP_STAGES.map((s, i) => <option key={s} value={i}>{i + 1}. {s}</option>)}
                  </Select>
                </Field>
              ) : null}
            </div>
          ) : null}
        </CardBody>
      </Card>

      <section aria-labelledby="plan-items">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4">
          <h2 id="plan-items" className="text-lg">{t.exercises} <span className="font-normal text-ink-3">({items.length})</span></h2>
          {plan && plan.items.length ? <p className="text-sm font-semibold text-ink-2">{t.progress(done, plan.items.length)}</p> : null}
        </div>
        <ItemsEditor
          items={items}
          onChange={setItems}
          exercises={exercises}
          completions={plan ? plan.completions : undefined}
          showProblems={showProblems}
          actions={
            <>
              <Button variant="secondary" icon={<ListPlus className="size-5" aria-hidden />} onClick={() => setDialog("program")}>{t.fromProgram}</Button>
              {!plan && hasYesterday ? (
                <Button variant="secondary" pending={yesterday.pending} icon={<ClipboardCopy className="size-5" aria-hidden />}
                  onClick={() => yesterday.run({ playerId, date })}>
                  {t.copyYesterday}
                </Button>
              ) : null}
            </>
          }
        />
      </section>

      <FormError>{problem ?? save.error ?? yesterday.error}</FormError>
      <SaveBar note={dirty && !save.pending ? t.unsaved : null}>
        <Button pending={save.pending} disabled={!!plan && !dirty} onClick={submit} className="w-full sm:w-auto">{t.save}</Button>
      </SaveBar>

      {plan ? (
        <Card>
          <CardHeader title={c.title} description={dirty ? t.saveFirst : c.warning} />
          <CardBody className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={dirty} icon={<CalendarPlus className="size-5" aria-hidden />} onClick={() => setDialog("days")}>{c.toDays}</Button>
            <Button variant="secondary" disabled={dirty} icon={<Users className="size-5" aria-hidden />} onClick={() => setDialog("players")}>{c.toPlayers}</Button>
            <Button variant="ghost" icon={<Trash2 className="size-5" aria-hidden />} onClick={() => setDialog("delete")}>{t.delete}</Button>
          </CardBody>
        </Card>
      ) : null}

      <Dialog open={dialog === "program"} onClose={() => setDialog(null)} title={t.fromProgramTitle} wide>
        <p className="text-ink-3">{t.fromProgramHint}</p>
        {items.length ? <Checkbox label={t.fromProgramReplace} checked={replace} onChange={(e) => setReplace(e.target.checked)} /> : null}
        {templates.length ? (
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {templates.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-snug">{p.name}</span>
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    <Badge tone="outline">{label(PROGRAM_KINDS, p.kind)}</Badge>
                    <Badge tone="gray">{all.planning.exercises(p.items.length)}</Badge>
                    {p.is_template ? <Badge tone="gray">{all.planning.programs.template}</Badge> : null}
                  </span>
                </span>
                <Button variant="secondary" onClick={() => applyProgram(p)}>{t.use}</Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-[var(--radius-control)] bg-sunken px-4 py-6 text-center text-ink-3">{t.fromProgramNone}</p>
        )}
      </Dialog>

      {plan ? (
        <>
          <CopyToDaysDialog open={dialog === "days"} onClose={() => setDialog(null)} planId={plan.id} playerId={playerId} date={date} today={today}
            calendarStart={calendarStart} planDates={planDates} />
          <CopyToPlayersDialog open={dialog === "players"} onClose={() => setDialog(null)} planId={plan.id} playerId={playerId} date={date} today={today}
            calendarStart={calendarStart} planDates={planDates} players={players} groups={groups} />
          <Dialog open={dialog === "delete"} onClose={() => setDialog(null)} title={t.deleteTitle}
            footer={
              <>
                <Button variant="secondary" onClick={() => setDialog(null)}>{all.common.actions.cancel}</Button>
                <Button variant="danger" pending={remove.pending} onClick={() => remove.run({ planId: plan.id })}>{t.delete}</Button>
              </>
            }>
            <p>{t.deleteConfirm} {all.common.confirmDelete}</p>
          </Dialog>
        </>
      ) : null}
    </div>
  );
}
