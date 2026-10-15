"use client";
import { useState } from "react";
import { BellRing, Check, FileText, Pencil, Plus, Send, X } from "lucide-react";
import { STANDARD_CONTRACTS } from "@club/shared";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { useToast } from "@/components/ui/toast";
import { useT } from "@/messages";
import { addStandardContract, remindContracts, saveContractTemplate, sendContracts, voidContract } from "@/app/(app)/club/contracte/actions";

type Kind = "enrolment" | "photo_consent" | "medical_consent" | "transport" | "sponsorship" | "other";
export type ContractTemplateRow = { id: string; name: string; kind: Kind; version: number; body: string };

export function ContractTemplates({ templates }: { templates: ContractTemplateRow[] }) {
  const t = useT().club.contracts;
  const c = useT().common;
  const [draft, setDraft] = useState<{ id: string | null; name: string; kind: Kind; body: string } | null>(null);
  const save = useAction(saveContractTemplate, { onSuccess: () => setDraft(null) });
  const std = useAction(addStandardContract);
  const has = new Set(templates.map((x) => x.name));
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button icon={<Plus className="size-5" aria-hidden />} onClick={() => setDraft({ id: null, name: "", kind: "other", body: "" })}>{t.newTemplate}</Button></div>
      {templates.length ? (
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line/70 bg-surface shadow-[var(--shadow-card)]">
          {templates.map((x) => (
            <li key={x.id} className="flex items-center gap-3 px-4 py-3">
              <FileText className="size-6 shrink-0 text-ink-3" aria-hidden />
              <span className="min-w-0 flex-1"><span className="block font-semibold">{x.name}</span><span className="block text-sm text-ink-3">{t.kinds[x.kind]} · {t.version(x.version)}</span></span>
              <IconButton label={t.editTemplate} onClick={() => setDraft({ id: x.id, name: x.name, kind: x.kind, body: x.body })}><Pencil className="size-5" aria-hidden /></IconButton>
            </li>
          ))}
        </ul>
      ) : <p className="text-ink-3">{t.noTemplates}</p>}
      <section className="space-y-2">
        <h2 className="text-lg">{t.standard}</h2>
        <p className="text-sm text-ink-3">{t.standardHint}</p>
        <ul className="grid gap-2 sm:grid-cols-3">
          {STANDARD_CONTRACTS.map((s) => (
            <li key={s.key} className="flex flex-col gap-2 rounded-[var(--radius-control)] border border-line bg-surface p-3">
              <span className="font-semibold">{s.name}</span>
              <span className="text-sm text-ink-3">{t.kinds[s.kind as Kind]}</span>
              {has.has(s.name) ? <span className="inline-flex items-center gap-1 text-sm font-semibold text-st-green"><Check className="size-4" aria-hidden />{t.added}</span> : (
                <Button size="sm" variant="secondary" className="self-start" pending={std.pending} icon={<Plus className="size-4" aria-hidden />} onClick={() => std.run({ key: s.key })}>{t.add}</Button>
              )}
            </li>
          ))}
        </ul>
        <FormError>{std.error}</FormError>
      </section>
      <Dialog open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? t.editTemplate : t.newTemplate} wide
        footer={<>
          <Button variant="ghost" onClick={() => setDraft(null)}>{c.actions.cancel}</Button>
          <Button disabled={!draft || draft.name.trim().length < 2 || draft.body.trim().length < 20} pending={save.pending} onClick={() => draft && save.run(draft)}>{c.actions.save}</Button>
        </>}>
        {draft ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
              <Field label={t.templateName}><Input value={draft.name} maxLength={120} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
              <Field label={t.kind}><Select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as Kind })}>{(Object.keys(t.kinds) as Kind[]).map((k) => <option key={k} value={k}>{t.kinds[k]}</option>)}</Select></Field>
            </div>
            <Field label={t.body} hint={t.bodyHint}><Textarea rows={16} value={draft.body} maxLength={50000} onChange={(e) => setDraft({ ...draft, body: e.target.value })} /></Field>
            {draft.id ? <p className="text-sm text-ink-3">{t.versionNote}</p> : null}
            <FormError>{save.error}</FormError>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

