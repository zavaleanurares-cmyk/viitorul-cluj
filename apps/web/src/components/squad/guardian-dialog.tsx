"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Mail, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { deleteGuardian, inviteGuardian, restoreGuardian, saveGuardian, type GuardianInput } from "@/app/(app)/lot/actions";

type PlayerOption = { id: string; name: string; team: string | null };
type Child = GuardianInput["children"][number];

export function GuardianDialogButton({ guardian, players, hasAccount, autoOpen, presetChild }: {
  guardian?: GuardianInput; players: PlayerOption[]; hasAccount?: boolean; autoOpen?: boolean; presetChild?: string;
}) {
  const t = useT().squad.guardians;
  const c = useT().common.actions;
  const router = useRouter();
  const toast = useToast();
  const blank: GuardianInput = { fullName: "", phone: "", email: "", notes: "", children: presetChild ? [{ playerId: presetChild, relation: "parent", isBilling: true }] : [] };
  const [open, setOpen] = useState(!!autoOpen);
  const [v, setV] = useState<GuardianInput>(guardian ?? blank);
  const [pick, setPick] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const save = useAction(saveGuardian, { onSuccess: () => setOpen(false) });
  const invite = useAction(inviteGuardian, { onSuccess: (r) => { if (!r.emailed) setLink(r.link); } });
  const remove = useAction(deleteGuardian, { successMessage: false, onSuccess: () => {
    setOpen(false);
    toast(t.deleted, "ok", { undo: async () => { await restoreGuardian(guardian!.id!); router.refresh(); } });
  } });
  const name = (id: string) => players.find((p) => p.id === id)?.name ?? id;
  const setChild = (i: number, patch: Partial<Child>) => setV((s) => ({ ...s, children: s.children.map((ch, k) => (k === i ? { ...ch, ...patch } : ch)) }));
  const available = players.filter((p) => !v.children.some((ch) => ch.playerId === p.id));

  return (
    <>
      {guardian ? (
        <Button variant="ghost" size="sm" icon={<Pencil className="size-4" aria-hidden />} aria-label={`${t.edit}: ${guardian.fullName}`}
          onClick={() => { setV(guardian); setLink(null); setOpen(true); }}>{t.edit}</Button>
      ) : (
        <Button variant="primary" icon={<Plus className="size-5" aria-hidden />} onClick={() => { setV(blank); setOpen(true); }}>{t.add}</Button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={guardian ? t.edit : t.add} wide
        footer={<>
          {guardian?.id ? <Button variant="ghost" className="mr-auto" pending={remove.pending} icon={<Trash2 className="size-5" aria-hidden />} onClick={() => remove.run(guardian.id!)}>{t.delete}</Button> : null}
          <Button variant="ghost" onClick={() => setOpen(false)}>{c.cancel}</Button>
          <Button variant="primary" pending={save.pending} onClick={() => save.run(v)}>{c.save}</Button>
        </>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.fields.name} className="sm:col-span-2"><Input value={v.fullName} onChange={(e) => setV({ ...v, fullName: e.target.value })} autoComplete="off" /></Field>
          <Field label={t.fields.phone} optional><Input type="tel" value={v.phone ?? ""} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
          <Field label={t.fields.email} optional><Input type="email" value={v.email ?? ""} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
        </div>

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-semibold text-ink-2">{t.fields.children}</legend>
          {v.children.length === 0 ? <p className="mb-2 text-ink-3">{t.noChildren}</p> : (
            <ul className="mb-2 divide-y divide-line rounded-[var(--radius-control)] border border-line">
              {v.children.map((ch, i) => (
                <li key={ch.playerId} className="flex flex-wrap items-center gap-2 p-2">
                  <span className="min-w-40 flex-1 font-semibold">{name(ch.playerId)}</span>
                  <label className="sr-only" htmlFor={`rel-${ch.playerId}`}>{t.fields.relation}</label>
                  <Select id={`rel-${ch.playerId}`} className="w-36" value={ch.relation} onChange={(e) => setChild(i, { relation: e.target.value as Child["relation"] })}>
                    {Object.entries(t.relations).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                  </Select>
                  <Checkbox className="min-h-0 py-0" checked={ch.isBilling} onChange={(e) => setChild(i, { isBilling: e.target.checked })} label={t.fields.billing} />
                  <button type="button" aria-label={t.removeChild(name(ch.playerId))} onClick={() => setV({ ...v, children: v.children.filter((_, k) => k !== i) })}
                    className="inline-flex size-11 items-center justify-center rounded-lg hover:bg-sunken"><X className="size-5" aria-hidden /></button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="pick-child">{t.chooseChild}</label>
            <Select id="pick-child" value={pick} onChange={(e) => setPick(e.target.value)} className="flex-1">
              <option value="">{t.chooseChild}</option>
              {available.map((p) => <option key={p.id} value={p.id}>{p.name}{p.team ? ` · ${p.team}` : ""}</option>)}
            </Select>
            <Button variant="secondary" disabled={!pick} onClick={() => { setV({ ...v, children: [...v.children, { playerId: pick, relation: "parent", isBilling: v.children.length === 0 }] }); setPick(""); }}>{t.addChild}</Button>
          </div>
        </fieldset>

        <Field label={t.fields.notes} optional className="mt-4"><Textarea value={v.notes ?? ""} onChange={(e) => setV({ ...v, notes: e.target.value })} /></Field>

        {guardian?.id ? (
          <div className="mt-4 rounded-[var(--radius-control)] bg-st-blue-soft p-3">
            <p className="font-semibold">{hasAccount ? t.hasAccount : t.noAccount}</p>
            <Button variant="secondary" className="mt-2" icon={<Mail className="size-5" aria-hidden />} pending={invite.pending} disabled={!v.email}
              onClick={() => invite.run(guardian.id!)}>{t.invite}</Button>
            {!v.email ? <p className="mt-1 text-sm text-ink-2">{t.inviteNeedsEmail}</p> : null}
            {link ? (
              <Field label={t.inviteLink} className="mt-3"><Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} /></Field>
            ) : null}
          </div>
        ) : null}
        <FormError>{save.error ?? invite.error}</FormError>
      </Dialog>
    </>
  );
}
