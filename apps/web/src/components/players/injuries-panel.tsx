"use client";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { formatDate, formatDateShort, type ClubStatus } from "@club/shared";
import { addTreatment, deleteInjury, deleteTreatment } from "@/app/(app)/jucatori/[id]/medical/actions";
import { Button, IconButton } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { FormError, Input } from "@/components/ui/form";
import { Badge } from "@/components/ui/status";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { ConfirmDialog } from "./confirm-dialog";
import { fitStatus, injuredStatus, injuryIsActive, injuryZoneText } from "./domain";
import { InjuryDialog } from "./injury-dialog";
import { InjuryFacts } from "./injury-view";
import type { InjuryWithTreatments, Treatment } from "./queries";

/** Lista accidentărilor unui jucător (active sus), cu tratamente. Preparatorul adaugă / modifică / șterge. */
export function InjuriesPanel({ playerId, injuries, statuses, canManage, today, playerIsFit }: {
  playerId: string; injuries: InjuryWithTreatments[]; statuses: ClubStatus[]; canManage: boolean; today: string; playerIsFit: boolean;
}) {
  const t = useT().players.medical;
  const [editing, setEditing] = useState<InjuryWithTreatments | "new" | null>(null);
  const [deleting, setDeleting] = useState<InjuryWithTreatments | null>(null);
  const remove = useAction(deleteInjury, { onSuccess: () => setDeleting(null) });

  const sorted = [...injuries].sort(
    (a, b) => Number(injuryIsActive(b)) - Number(injuryIsActive(a)) || b.occurred_on.localeCompare(a.occurred_on),
  );
  const byId = new Map(injuries.map((i) => [i.id, i]));
  const current = editing && editing !== "new" ? editing : null;
  const otherActive = injuries.some((i) => injuryIsActive(i) && i.id !== current?.id);

  return (
    <section aria-labelledby="injuries-title">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 id="injuries-title" className="text-lg">{t.listTitle}</h2>
        {canManage ? (
          <Button icon={<Plus className="size-5" aria-hidden />} onClick={() => setEditing("new")}>{t.add}</Button>
        ) : null}
      </div>

      {!sorted.length ? (
        <EmptyState title={t.emptyTitle} description={canManage ? t.emptyPhysio : t.emptyCoach} />
      ) : (
        <ul className="space-y-3">
          {sorted.map((injury) => {
            const active = injuryIsActive(injury);
            const zone = injuryZoneText(injury) || t.zoneUnknown;
            return (
              <li key={injury.id}>
                <Card className="overflow-hidden">
                  <header className="flex items-start gap-2 border-b border-line py-2 pl-4 pr-2">
                    <div className="min-w-0 flex-1 py-1">
                      <h3 className="text-[1.0625rem] leading-snug">{zone}</h3>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-3">
                        <Badge tone={active ? "red" : "gray"}>{active ? t.active : t.closed}</Badge>
                        <span>{formatDate(injury.occurred_on)}</span>
                      </p>
                    </div>
                    {canManage ? (
                      <div className="flex shrink-0">
                        <IconButton label={`${t.edit}: ${zone}`} onClick={() => setEditing(injury)}><Pencil className="size-5" aria-hidden /></IconButton>
                        <IconButton label={`${t.delete}: ${zone}`} onClick={() => setDeleting(injury)}><Trash2 className="size-5" aria-hidden /></IconButton>
                      </div>
                    ) : null}
                  </header>
                  <div className="grid gap-x-8 gap-y-4 p-4 lg:grid-cols-2">
                    <InjuryFacts injury={injury} previous={injury.recurrence_of ? byId.get(injury.recurrence_of) : null} today={today} />
                    <Treatments injuryId={injury.id} treatments={injury.injury_treatments} canManage={canManage} today={today} />
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {canManage ? (
        <>
          <InjuryDialog
            open={!!editing}
            playerId={playerId}
            injury={current}
            others={injuries}
            today={today}
            injuredLabel={injuredStatus(statuses)?.short_label ?? null}
            fitLabel={fitStatus(statuses)?.short_label ?? null}
            suggestFit={!playerIsFit && !otherActive}
            onClose={() => setEditing(null)}
          />
          <ConfirmDialog
            open={!!deleting}
            onClose={() => setDeleting(null)}
            title={t.deleteTitle}
            confirmLabel={t.delete}
            pending={remove.pending}
            error={remove.error}
            onConfirm={() => deleting && remove.run({ id: deleting.id })}
          >
            {deleting ? <p className="font-semibold text-ink">{injuryZoneText(deleting) || t.zoneUnknown}, {formatDateShort(deleting.occurred_on)}</p> : null}
            <p>{t.deleteBody}</p>
          </ConfirmDialog>
        </>
      ) : null}
    </section>
  );
}

function Treatments({ injuryId, treatments, canManage, today }: {
  injuryId: string; treatments: Treatment[]; canManage: boolean; today: string;
}) {
  const t = useT().players.medical;
  const c = useT().common;
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState(today);
  const [text, setText] = useState("");
  const add = useAction(addTreatment, { onSuccess: () => { setText(""); setAdding(false); } });
  const remove = useAction(deleteTreatment);

  return (
    <div>
      <h4 className="mb-1 text-sm font-semibold text-ink-3">{t.showTreatments(treatments.length)}</h4>
      {treatments.length ? (
        <ul className="divide-y divide-line border-y border-line">
          {treatments.map((tr) => (
            <li key={tr.id} className="flex items-start gap-2 py-1.5">
              <span className="w-16 shrink-0 pt-0.5 text-sm font-semibold text-ink-3">{formatDateShort(tr.treated_on, false)}</span>
              <span className="min-w-0 flex-1 whitespace-pre-line">{tr.description}</span>
              {canManage ? (
                <IconButton
                  label={`${t.treatmentDelete}: ${formatDateShort(tr.treated_on)}`}
                  className="-my-1 size-10 text-ink-3"
                  disabled={remove.pending}
                  onClick={() => remove.run({ id: tr.id })}
                >
                  <Trash2 className="size-4" aria-hidden />
                </IconButton>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-3">{t.treatmentsEmpty}</p>
      )}
      {canManage ? (
        adding ? (
          <form
            className="mt-3 space-y-2"
            onSubmit={(e) => { e.preventDefault(); add.run({ injuryId, treatedOn: date, description: text }); }}
          >
            <div className="grid grid-cols-[9.5rem_minmax(0,1fr)] gap-2">
              <Input type="date" aria-label={t.treatmentDate} required value={date} max={today} onChange={(e) => setDate(e.target.value)} />
              <Input aria-label={t.treatmentDescription} required autoFocus maxLength={1000} value={text} placeholder={t.treatmentPlaceholder} onChange={(e) => setText(e.target.value)} />
            </div>
            <FormError>{add.error}</FormError>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" className="h-10" onClick={() => { setAdding(false); add.clearError(); }}>{c.actions.cancel}</Button>
              <Button type="submit" variant="secondary" size="sm" className="h-10" pending={add.pending} disabled={text.trim().length < 2}>{t.treatmentSave}</Button>
            </div>
          </form>
        ) : (
          <Button variant="secondary" size="sm" className="mt-3 h-10" icon={<Plus className="size-4" aria-hidden />} onClick={() => setAdding(true)}>
            {t.treatmentAdd}
          </Button>
        )
      ) : null}
    </div>
  );
}
