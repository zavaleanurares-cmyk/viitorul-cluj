"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, Bell, ClipboardList, Pencil, Plus, Trash2, Users } from "lucide-react";
import { plural } from "@club/shared";
import { createGroup, deleteGroup, moveGroup, updateGroup } from "@/app/(app)/administrare/grupe/actions";
import { Button, IconButton } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Checkbox, Field, FormError, Input, Select } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { Badge } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { Confirm } from "./confirm";

export type GroupItem = {
  id: string;
  name: string;
  isActive: boolean;
  reminderHour: number | null;
  wellness: { sleep: boolean; stress: boolean; mood: boolean };
  coachIds: string[];
  activePlayers: number;
  totalPlayers: number;
};
export type CoachOption = { id: string; name: string; active: boolean };

const hour = (h: number) => `${String(h).padStart(2, "0")}:00`;

export function GroupsManager({ groups, coaches, clubReminderHour }: { groups: GroupItem[]; coaches: CoachOption[]; clubReminderHour: number }) {
  const t = useT().admin.groups;
  const c = useT().common;
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const add = useAction(createGroup, { onSuccess: () => { setAdding(false); setName(""); } });
  const move = useAction(moveGroup, { successMessage: false });
  const current = groups.find((g) => g.id === editing) ?? null;
  const coachName = new Map(coaches.map((x) => [x.id, x.name]));
  const extras = (g: GroupItem) => (["sleep", "stress", "mood"] as const).filter((k) => g.wellness[k]).map((k) => t.questions[k].short);

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button icon={<Plus className="size-5" aria-hidden />} onClick={() => setAdding(true)}>{t.add}</Button>
      </div>
      <ul className="space-y-3">
        {groups.map((g, i) => (
          <li key={g.id} className={cn("rounded-[var(--radius-card)] border border-line/70 bg-surface p-4 shadow-[var(--shadow-card)]", !g.isActive && "opacity-75")}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="flex flex-wrap items-center gap-2 text-xl">
                  {g.name}
                  {!g.isActive ? <Badge tone="outline">{t.inactive}</Badge> : null}
                </h2>
                <p className="mt-1 flex items-center gap-1.5 text-ink-2">
                  <Users className="size-4 shrink-0 text-ink-3" aria-hidden />
                  {plural(g.activePlayers, t.playerOne, t.playerMany)}
                </p>
                <p className="text-sm text-ink-3">
                  {g.coachIds.length ? `${t.coaches}: ${g.coachIds.map((id) => coachName.get(id)).filter(Boolean).join(", ")}` : t.noCoach}
                </p>
              </div>
              <div className="flex shrink-0">
                <IconButton label={t.moveUp(g.name)} disabled={i === 0 || move.pending} onClick={() => move.run({ id: g.id, direction: "up" })}>
                  <ArrowUp className="size-5" aria-hidden />
                </IconButton>
                <IconButton label={t.moveDown(g.name)} disabled={i === groups.length - 1 || move.pending} onClick={() => move.run({ id: g.id, direction: "down" })}>
                  <ArrowDown className="size-5" aria-hidden />
                </IconButton>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line pt-3">
              <div className="space-y-1 text-sm text-ink-2">
                <p className="flex items-center gap-1.5">
                  <ClipboardList className="size-4 shrink-0 text-ink-3" aria-hidden />
                  {extras(g).length ? t.extraOn(extras(g).join(", ")) : t.extraOff}
                </p>
                <p className="flex items-center gap-1.5">
                  <Bell className="size-4 shrink-0 text-ink-3" aria-hidden />
                  {g.reminderHour === null ? t.reminderClub(hour(clubReminderHour)) : t.reminderOwn(hour(g.reminderHour))}
                </p>
              </div>
              <Button variant="secondary" icon={<Pencil className="size-4" aria-hidden />} onClick={() => setEditing(g.id)} aria-label={t.editLabel(g.name)}>
                {c.actions.edit}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Dialog
        open={adding} onClose={() => setAdding(false)} title={t.addTitle}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdding(false)}>{c.actions.cancel}</Button>
            <Button pending={add.pending} onClick={() => add.run({ name })}>{t.add}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={t.name} hint={t.nameHint}>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          </Field>
          <FormError>{add.error}</FormError>
        </div>
      </Dialog>

      {current ? <GroupDialog key={current.id} group={current} coaches={coaches} clubReminderHour={clubReminderHour} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function GroupDialog({ group, coaches, clubReminderHour, onClose }: { group: GroupItem; coaches: CoachOption[]; clubReminderHour: number; onClose: () => void }) {
  const t = useT().admin.groups;
  const c = useT().common;
  const [name, setName] = useState(group.name);
  const [reminder, setReminder] = useState(group.reminderHour === null ? "" : String(group.reminderHour));
  const [wellness, setWellness] = useState(group.wellness);
  const [coachIds, setCoachIds] = useState(group.coachIds);
  const [isActive, setIsActive] = useState(group.isActive);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const save = useAction(updateGroup, { onSuccess: onClose });
  const remove = useAction(deleteGroup, { onSuccess: onClose });
  const lockedActive = group.isActive && group.activePlayers > 0;

  return (
    <Dialog
      open onClose={onClose} title={t.editTitle(group.name)}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{c.actions.cancel}</Button>
          <Button
            pending={save.pending}
            onClick={() => save.run({ id: group.id, name, reminderHour: reminder === "" ? null : Number(reminder), wellness, coachIds, isActive })}
          >
            {t.save}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label={t.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </Field>

        <fieldset>
          <legend className="font-bold">{t.questionsTitle}</legend>
          <p className="mb-1 text-sm text-ink-3">{t.questionsHint}</p>
          {(["sleep", "stress", "mood"] as const).map((k) => (
            <Checkbox
              key={k} label={t.questions[k].label} description={t.questions[k].description}
              checked={wellness[k]} onChange={(e) => setWellness((w) => ({ ...w, [k]: e.target.checked }))}
            />
          ))}
        </fieldset>

        <Field label={t.reminder} hint={t.reminderHint}>
          <Select value={reminder} onChange={(e) => setReminder(e.target.value)}>
            <option value="">{t.reminderDefault(hour(clubReminderHour))}</option>
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hour(h)}</option>)}
          </Select>
        </Field>

        <fieldset>
          <legend className="font-bold">{t.coachesTitle}</legend>
          <p className="mb-1 text-sm text-ink-3">{t.coachesHint}</p>
          {coaches.length ? coaches.map((x) => (
            <Checkbox
              key={x.id} label={x.name} description={x.active ? undefined : t.coachInactive}
              checked={coachIds.includes(x.id)}
              onChange={(e) => setCoachIds((v) => (e.target.checked ? [...v, x.id] : v.filter((id) => id !== x.id)))}
            />
          )) : <p className="text-sm text-ink-3">{t.noCoachAccounts}</p>}
        </fieldset>

        <fieldset className="border-t border-line pt-4">
          <legend className="sr-only">{t.activeTitle}</legend>
          <Checkbox
            label={t.activeLabel} description={lockedActive ? t.activeLocked(group.activePlayers) : t.activeHint}
            checked={isActive} disabled={lockedActive} onChange={(e) => setIsActive(e.target.checked)}
          />
          {group.totalPlayers === 0 ? (
            <Button variant="secondary" size="sm" className="mt-2 text-st-red" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setConfirmDelete(true)}>
              {t.delete}
            </Button>
          ) : <Notice tone="gray" className="mt-2 text-sm">{t.deleteNotPossible}</Notice>}
        </fieldset>
        <FormError>{save.error}</FormError>
      </div>
      <Confirm
        open={confirmDelete} onClose={() => setConfirmDelete(false)} title={t.deleteTitle(group.name)} confirmLabel={t.delete}
        pending={remove.pending} error={remove.error} onConfirm={() => remove.run({ id: group.id })}
      >
        <p>{t.deleteExplain}</p>
      </Confirm>
    </Dialog>
  );
}
