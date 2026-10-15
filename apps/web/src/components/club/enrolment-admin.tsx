"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, CalendarPlus, Check, Copy, FileSignature, Mail, MessageSquarePlus, Pencil, Plus, RotateCcw, Star, UserCheck } from "lucide-react";
import { formatLei } from "@club/shared";
import { Button, LinkButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { cn } from "@/lib/cn";
import { addNote, bookTrial, closeRequest, createRequest, enrol, groupFee, recordTrial, reopenRequest, updateRequest, type RequestInput } from "@/app/(app)/club/inscrieri/actions";
import { inviteGuardian } from "@/app/(app)/lot/actions";
import { sendContracts } from "@/app/(app)/club/contracte/actions";

type Group = { id: string; name: string };
const blank: RequestInput = { childName: "", birthDate: "", groupId: "", previousClub: "", position: "", notes: "", parentName: "", relation: "parent", email: "", phone: "" };

/** Câmpurile cererii, comune formularului public și celui din birou. */
export function RequestFields({ v, set, groups }: { v: RequestInput; set: (patch: Partial<RequestInput>) => void; groups: Group[] }) {
  const t = useT().club.enrolment;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <Field label={t.fields.childName}><Input value={v.childName} maxLength={120} autoComplete="off" onChange={(e) => set({ childName: e.target.value })} /></Field>
        <Field label={t.fields.birthDate}><Input type="date" value={v.birthDate} onChange={(e) => set({ birthDate: e.target.value })} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t.fields.team} optional>
          <Select value={v.groupId ?? ""} onChange={(e) => set({ groupId: e.target.value })}>
            <option value="">{t.fields.teamSuggested}</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </Select>
        </Field>
        <Field label={t.fields.position} optional>
          <Select value={v.position ?? ""} onChange={(e) => set({ position: e.target.value as RequestInput["position"] })}>
            <option value="">—</option>
            {(Object.keys(t.positions) as Array<keyof typeof t.positions>).map((k) => <option key={k} value={k}>{t.positions[k]}</option>)}
          </Select>
        </Field>
        <Field label={t.fields.previousClub} optional><Input value={v.previousClub ?? ""} maxLength={120} onChange={(e) => set({ previousClub: e.target.value })} /></Field>
      </div>
      <Field label={t.fields.notes} hint={t.fields.notesHint} optional><Textarea rows={2} value={v.notes ?? ""} maxLength={1000} onChange={(e) => set({ notes: e.target.value })} /></Field>
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <Field label={t.fields.parentName}><Input value={v.parentName} maxLength={120} autoComplete="off" onChange={(e) => set({ parentName: e.target.value })} /></Field>
        <Field label={t.fields.relation}>
          <Select value={v.relation} onChange={(e) => set({ relation: e.target.value as RequestInput["relation"] })}>
            {(Object.keys(t.relations) as Array<keyof typeof t.relations>).map((k) => <option key={k} value={k}>{t.relations[k]}</option>)}
          </Select>
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.fields.email} hint={t.fields.contactHint}><Input type="email" value={v.email ?? ""} maxLength={200} autoComplete="off" onChange={(e) => set({ email: e.target.value })} /></Field>
        <Field label={t.fields.phone}><Input type="tel" value={v.phone ?? ""} maxLength={20} autoComplete="off" onChange={(e) => set({ phone: e.target.value })} /></Field>
      </div>
    </div>
  );
}

export function RequestFormButton({ groups, request }: { groups: Group[]; request?: RequestInput & { id: string } }) {
  const t = useT().club.enrolment;
  const c = useT().common;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<RequestInput>(request ?? blank);
  const create = useAction(createRequest, { onSuccess: (r) => { setOpen(false); router.push(`/club/inscrieri/${r.id}`); } });
  const update = useAction(updateRequest, { onSuccess: () => setOpen(false) });
  const save = () => (request ? update.run({ ...v, id: request.id }) : create.run(v));
  return (
    <>
      {request ? <Button variant="secondary" icon={<Pencil className="size-5" aria-hidden />} onClick={() => { setV(request); setOpen(true); }}>{t.edit}</Button>
        : <Button icon={<Plus className="size-5" aria-hidden />} onClick={() => { setV(blank); setOpen(true); }}>{t.newRequest}</Button>}
      <Dialog open={open} onClose={() => setOpen(false)} title={request ? t.edit : t.newRequest} wide
        footer={<>
          <Button variant="ghost" onClick={() => setOpen(false)}>{c.actions.cancel}</Button>
          <Button pending={create.pending || update.pending} onClick={save}>{t.save}</Button>
        </>}>
        <RequestFields v={v} set={(p) => setV({ ...v, ...p })} groups={groups} />
        <FormError>{create.error ?? update.error}</FormError>
      </Dialog>
    </>
  );
}

