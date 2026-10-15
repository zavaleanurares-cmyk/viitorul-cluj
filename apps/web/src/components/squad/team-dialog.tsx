"use client";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { saveTeam, type TeamInput } from "@/app/(app)/lot/actions";

const EMPTY: TeamInput = { name: "", programme: "", yearFrom: "", yearTo: "", gender: "", playersOnPitch: "", halfMinutes: "", color: "" };

/** Adaugă sau modifică o echipă (buton + fereastră). */
export function TeamDialogButton({ team }: { team?: TeamInput }) {
  const t = useT().squad.teams;
  const c = useT().common.actions;
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<TeamInput>(team ?? EMPTY);
  const set = <K extends keyof TeamInput>(k: K, value: TeamInput[K]) => setV((s) => ({ ...s, [k]: value }));
  const save = useAction(saveTeam, { onSuccess: () => setOpen(false) });
  const num = (s: string) => s.replace(/\D/g, "").slice(0, 4);

  return (
    <>
      {team ? (
        <Button variant="ghost" size="sm" icon={<Pencil className="size-4" aria-hidden />} onClick={() => { setV(team); setOpen(true); }} aria-label={`${t.edit}: ${team.name}`}>
          {t.edit}
        </Button>
      ) : (
        <Button variant="primary" icon={<Plus className="size-5" aria-hidden />} onClick={() => { setV(EMPTY); setOpen(true); }}>{t.add}</Button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={team ? t.edit : t.add}
        footer={<>
          <Button variant="ghost" onClick={() => setOpen(false)}>{c.cancel}</Button>
          <Button variant="primary" pending={save.pending} onClick={() => save.run(v)}>{team ? t.save : t.add}</Button>
        </>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.fields.name}><Input value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="U15" /></Field>
          <Field label={t.fields.programme} hint={t.fields.programmeHint} optional><Input value={v.programme ?? ""} onChange={(e) => set("programme", e.target.value)} /></Field>
          <Field label={t.fields.yearFrom} optional><Input inputMode="numeric" value={String(v.yearFrom ?? "")} onChange={(e) => set("yearFrom", num(e.target.value))} placeholder="2011" /></Field>
          <Field label={t.fields.yearTo} optional><Input inputMode="numeric" value={String(v.yearTo ?? "")} onChange={(e) => set("yearTo", num(e.target.value))} placeholder="2012" /></Field>
          <Field label={t.fields.gender} optional>
            <Select value={v.gender ?? ""} onChange={(e) => set("gender", e.target.value as TeamInput["gender"])}>
              <option value="">—</option>
              {Object.entries(t.genders).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </Select>
          </Field>
          <Field label={t.fields.playersOnPitch} optional>
            <Select value={String(v.playersOnPitch ?? "")} onChange={(e) => set("playersOnPitch", e.target.value)}>
              <option value="">—</option>
              {[5, 7, 9, 11].map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
          </Field>
          <Field label={t.fields.halfMinutes} optional><Input inputMode="numeric" value={String(v.halfMinutes ?? "")} onChange={(e) => set("halfMinutes", num(e.target.value).slice(0, 2))} placeholder="35" /></Field>
          <Field label={t.fields.color} optional>
            <Input type="color" className="h-12 p-1" value={v.color || "#1d5fbf"} onChange={(e) => set("color", e.target.value)} />
          </Field>
        </div>
        <p className="mt-3 text-sm text-ink-3">{t.coachesHint}</p>
        <FormError>{save.error}</FormError>
      </Dialog>
    </>
  );
}
