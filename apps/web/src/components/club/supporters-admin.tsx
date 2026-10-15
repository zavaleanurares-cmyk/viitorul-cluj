"use client";
import { useRef, useState } from "react";
import { ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { formatDate } from "@club/shared";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { Badge } from "@/components/ui/status";
import { useAction } from "@/lib/use-action";
import { uploadFile } from "@/lib/upload";
import { useT } from "@/messages";
import { deletePledge, deleteSponsor, saveCampaign, savePledge, saveSponsor, setPledgesStatus, type SponsorInput } from "@/app/(app)/club/suporteri/actions";

type Status = "started" | "received" | "submitted";
const TONE = { started: "outline", received: "blue", submitted: "green" } as const;

export function CampaignButton({ campaign, suggestedYear }: { campaign?: { id: string; incomeYear: number; title: string; goal: string; deadline: string; active: boolean }; suggestedYear: number }) {
  const t = useT().club.supporters.campaign;
  const c = useT().common;
  const blank = { incomeYear: suggestedYear, title: t.defaultTitle(suggestedYear), goal: "", deadline: `${suggestedYear + 1}-05-25`, active: true };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(campaign ?? blank);
  const save = useAction(saveCampaign, { onSuccess: () => setOpen(false) });
  return (
    <>
      {campaign ? <Button variant="secondary" icon={<Pencil className="size-5" aria-hidden />} onClick={() => { setV(campaign); setOpen(true); }}>{t.edit}</Button>
        : <Button icon={<Plus className="size-5" aria-hidden />} onClick={() => { setV(blank); setOpen(true); }}>{t.new}</Button>}
      <Dialog open={open} onClose={() => setOpen(false)} title={campaign ? t.edit : t.new}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>{c.actions.cancel}</Button><Button pending={save.pending} onClick={() => save.run({ ...v, id: campaign?.id })}>{c.actions.save}</Button></>}>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
            <Field label={t.incomeYear}><Input type="number" min={2020} max={2100} disabled={!!campaign} value={String(v.incomeYear)} onChange={(e) => { const y = Number(e.target.value); setV({ ...v, incomeYear: y, title: t.defaultTitle(y), deadline: `${y + 1}-05-25` }); }} /></Field>
            <Field label={t.title}><Input value={v.title} maxLength={120} onChange={(e) => setV({ ...v, title: e.target.value })} /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.goal} optional><Input type="number" min={1} value={v.goal} onChange={(e) => setV({ ...v, goal: e.target.value })} /></Field>
            <Field label={t.deadline} optional><Input type="date" value={v.deadline} onChange={(e) => setV({ ...v, deadline: e.target.value })} /></Field>
          </div>
          <Checkbox label={t.active} checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} />
          <FormError>{save.error}</FormError>
        </div>
      </Dialog>
    </>
  );
}

export function AddPledgeButton() {
  const t = useT().club.supporters.pledges;
  const c = useT().common;
  const blank = { name: "", email: "", phone: "", twoYears: true, status: "received" as Status, notes: "" };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(blank);
  const save = useAction(savePledge, { onSuccess: () => setOpen(false) });
  return (
    <>
      <Button variant="secondary" icon={<Plus className="size-5" aria-hidden />} onClick={() => { setV(blank); setOpen(true); }}>{t.add}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t.addTitle}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>{c.actions.cancel}</Button><Button disabled={v.name.trim().length < 3} pending={save.pending} onClick={() => save.run(v)}>{c.actions.save}</Button></>}>
        <div className="space-y-3">
          <Field label={t.name}><Input value={v.name} maxLength={160} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.email} optional><Input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
            <Field label={t.phone} optional><Input type="tel" value={v.phone} maxLength={20} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
          </div>
          <Select aria-label="Stare" value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as Status })}>
            {(["received", "submitted"] as const).map((s) => <option key={s} value={s}>{t.status[s]}</option>)}
          </Select>
          <Checkbox label={t.twoYears} checked={v.twoYears} onChange={(e) => setV({ ...v, twoYears: e.target.checked })} />
          <Field label={t.notes} optional><Input value={v.notes} maxLength={500} onChange={(e) => setV({ ...v, notes: e.target.value })} /></Field>
          <FormError>{save.error}</FormError>
        </div>
      </Dialog>
    </>
  );
}