export type TrialEvent = { id: string; when: string; title: string; team: string };

export function BookTrialButton({ id, events, again }: { id: string; events: TrialEvent[]; again?: boolean }) {
  const t = useT().club.enrolment;
  const c = useT().common;
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState(events[0]?.id ?? "");
  const book = useAction(bookTrial, { onSuccess: () => setOpen(false) });
  return (
    <>
      <Button variant={again ? "secondary" : "primary"} icon={<CalendarPlus className="size-5" aria-hidden />} onClick={() => setOpen(true)}>{again ? t.rebookTrial : t.bookTrial}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t.bookTitle}
        footer={<>
          <Button variant="ghost" onClick={() => setOpen(false)}>{c.actions.cancel}</Button>
          <Button disabled={!pick} pending={book.pending} onClick={() => book.run({ id, eventId: pick })}>{t.bookTrial}</Button>
        </>}>
        <p className="mb-3 text-ink-2">{t.bookHint}</p>
        {events.length ? (
          <fieldset className="space-y-1.5">
            <legend className="sr-only">{t.bookTitle}</legend>
            {events.map((e) => (
              <label key={e.id} className={cn("flex min-h-14 cursor-pointer items-center gap-3 rounded-[var(--radius-control)] border px-3 py-2", pick === e.id ? "border-brand bg-brand/5" : "border-line hover:bg-canvas")}>
                <input type="radio" name="trial" className="size-5 accent-[var(--color-brand)]" checked={pick === e.id} onChange={() => setPick(e.id)} />
                <span><span className="block font-semibold">{e.when}</span><span className="block text-sm text-ink-3">{e.title} · {e.team}</span></span>
              </label>
            ))}
          </fieldset>
        ) : <p className="text-ink-3">{t.noEvents}</p>}
        <FormError>{book.error}</FormError>
      </Dialog>
    </>
  );
}

