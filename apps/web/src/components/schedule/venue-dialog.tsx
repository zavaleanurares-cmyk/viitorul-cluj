"use client";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Checkbox, Field, FormError, Input, Select } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { saveVenue, type VenueInput } from "@/app/(app)/program/actions";

const EMPTY: VenueInput = { name: "", address: "", surface: "", hasLights: false, isOwn: true, parentId: "" };

export function VenueDialogButton({ venue, parents }: { venue?: VenueInput; parents: Array<{ id: string; name: string }> }) {
  const m = useT();
  const t = m.schedule.venues;
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<VenueInput>(venue ?? EMPTY);
  const save = useAction(saveVenue, { onSuccess: () => setOpen(false) });
  return (
    <>
      {venue ? (
        <Button variant="ghost" size="sm" icon={<Pencil className="size-4" aria-hidden />} aria-label={`${t.edit}: ${venue.name}`} onClick={() => { setV(venue); setOpen(true); }}>{t.edit}</Button>
      ) : (
        <Button variant="primary" icon={<Plus className="size-5" aria-hidden />} onClick={() => { setV(EMPTY); setOpen(true); }}>{t.add}</Button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={venue ? t.edit : t.add}
        footer={<>
          <Button variant="ghost" onClick={() => setOpen(false)}>{m.common.actions.cancel}</Button>
          <Button variant="primary" pending={save.pending} onClick={() => save.run(v)}>{m.common.actions.save}</Button>
        </>}>
        <div className="grid gap-3">
          <Field label={t.fields.name}><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Teren 1" /></Field>
          <Field label={t.fields.address} optional><Input value={v.address ?? ""} onChange={(e) => setV({ ...v, address: e.target.value })} /></Field>
          <Field label={t.fields.surface} optional>
            <Select value={v.surface ?? ""} onChange={(e) => setV({ ...v, surface: e.target.value as VenueInput["surface"] })}>
              <option value="">—</option>
              {Object.entries(t.surfaces).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </Select>
          </Field>
          <Field label={t.fields.parent} optional>
            <Select value={v.parentId ?? ""} onChange={(e) => setV({ ...v, parentId: e.target.value })}>
              <option value="">{t.noParent}</option>
              {parents.filter((p) => p.id !== v.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Checkbox checked={v.hasLights} onChange={(e) => setV({ ...v, hasLights: e.target.checked })} label={t.fields.lights} />
          <Checkbox checked={v.isOwn} onChange={(e) => setV({ ...v, isOwn: e.target.checked })} label={t.fields.own} />
        </div>
        <FormError>{save.error}</FormError>
      </Dialog>
    </>
  );
}