type Pledge = { id: string; full_name: string; email: string | null; phone: string | null; two_years: boolean; source: string; status: Status; created_at: string; notes: string | null };

export function PledgeTable({ rows }: { rows: Pledge[] }) {
  const t = useT().club.supporters.pledges;
  const [sel, setSel] = useState<string[]>([]);
  const mark = useAction(setPledgesStatus, { successMessage: false, onSuccess: () => setSel([]) });
  const del = useAction(deletePledge);
  if (!rows.length) return <p className="text-ink-3">{t.empty}</p>;
  const all = sel.length === rows.length;
  return (
    <div className="space-y-2">
      <div className="flex min-h-12 flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-2 font-semibold"><input type="checkbox" className="size-5 accent-[var(--color-brand)]" checked={all} onChange={() => setSel(all ? [] : rows.map((r) => r.id))} />{sel.length ? t.selected(sel.length) : t.selectAll}</label>
        {sel.length ? (["received", "submitted", "started"] as const).map((s) => (
          <Button key={s} size="sm" variant="secondary" pending={mark.pending} onClick={() => mark.run({ ids: sel, status: s })}>{t.mark}: {t.status[s]}</Button>
        )) : null}
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
            <input type="checkbox" aria-label={r.full_name} className="size-5 accent-[var(--color-brand)]" checked={sel.includes(r.id)} onChange={() => setSel(sel.includes(r.id) ? sel.filter((x) => x !== r.id) : [...sel, r.id])} />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{r.full_name}</span>
              <span className="block text-sm text-ink-3">{formatDate(r.created_at.slice(0, 10))} · {t.source[r.source as "public"]}{r.two_years ? ` · ${t.twoYears}` : ""}{r.email ? ` · ${r.email}` : ""}{r.phone ? ` · ${r.phone}` : ""}{r.notes ? ` · ${r.notes}` : ""}</span>
            </span>
            <Badge tone={TONE[r.status]}>{t.status[r.status]}</Badge>
            <IconButton label={t.remove} className="size-10" onClick={() => del.run(r.id)}><Trash2 className="size-4" aria-hidden /></IconButton>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SponsorButton({ clubId, sponsor }: { clubId: string; sponsor?: SponsorInput & { id: string } }) {
  const t = useT().club.supporters.sponsors;
  const c = useT().common;
  const blank: SponsorInput = { name: "", fiscalCode: "", contactName: "", email: "", phone: "", kind: "money", amount: "", status: "prospect", startsOn: "", endsOn: "", tier: "partner", url: "", logoPath: null, showOnSite: false, notes: "" };
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<SponsorInput>(sponsor ?? blank);
  const [busy, setBusy] = useState(false);
  const [upErr, setUpErr] = useState<string | null>(null);
  const [sure, setSure] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const save = useAction(saveSponsor, { onSuccess: () => setOpen(false) });
  const del = useAction(deleteSponsor, { onSuccess: () => setOpen(false) });
  const set = (p: Partial<SponsorInput>) => setV({ ...v, ...p });
  const upload = async (f: File) => {
    setBusy(true); setUpErr(null);
    const path = `${clubId}/sponsor/${crypto.randomUUID()}.${(f.type.split("/")[1] ?? "png").replace("jpeg", "jpg")}`;
    const r = await uploadFile("site", path, f);
    setBusy(false);
    if (r.ok) set({ logoPath: path }); else setUpErr(r.error);
  };
  return (
    <>
      {sponsor ? <IconButton label={t.edit} onClick={() => { setV(sponsor); setSure(false); setOpen(true); }}><Pencil className="size-5" aria-hidden /></IconButton>
        : <Button icon={<Plus className="size-5" aria-hidden />} onClick={() => { setV(blank); setOpen(true); }}>{t.new}</Button>}
      <Dialog open={open} onClose={() => setOpen(false)} title={sponsor ? t.edit : t.new} wide
        footer={<>
          {sponsor ? (sure ? <Button variant="danger" pending={del.pending} onClick={() => del.run(sponsor.id)}>{t.remove}</Button>
            : <IconButton label={t.remove} onClick={() => setSure(true)}><Trash2 className="size-5" aria-hidden /></IconButton>) : null}
          <span className="flex-1" />
          <Button variant="ghost" onClick={() => setOpen(false)}>{c.actions.cancel}</Button>
          <Button disabled={busy || v.name.trim().length < 2} pending={save.pending} onClick={() => save.run(v)}>{c.actions.save}</Button>
        </>}>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <Field label={t.name}><Input value={v.name} maxLength={160} onChange={(e) => set({ name: e.target.value })} /></Field>
            <Field label={t.fiscalCode} optional><Input value={v.fiscalCode} maxLength={20} onChange={(e) => set({ fiscalCode: e.target.value })} /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t.contact} optional><Input value={v.contactName} maxLength={120} onChange={(e) => set({ contactName: e.target.value })} /></Field>
            <Field label={t.email} optional><Input type="email" value={v.email} onChange={(e) => set({ email: e.target.value })} /></Field>
            <Field label={t.phone} optional><Input type="tel" value={v.phone} maxLength={20} onChange={(e) => set({ phone: e.target.value })} /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label={t.kind}><Select value={v.kind} onChange={(e) => set({ kind: e.target.value as SponsorInput["kind"] })}>{(Object.keys(t.kinds) as Array<keyof typeof t.kinds>).map((k) => <option key={k} value={k}>{t.kinds[k]}</option>)}</Select></Field>
            <Field label={t.amount} optional><Input inputMode="decimal" value={v.amount} maxLength={14} onChange={(e) => set({ amount: e.target.value })} /></Field>
            <Field label={t.status}><Select value={v.status} onChange={(e) => set({ status: e.target.value as SponsorInput["status"] })}>{(Object.keys(t.statuses) as Array<keyof typeof t.statuses>).map((k) => <option key={k} value={k}>{t.statuses[k]}</option>)}</Select></Field>
            <Field label={t.tier}><Select value={v.tier} onChange={(e) => set({ tier: e.target.value as SponsorInput["tier"] })}>{(Object.keys(t.tiers) as Array<keyof typeof t.tiers>).map((k) => <option key={k} value={k}>{t.tiers[k]}</option>)}</Select></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t.startsOn} optional><Input type="date" value={v.startsOn} onChange={(e) => set({ startsOn: e.target.value })} /></Field>
            <Field label={t.endsOn} optional><Input type="date" value={v.endsOn} onChange={(e) => set({ endsOn: e.target.value })} /></Field>
            <Field label={t.url} optional><Input type="url" value={v.url} onChange={(e) => set({ url: e.target.value })} /></Field>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {v.logoPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/files/site/${v.logoPath}`} alt="" className="h-16 w-auto max-w-48 rounded-[var(--radius-control)] border border-line bg-white object-contain p-1" />
            ) : null}
            <Button variant="secondary" size="sm" pending={busy} icon={<ImagePlus className="size-4" aria-hidden />} onClick={() => input.current?.click()}>{t.logoPick}</Button>
            <input ref={input} type="file" accept="image/png,image/webp,image/jpeg" className="sr-only" tabIndex={-1} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void upload(f); }} />
            <FormError>{upErr}</FormError>
          </div>
          <Checkbox label={t.showOnSite} checked={v.showOnSite} onChange={(e) => set({ showOnSite: e.target.checked })} />
          <Field label={t.notes} optional><Textarea rows={2} value={v.notes} maxLength={2000} onChange={(e) => set({ notes: e.target.value })} /></Field>
          <FormError>{save.error ?? del.error}</FormError>
        </div>
      </Dialog>
    </>
  );
}
