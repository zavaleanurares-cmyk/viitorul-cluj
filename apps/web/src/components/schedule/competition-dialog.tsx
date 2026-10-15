"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { saveCompetition, type CompetitionInput } from "@/app/(app)/program/actions";

const EMPTY: CompetitionInput = { name: "", groupId: "", source: "frf", ownName: "", halfMinutes: "", yellowLimit: 3 };

export function CompetitionDialogButton({ competition, teams, clubName }: { competition?: CompetitionInput; teams: Array<{ id: string; name: string }>; clubName: string }) {
  const m = useT();
  const t = m.schedule.competitions;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<CompetitionInput>(competition ?? { ...EMPTY, ownName: clubName });
  const save = useAction(saveCompetition, { onSuccess: (r) => { setOpen(false); if (!competition) router.push(`/program/competitii/${r.id}`); } });
  return (
    <>
      {competition ? (
        <Button variant="secondary" size="sm" icon={<Pencil className="size-4" aria-hidden />} onClick={() => { setV(competition); setOpen(true); }}>{t.edit}</Button>
      ) : (
        <Button variant="primary" icon={<Plus className="size-5" aria-hidden />} onClick={() => { setV({ ...EMPTY, ownName: clubName }); setOpen(true); }}>{t.add}</Button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={competition ? t.edit : t.add}
        footer={<>
          <Button variant="ghost" onClick={() => setOpen(false)}>{m.common.actions.cancel}</Button>
          <Button variant="primary" pending={save.pending} onClick={() => save.run(v)}>{m.common.actions.save}</Button>
        </>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.fields.name} className="sm:col-span-2"><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Liga Elite U15" /></Field>
          <Field label={t.fields.team}>
            <Select value={v.groupId ?? ""} onChange={(e) => setV({ ...v, groupId: e.target.value })}>
              <option value="">—</option>
              {teams.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </Field>
          <Field label={t.fields.source}>
            <Select value={v.source} onChange={(e) => setV({ ...v, source: e.target.value as CompetitionInput["source"] })}>
              {Object.entries(t.sources).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </Select>
          </Field>
          <Field label={t.fields.ownName} hint={t.fields.ownNameHint} className="sm:col-span-2"><Input value={v.ownName ?? ""} onChange={(e) => setV({ ...v, ownName: e.target.value })} /></Field>
          <Field label={t.fields.halfMinutes} optional><Input inputMode="numeric" value={String(v.halfMinutes ?? "")} onChange={(e) => setV({ ...v, halfMinutes: e.target.value.replace(/\D/g, "").slice(0, 2) })} placeholder="45" /></Field>
          <Field label={t.fields.yellowLimit}><Input inputMode="numeric" value={String(v.yellowLimit)} onChange={(e) => setV({ ...v, yellowLimit: e.target.value.replace(/\D/g, "").slice(0, 2) })} /></Field>
        </div>
        <FormError>{save.error}</FormError>
      </Dialog>
    </>
  );
}
