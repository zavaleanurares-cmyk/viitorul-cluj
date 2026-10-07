"use client";
import { useMemo, useState } from "react";
import { FEET, POSITIONS, norm, type Group } from "@club/shared";
import { createPlayer, updatePlayer } from "@/app/(app)/jucatori/actions";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";

export type PlayerFormValues = {
  fullName: string; displayName: string; groupId: string; birthDate: string; position: string;
  positionDetail: string; foot: string; shirtNumber: string; visaExpiresOn: string;
};
export type KnownPlayer = { id: string; full_name: string; display_name: string; group_id: string | null };

const EMPTY: PlayerFormValues = {
  fullName: "", displayName: "", groupId: "", birthDate: "", position: "", positionDetail: "", foot: "", shirtNumber: "", visaExpiresOn: "",
};

/** Numele scurt propus: primul cuvânt, cu majuscule (cum scrie staff-ul în tabele). Rămâne editabil. */
function suggestDisplayName(fullName: string): string {
  return (fullName.trim().split(/\s+/)[0] ?? "").toLocaleUpperCase("ro");
}

/** Adăugare / modificare jucător. Numele nu este cheie: duplicatele doar avertizează. */
export function PlayerFormDialog({ open, onClose, groups, known, playerId, initial, defaultGroupId, today, onCreated }: {
  open: boolean; onClose: () => void; groups: Group[]; known: KnownPlayer[]; playerId?: string;
  initial?: PlayerFormValues; defaultGroupId?: string; today: string; onCreated?: (id: string) => void;
}) {
  if (!open) return null;
  return (
    <Form
      onClose={onClose} groups={groups} known={known} playerId={playerId} today={today} onCreated={onCreated}
      initial={initial ?? { ...EMPTY, groupId: defaultGroupId ?? "" }}
    />
  );
}

function Form({ onClose, groups, known, playerId, initial, today, onCreated }: {
  onClose: () => void; groups: Group[]; known: KnownPlayer[]; playerId?: string; initial: PlayerFormValues; today: string;
  onCreated?: (id: string) => void;
}) {
  const t = useT().players.form;
  const c = useT().common;
  const editing = !!playerId;
  const [v, setV] = useState<PlayerFormValues>(initial);
  const [displayTouched, setDisplayTouched] = useState(editing);
  const set = <K extends keyof PlayerFormValues>(k: K, value: PlayerFormValues[K]) => setV((s) => ({ ...s, [k]: value }));

  const create = useAction(createPlayer, { onSuccess: (d) => { onClose(); onCreated?.(d.id); } });
  const update = useAction(updatePlayer, { onSuccess: onClose });
  const pending = create.pending || update.pending;
  const error = create.error ?? update.error;

  const duplicate = useMemo(() => {
    const full = norm(v.fullName);
    const display = norm(v.displayName);
    if (!full && !display) return null;
    return known.find(
      (k) => k.id !== playerId && (k.group_id ?? "") === v.groupId &&
        ((full && norm(k.full_name) === full) || (display && norm(k.display_name) === display)),
    ) ?? null;
  }, [known, playerId, v.fullName, v.displayName, v.groupId]);

  const submit = () => {
    const payload = {
      fullName: v.fullName, displayName: v.displayName, groupId: v.groupId, birthDate: v.birthDate, position: v.position,
      positionDetail: v.positionDetail, foot: v.foot, shirtNumber: v.shirtNumber.trim() ? Number(v.shirtNumber) : null,
      visaExpiresOn: v.visaExpiresOn,
    };
    if (playerId) update.run({ playerId, ...payload });
    else create.run(payload);
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={editing ? t.editTitle : t.addTitle}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{c.actions.cancel}</Button>
          <Button pending={pending} onClick={submit}>{editing ? t.save : t.create}</Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label={t.fullName} hint={t.fullNameHint}>
          <Input
            value={v.fullName} required maxLength={120} autoComplete="off"
            onChange={(e) => {
              const fullName = e.target.value;
              setV((s) => ({ ...s, fullName, displayName: displayTouched ? s.displayName : suggestDisplayName(fullName) }));
            }}
          />
        </Field>
        <Field label={t.displayName} hint={t.displayNameHint}>
          <Input
            value={v.displayName} required maxLength={60} autoComplete="off"
            onChange={(e) => { setDisplayTouched(true); set("displayName", e.target.value); }}
          />
        </Field>
        <Field label={t.group} hint={editing && v.groupId !== initial.groupId ? t.groupMoveHint : undefined}>
          <Select value={v.groupId} onChange={(e) => set("groupId", e.target.value)}>
            <option value="">{t.noGroup}</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
        </Field>
        {duplicate ? (
          <Notice tone="yellow">
            {t.duplicate(duplicate.display_name, groups.find((g) => g.id === duplicate.group_id)?.name ?? t.duplicateNoGroup)}
          </Notice>
        ) : null}
        <div className="grid grid-cols-2 gap-4">
          <Field label={t.birthDate} optional>
            <Input type="date" value={v.birthDate} max={today} onChange={(e) => set("birthDate", e.target.value)} />
          </Field>
          <Field label={t.shirtNumber} optional>
            <Input type="number" inputMode="numeric" min={1} max={99} value={v.shirtNumber} onChange={(e) => set("shirtNumber", e.target.value)} />
          </Field>
          <Field label={t.position} optional>
            <Select value={v.position} onChange={(e) => set("position", e.target.value)}>
              <option value="">{t.positionNone}</option>
              {Object.entries(POSITIONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          </Field>
          <Field label={t.foot} optional>
            <Select value={v.foot} onChange={(e) => set("foot", e.target.value)}>
              <option value="">{t.footNone}</option>
              {Object.entries(FEET).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </Select>
          </Field>
        </div>
        <Field label={t.positionDetail} optional>
          <Input value={v.positionDetail} maxLength={80} placeholder={t.positionDetailPlaceholder} onChange={(e) => set("positionDetail", e.target.value)} />
        </Field>
        <Field label={t.visa} optional>
          <Input type="date" value={v.visaExpiresOn} onChange={(e) => set("visaExpiresOn", e.target.value)} />
        </Field>
        <FormError>{error}</FormError>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