export function RecordTrialButton({ id, eventId, rating, note, compact }: { id: string; eventId?: string; rating?: number | null; note?: string | null; compact?: boolean }) {
  const t = useT().club.enrolment;
  const c = useT().common;
  const [open, setOpen] = useState(false);
  const [r, setR] = useState<number>(rating ?? 0);
  const [n, setN] = useState(note ?? "");
  const rec = useAction(recordTrial, { onSuccess: () => setOpen(false) });
  return (
    <>
      <Button size={compact ? "sm" : "md"} variant={rating ? "secondary" : "primary"} icon={<Star className={compact ? "size-4" : "size-5"} aria-hidden />} onClick={() => setOpen(true)}>
        {rating ? t.rating(rating) : t.recordTrial}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t.recordTitle}
        footer={<>
          <Button variant="ghost" onClick={() => setOpen(false)}>{c.actions.cancel}</Button>
          <Button disabled={!r} pending={rec.pending} onClick={() => rec.run({ id, rating: r, note: n, eventId })}>{c.actions.save}</Button>
        </>}>
        <fieldset>
          <legend className="mb-2 font-semibold text-ink-2">{t.ratingLabel}</legend>
          <div className="grid gap-1.5 sm:grid-cols-5">
            {([1, 2, 3, 4, 5] as const).map((k) => (
              <button key={k} type="button" aria-pressed={r === k} onClick={() => setR(k)}
                className={cn("flex min-h-16 flex-col items-center justify-center rounded-[var(--radius-control)] border px-2 py-1 text-center", r === k ? "border-brand bg-brand text-brand-ink" : "border-line-strong hover:bg-canvas")}>
                <span className="text-lg font-bold tabular-nums">{k}</span>
                <span className="text-xs font-semibold leading-tight">{t.ratings[k]}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <Field label={t.trialNote} optional className="mt-4"><Textarea rows={3} value={n} maxLength={1000} onChange={(e) => setN(e.target.value)} /></Field>
        <FormError>{rec.error}</FormError>
      </Dialog>
    </>
  );
}

export function EnrolButton({ id, groupId, groups }: { id: string; groupId: string | null; groups: Group[] }) {
  const t = useT().club.enrolment;
  const c = useT().common;
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState(groupId ?? "");
  const [fee, setFee] = useState<number | null | undefined>(undefined);
  const [first, setFirst] = useState(true);
  const [enrolFee, setEnrolFee] = useState("");
  const go = useAction(enrol, { onSuccess: () => setOpen(false) });
  const lookup = useAction(groupFee, { successMessage: false, refresh: false, onSuccess: (x) => setFee(x) });
  const pickGroup = (g: string) => { setGroup(g); setFee(undefined); if (g) void lookup.run(g); };
  return (
    <>
      <Button icon={<UserCheck className="size-5" aria-hidden />} onClick={() => { setOpen(true); pickGroup(group); }}>{t.enrol}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t.enrolTitle}
        footer={<>
          <Button variant="ghost" onClick={() => setOpen(false)}>{c.actions.cancel}</Button>
          <Button disabled={!group} pending={go.pending} icon={<Check className="size-5" aria-hidden />}
            onClick={() => go.run({ id, groupId: group, firstMonth: first && !!fee, enrolFee })}>{t.enrol}</Button>
        </>}>
        <div className="space-y-4">
          <p className="text-ink-2">{t.enrolHint}</p>
          <Field label={t.fields.team}>
            <Select value={group} onChange={(e) => pickGroup(e.target.value)}>
              <option value="">—</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </Select>
          </Field>
          {group && fee !== undefined ? (fee ? <Checkbox label={t.firstMonth(formatLei(fee))} checked={first} onChange={(e) => setFirst(e.target.checked)} />
            : <p className="text-sm text-ink-3">{t.firstMonthNone}</p>) : null}
          <Field label={t.enrolFee} optional><Input inputMode="decimal" value={enrolFee} maxLength={12} placeholder="0" onChange={(e) => setEnrolFee(e.target.value)} /></Field>
          <FormError>{go.error}</FormError>
        </div>
      </Dialog>
    </>
  );
}

export function CloseButtons({ id }: { id: string }) {
  const t = useT().club.enrolment;
  const c = useT().common;
  const [mode, setMode] = useState<"declined" | "withdrawn" | null>(null);
  const [reason, setReason] = useState("");
  const close = useAction(closeRequest, { onSuccess: () => setMode(null) });
  return (
    <>
      <Button variant="ghost" icon={<Archive className="size-5" aria-hidden />} onClick={() => setMode("withdrawn")}>{t.withdraw}</Button>
      <Button variant="ghost" onClick={() => setMode("declined")}>{t.decline}</Button>
      <Dialog open={!!mode} onClose={() => setMode(null)} title={mode === "withdrawn" ? t.withdraw : t.decline}
        footer={<>
          <Button variant="ghost" onClick={() => setMode(null)}>{c.actions.cancel}</Button>
          <Button variant={mode === "declined" ? "danger" : "primary"} pending={close.pending} onClick={() => close.run({ id, reason, withdrawn: mode === "withdrawn" })}>{mode === "withdrawn" ? t.withdraw : t.decline}</Button>
        </>}>
        <Field label={t.closeReason} optional><Textarea rows={2} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} /></Field>
        <FormError>{close.error}</FormError>
      </Dialog>
    </>
  );
}

export function ReopenButton({ id }: { id: string }) {
  const t = useT().club.enrolment;
  const r = useAction(reopenRequest);
  return <Button variant="secondary" pending={r.pending} icon={<RotateCcw className="size-5" aria-hidden />} onClick={() => r.run(id)}>{t.reopen}</Button>;
}