export function SendContractsButton({ templates, teams, players }: {
  templates: Array<{ id: string; name: string }>; teams: Array<{ id: string; name: string }>; players: Array<{ id: string; name: string; groupId: string | null }>;
}) {
  const t = useT().club.contracts;
  const c = useT().common;
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [team, setTeam] = useState(teams[0]?.id ?? "");
  const [picked, setPicked] = useState<string[]>([]);
  const [due, setDue] = useState("");
  const send = useAction(sendContracts, { successMessage: false, onSuccess: (r) => { setOpen(false); setPicked([]); toast(t.sentResult(r.sent, r.skipped.length)); } });
  const inTeam = players.filter((p) => p.groupId === team);
  const allOn = inTeam.length > 0 && inTeam.every((p) => picked.includes(p.id));
  return (
    <>
      <Button icon={<Send className="size-5" aria-hidden />} disabled={!templates.length} onClick={() => setOpen(true)}>{t.send}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t.sendTitle} wide
        footer={<>
          <Button variant="ghost" onClick={() => setOpen(false)}>{c.actions.cancel}</Button>
          <Button disabled={!templateId || !picked.length} pending={send.pending} onClick={() => send.run({ templateId, playerIds: picked, dueOn: due || null })}>{t.sendN(picked.length)}</Button>
        </>}>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t.template}><Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>{templates.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>
            <Field label={t.team}><Select value={team} onChange={(e) => setTeam(e.target.value)}>{teams.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select></Field>
            <Field label={t.dueOn} optional><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
          </div>
          <fieldset>
            <legend className="mb-1 flex w-full items-center justify-between text-sm font-semibold text-ink-2">
              {t.players}
              <button type="button" className="font-semibold text-ink underline" onClick={() => setPicked(allOn ? picked.filter((x) => !inTeam.some((p) => p.id === x)) : [...new Set([...picked, ...inTeam.map((p) => p.id)])])}>{t.selectAll}</button>
            </legend>
            <div className="flex max-h-72 flex-wrap gap-1.5 overflow-y-auto">
              {inTeam.map((p) => {
                const on = picked.includes(p.id);
                return (
                  <button key={p.id} type="button" aria-pressed={on} onClick={() => setPicked(on ? picked.filter((x) => x !== p.id) : [...picked, p.id])}
                    className={on ? "inline-flex h-10 items-center gap-1 rounded-full bg-ink px-3 text-sm font-semibold text-surface" : "inline-flex h-10 items-center rounded-full border border-line-strong px-3 text-sm font-semibold hover:bg-canvas"}>
                    {on ? <Check className="size-4" aria-hidden /> : null}{p.name}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <p className="text-sm text-ink-3">{t.signerHint}</p>
          <FormError>{send.error}</FormError>
        </div>
      </Dialog>
    </>
  );
}

export function RemindButton({ ids, label }: { ids: string[]; label: string }) {
  const t = useT().club.contracts;
  const toast = useToast();
  const remind = useAction(remindContracts, { successMessage: false, onSuccess: (r) => toast(t.reminded(r.reminded)) });
  if (!ids.length) return null;
  return <Button variant="secondary" size="sm" pending={remind.pending} icon={<BellRing className="size-4" aria-hidden />} onClick={() => remind.run({ ids })}>{label}</Button>;
}

export function VoidButton({ id }: { id: string }) {
  const t = useT().club.contracts;
  const c = useT().common;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const v = useAction(voidContract, { onSuccess: () => setOpen(false) });
  return (
    <>
      <IconButton label={t.void} onClick={() => setOpen(true)}><X className="size-5" aria-hidden /></IconButton>
      <Dialog open={open} onClose={() => setOpen(false)} title={t.voidTitle}
        footer={<>
          <Button variant="ghost" onClick={() => setOpen(false)}>{c.actions.cancel}</Button>
          <Button variant="danger" disabled={reason.trim().length < 2} pending={v.pending} onClick={() => v.run({ id, reason })}>{t.void}</Button>
        </>}>
        <Field label={t.voidReason}><Input value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} /></Field>
        <FormError>{v.error}</FormError>
      </Dialog>
    </>
  );
}
