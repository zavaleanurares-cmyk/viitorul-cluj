"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { AVAILABILITY_LABELS, plural, type Availability, type StatusTone } from "@club/shared";
import { createStatus, deleteStatus, moveStatus, updateStatus } from "@/app/(app)/administrare/stari/actions";
import { Button, IconButton } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input, Select } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { Badge, StatusChip, StatusIcon, TONE_SOLID } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { Confirm } from "./confirm";

export type StatusItem = {
  id: string; code: string; label: string; shortLabel: string; tone: StatusTone; icon: string;
  availability: Availability; isActive: boolean; isDefault: boolean; playersNow: number; used: boolean;
};

const TONES: StatusTone[] = ["green", "yellow", "orange", "red", "gray", "blue"];
const ICONS = ["check", "battery", "activity", "cross", "help", "circle", "alert"] as const;
type IconKey = (typeof ICONS)[number];

export function StatusesManager({ statuses }: { statuses: StatusItem[] }) {
  const t = useT().admin.statuses;
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const move = useAction(moveStatus, { successMessage: false });
  const current = statuses.find((s) => s.id === editing) ?? null;

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button icon={<Plus className="size-5" aria-hidden />} onClick={() => setEditing("new")}>{t.add}</Button>
      </div>
      <ul className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        {statuses.map((s, i) => (
          <li key={s.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line py-3 pl-4 pr-2 last:border-b-0", !s.isActive && "bg-canvas")}>
            <div className="shrink-0 sm:w-36"><StatusChip status={{ label: s.label, short_label: s.shortLabel, tone: s.tone, icon: s.icon }} /></div>
            <div className="order-last min-w-0 basis-full sm:order-none sm:flex-1 sm:basis-40">
              <p className="flex flex-wrap items-center gap-2 font-bold">
                {s.label}
                {!s.isActive ? <Badge tone="outline">{t.inactive}</Badge> : null}
              </p>
              <p className="text-sm text-ink-3">
                {AVAILABILITY_LABELS[s.availability]} · {s.playersNow ? t.playersNow(s.playersNow) : t.noPlayersNow}
              </p>
            </div>
            <div className="ml-auto flex shrink-0 items-center">
              <IconButton label={t.moveUp(s.label)} disabled={i === 0 || move.pending} onClick={() => move.run({ id: s.id, direction: "up" })}>
                <ArrowUp className="size-5" aria-hidden />
              </IconButton>
              <IconButton label={t.moveDown(s.label)} disabled={i === statuses.length - 1 || move.pending} onClick={() => move.run({ id: s.id, direction: "down" })}>
                <ArrowDown className="size-5" aria-hidden />
              </IconButton>
              <IconButton label={t.editLabel(s.label)} onClick={() => setEditing(s.id)}>
                <Pencil className="size-5" aria-hidden />
              </IconButton>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-ink-3">{t.defaultCodesNote}</p>

      {editing === "new" ? <StatusDialog status={null} onClose={() => setEditing(null)} /> : null}
      {current ? <StatusDialog key={current.id} status={current} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function StatusDialog({ status, onClose }: { status: StatusItem | null; onClose: () => void }) {
  const t = useT().admin.statuses;
  const c = useT().common;
  const [label, setLabel] = useState(status?.label ?? "");
  const [shortLabel, setShortLabel] = useState(status?.shortLabel ?? "");
  const [tone, setTone] = useState<StatusTone>(status?.tone ?? "blue");
  const [icon, setIcon] = useState<IconKey>((ICONS as readonly string[]).includes(status?.icon ?? "") ? (status!.icon as IconKey) : "circle");
  const [availability, setAvailability] = useState<Availability>(status?.availability ?? "limited");
  const [isActive, setIsActive] = useState(status?.isActive ?? true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const create = useAction(createStatus, { onSuccess: onClose });
  const save = useAction(updateStatus, { onSuccess: onClose });
  const remove = useAction(deleteStatus, { onSuccess: onClose });
  const fields = { label, shortLabel, tone, icon, availability };
  const pending = create.pending || save.pending;

  return (
    <Dialog
      open onClose={onClose} title={status ? t.editTitle(status.label) : t.addTitle}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{c.actions.cancel}</Button>
          <Button pending={pending} onClick={() => (status ? save.run({ id: status.id, isActive, ...fields }) : create.run(fields))}>
            {status ? t.save : t.add}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] bg-canvas p-3">
          <span className="text-sm font-semibold text-ink-3">{t.preview}</span>
          <StatusChip size="lg" status={{ label: label || "…", short_label: shortLabel || "…", tone, icon }} />
          <StatusChip status={{ label: label || "…", short_label: shortLabel || "…", tone, icon }} full />
          <StatusChip size="sm" status={{ label: label || "…", short_label: shortLabel || "…", tone, icon }} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t.label} hint={t.labelHint}>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} />
          </Field>
          <Field label={t.shortLabel} hint={t.shortLabelHint}>
            <Input value={shortLabel} onChange={(e) => setShortLabel(e.target.value.toLocaleUpperCase("ro"))} maxLength={14} />
          </Field>
        </div>

        <fieldset>
          <legend className="mb-1 text-sm font-semibold text-ink-2">{t.tone}</legend>
          <div role="radiogroup" aria-label={t.tone} className="grid grid-cols-3 gap-2">
            {TONES.map((x) => (
              <button
                key={x} type="button" role="radio" aria-checked={tone === x} onClick={() => setTone(x)}
                className={cn("h-12 rounded-[var(--radius-control)] font-semibold", TONE_SOLID[x], tone === x ? "ring-4 ring-ink ring-offset-2" : "opacity-80")}
              >
                {t.tones[x]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1 text-sm font-semibold text-ink-2">{t.icon}</legend>
          <div role="radiogroup" aria-label={t.icon} className="flex flex-wrap gap-2">
            {ICONS.map((x) => (
              <button
                key={x} type="button" role="radio" aria-checked={icon === x} aria-label={t.icons[x]} title={t.icons[x]} onClick={() => setIcon(x)}
                className={cn("inline-flex size-12 items-center justify-center rounded-[var(--radius-control)] border", icon === x ? "border-ink bg-ink text-white" : "border-line-strong bg-surface hover:bg-canvas")}
              >
                <StatusIcon icon={x} className="size-6" />
              </button>
            ))}
          </div>
        </fieldset>

        <Field label={t.availability} hint={t.availabilityHint}>
          <Select value={availability} onChange={(e) => setAvailability(e.target.value as Availability)}>
            {(["full", "limited", "out"] as const).map((a) => <option key={a} value={a}>{AVAILABILITY_LABELS[a]} — {t.availabilityExplain[a]}</option>)}
          </Select>
        </Field>

        {status ? (
          <div className="space-y-2 border-t border-line pt-4">
            <p className="text-sm text-ink-3">{t.code}: <code className="font-mono font-semibold text-ink">{status.code}</code>{status.isDefault ? ` — ${t.codeDefault}` : ""}</p>
            {status.isDefault ? null : (
              <>
                <Checkbox
                  label={t.activeLabel}
                  description={status.playersNow ? t.activeHintUsed(plural(status.playersNow, t.playerOne, t.playerMany)) : t.activeHint}
                  checked={isActive} onChange={(e) => setIsActive(e.target.checked)}
                />
                {status.used ? <p className="text-sm text-ink-3">{t.deleteNotPossible}</p> : (
                  <Button variant="secondary" size="sm" className="text-st-red" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setConfirmDelete(true)}>
                    {t.delete}
                  </Button>
                )}
              </>
            )}
          </div>
        ) : <p className="text-sm text-ink-3">{t.codeGenerated}</p>}
        <FormError>{create.error ?? save.error}</FormError>
      </div>
      {status ? (
        <Confirm
          open={confirmDelete} onClose={() => setConfirmDelete(false)} title={t.deleteTitle(status.label)} confirmLabel={t.delete}
          pending={remove.pending} error={remove.error} onConfirm={() => remove.run({ id: status.id })}
        >
          <p>{t.deleteExplain}</p>
        </Confirm>
      ) : null}
    </Dialog>
  );
}