export function NoteForm({ id }: { id: string }) {
  const t = useT().club.enrolment;
  const [note, setNote] = useState("");
  const add = useAction(addNote, { successMessage: false, onSuccess: () => setNote("") });
  return (
    <div className="flex items-end gap-2">
      <Field label={t.addNote} className="flex-1"><Input value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && note.trim()) void add.run({ id, note }); }} /></Field>
      <Button variant="secondary" disabled={!note.trim()} pending={add.pending} icon={<MessageSquarePlus className="size-5" aria-hidden />} onClick={() => add.run({ id, note })}>{t.note}</Button>
    </div>
  );
}

function Step({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 py-3">
      <span className={cn("mt-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2", done ? "border-st-green bg-st-green text-white" : "border-line-strong")}>{done ? <Check className="size-4" aria-hidden /> : null}</span>
      <div className="min-w-0 flex-1 space-y-2">{children}</div>
    </li>
  );
}

/** După înscriere: fișa, contul părintelui, contractul. */
export function NextSteps({ playerId, guardian, templates, canContracts, contractSent, charges }: {
  playerId: string; guardian: { id: string; email: string | null; hasAccount: boolean } | null;
  templates: Array<{ id: string; name: string }>; canContracts: boolean; contractSent: boolean; charges: number;
}) {
  const t = useT().club.enrolment.next;
  const toast = useToast();
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [tpl, setTpl] = useState(templates.find((x) => /particip|înscri/i.test(x.name))?.id ?? templates[0]?.id ?? "");
  const invite = useAction(inviteGuardian, {
    successMessage: false,
    onSuccess: (r) => { if ("existing" in r) { toast(t.invited); return; } toast(r.emailed ? t.inviteSent : t.linkReady); if (!r.emailed) setLink(r.link); },
  });
  const send = useAction(sendContracts, { successMessage: false, onSuccess: (r) => toast(r.sent ? t.contractSent : t.contractHint) });
  return (
    <ol className="divide-y divide-line">
      <Step done><p>{t.fees(charges)}</p><LinkButton href={`/lot/jucatori/${playerId}`} size="sm">{t.player}</LinkButton></Step>
      <Step done={!!guardian?.hasAccount}>
        <p className="font-semibold">{t.invite}</p>
        <p className="text-sm text-ink-3">{guardian?.email ? t.inviteHint : t.inviteNeedsEmail}</p>
        {guardian && guardian.email && !guardian.hasAccount ? (
          <Button size="sm" pending={invite.pending} icon={<Mail className="size-4" aria-hidden />} onClick={() => invite.run(guardian.id)}>{t.invite}</Button>
        ) : guardian?.hasAccount ? <p className="text-sm font-semibold text-st-green">{t.invited}</p> : null}
        {link ? (
          <div className="flex items-end gap-2">
            <Field label={t.linkReady} className="flex-1"><Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} /></Field>
            <Button variant="secondary" icon={<Copy className="size-5" aria-hidden />} onClick={() => { void navigator.clipboard.writeText(link); setCopied(true); }}>{copied ? t.copied : t.copy}</Button>
          </div>
        ) : null}
        <FormError>{invite.error}</FormError>
      </Step>
      {canContracts ? (
        <Step done={contractSent}>
          <p className="font-semibold">{t.contract}</p>
          {!guardian?.hasAccount ? <p className="text-sm text-ink-3">{t.contractHint}</p> : !templates.length ? <p className="text-sm text-ink-3">{t.noTemplates}</p> : !contractSent ? (
            <div className="flex flex-wrap items-end gap-2">
              <Field label="" className="min-w-56 flex-1"><Select aria-label={t.contract} value={tpl} onChange={(e) => setTpl(e.target.value)}>{templates.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></Field>
              <Button size="md" pending={send.pending} icon={<FileSignature className="size-5" aria-hidden />} onClick={() => send.run({ templateId: tpl, playerIds: [playerId], dueOn: null })}>{t.contract}</Button>
            </div>
          ) : null}
          <FormError>{send.error}</FormError>
        </Step>
      ) : null}
    </ol>
  );
}
