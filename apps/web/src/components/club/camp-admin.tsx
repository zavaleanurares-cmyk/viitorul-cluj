"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Pencil, Plus, UserPlus, X } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { useToast } from "@/components/ui/toast";
import { useT } from "@/messages";
import { cancelRegistration, confirmRegistration, registerCamp, saveCamp, setPaid, waitlistRegistration, type CampInput } from "@/app/(app)/club/tabere/actions";

const blank = (): CampInput => ({ title: "", description: "", location: "", startsOn: "", endsOn: "", price: "", capacity: 30, yearFrom: "", yearTo: "", deadline: "", status: "draft", isPublic: true });

export function CampFormButton({ camp }: { camp?: CampInput & { id: string } }) {
  const t = useT().club.camps;
  const c = useT().common;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<CampInput>(camp ?? blank());
  const save = useAction(saveCamp, { onSuccess: (r) => { setOpen(false); if (!camp) router.push(`/club/tabere/${r.id}`); } });
  const set = (p: Partial<CampInput>) => setV({ ...v, ...p });
  return (
    <>
      {camp ? <Button variant="secondary" icon={<Pencil className="size-5" aria-hidden />} onClick={() => { setV(camp); setOpen(true); }}>{t.editCamp}</Button>
        : <Button icon={<Plus className="size-5" aria-hidden />} onClick={() => { setV(blank()); setOpen(true); }}>{t.newCamp}</Button>}
      <Dialog open={open} onClose={() => setOpen(false)} title={camp ? t.editCamp : t.newCamp} wide
        footer={<>
          <Button variant="ghost" onClick={() => setOpen(false)}>{c.actions.cancel}</Button>
          <Button pending={save.pending} disabled={v.title.trim().length < 2 || !v.startsOn || !v.endsOn} onClick={() => save.run(v)}>{c.actions.save}</Button>
        </>}>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <Field label={t.fields.title}><Input value={v.title} maxLength={120} onChange={(e) => set({ title: e.target.value })} /></Field>
            <Field label={t.fields.status}>
              <Select value={v.status} onChange={(e) => set({ status: e.target.value as CampInput["status"] })}>
                {(Object.keys(t.status) as Array<keyof typeof t.status>).map((k) => <option key={k} value={k}>{t.status[k]}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t.fields.startsOn}><Input type="date" value={v.startsOn} onChange={(e) => set({ startsOn: e.target.value })} /></Field>
            <Field label={t.fields.endsOn}><Input type="date" value={v.endsOn} min={v.startsOn} onChange={(e) => set({ endsOn: e.target.value })} /></Field>
            <Field label={t.fields.deadline} optional><Input type="date" value={v.deadline ?? ""} max={v.startsOn} onChange={(e) => set({ deadline: e.target.value })} /></Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label={t.fields.price}><Input inputMode="decimal" value={v.price} maxLength={12} placeholder="0" onChange={(e) => set({ price: e.target.value })} /></Field>
            <Field label={t.fields.capacity}><Input type="number" min={1} max={2000} value={String(v.capacity)} onChange={(e) => set({ capacity: Number(e.target.value) })} /></Field>
            <Field label={t.fields.yearFrom} optional><Input type="number" min={1990} max={2100} value={String(v.yearFrom ?? "")} onChange={(e) => set({ yearFrom: e.target.value === "" ? "" : Number(e.target.value) })} /></Field>
            <Field label={t.fields.yearTo} optional><Input type="number" min={1990} max={2100} value={String(v.yearTo ?? "")} onChange={(e) => set({ yearTo: e.target.value === "" ? "" : Number(e.target.value) })} /></Field>
          </div>
          <Field label={t.fields.location} optional><Input value={v.location ?? ""} maxLength={200} onChange={(e) => set({ location: e.target.value })} /></Field>
          <Field label={t.fields.description} hint={t.fields.descriptionHint} optional><Textarea rows={5} value={v.description ?? ""} maxLength={4000} onChange={(e) => set({ description: e.target.value })} /></Field>
          <Checkbox label={t.fields.isPublic} checked={v.isPublic} onChange={(e) => set({ isPublic: e.target.checked })} />
          <FormError>{save.error}</FormError>
        </div>
      </Dialog>
    </>
  );
}

type Player = { id: string; name: string; birth: string | null; team: string };

export function ConfirmButton({ id, campId, childName, birth, players }: { id: string; campId: string; childName: string; birth: string | null; players: Player[] }) {
  const t = useT().club.camps.actions;
  const c = useT().common;
  const [open, setOpen] = useState(false);
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const guess = players.find((p) => norm(p.name) === norm(childName) && (!birth || p.birth === birth));
  const [pick, setPick] = useState(guess?.id ?? "");
  const go = useAction(confirmRegistration, { onSuccess: () => setOpen(false) });
  return (
    <>
      <Button size="sm" icon={<Check className="size-4" aria-hidden />} onClick={() => setOpen(true)}>{t.confirm}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t.confirmTitle}
        footer={<>
          <Button variant="ghost" onClick={() => setOpen(false)}>{c.actions.cancel}</Button>
          <Button pending={go.pending} onClick={() => go.run({ id, campId, playerId: pick || null })}>{t.confirm}</Button>
        </>}>
        <p className="mb-3 font-semibold">{childName}</p>
        <Field label={t.linkPlayer}>
          <Select value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">{t.noLink}</option>
            {players.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.team}</option>)}
          </Select>
        </Field>
        <FormError>{go.error}</FormError>
      </Dialog>
    </>
  );
}

export function WaitlistButton({ id, campId }: { id: string; campId: string }) {
  const t = useT().club.camps.actions;
  const go = useAction(waitlistRegistration);
  return <Button size="sm" variant="ghost" pending={go.pending} icon={<Clock className="size-4" aria-hidden />} onClick={() => go.run({ id, campId })}>{t.waitlist}</Button>;
}

export function PaidToggle({ id, campId, paid }: { id: string; campId: string; paid: boolean }) {
  const t = useT().club.camps;
  const go = useAction(setPaid);
  return (
    <button type="button" aria-pressed={paid} disabled={go.pending} onClick={() => go.run({ id, campId, paid: !paid, note: "" })}
      className={paid ? "inline-flex h-9 items-center gap-1 rounded-full bg-st-green/15 px-3 text-sm font-semibold text-st-green" : "inline-flex h-9 items-center rounded-full border border-line-strong px-3 text-sm font-semibold hover:bg-canvas"}>
      {paid ? <><Check className="size-4" aria-hidden />{t.payment.paid}</> : t.actions.markPaid}
    </button>
  );
}

export function CancelRegistrationButton({ id, campId, label, icon }: { id: string; campId: string; label?: string; icon?: boolean }) {
  const t = useT().club.camps.actions;
  const c = useT().common;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const go = useAction(cancelRegistration, { onSuccess: () => setOpen(false) });
  return (
    <>
      {icon ? <IconButton label={t.cancel} onClick={() => setOpen(true)}><X className="size-5" aria-hidden /></IconButton>
        : <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>{label ?? t.cancel}</Button>}
      <Dialog open={open} onClose={() => setOpen(false)} title={t.cancelTitle}
        footer={<>
          <Button variant="ghost" onClick={() => setOpen(false)}>{c.actions.cancel}</Button>
          <Button variant="danger" pending={go.pending} onClick={() => go.run({ id, campId, reason })}>{t.cancel}</Button>
        </>}>
        <p className="mb-3 text-sm text-ink-2">{t.cancelHint}</p>
        <Field label={t.cancelReason} optional><Input value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} /></Field>
        <FormError>{go.error}</FormError>
      </Dialog>
    </>
  );
}

/** Înscrierea unui copil al clubului (de către birou sau de familie). */
export function RegisterButton({ campId, campTitle, players, priceNote, office }: {
  campId: string; campTitle: string; players: Array<{ id: string; name: string }>; priceNote: string | null; office?: boolean;
}) {
  const t = useT().club.camps;
  const c = useT().common;
  const [open, setOpen] = useState(false);
  const [player, setPlayer] = useState(players[0]?.id ?? "");
  const [notes, setNotes] = useState("");
  const toast = useToast();
  const go = useAction(registerCamp, { successMessage: false, onSuccess: (r) => { setOpen(false); toast(r === "waitlist" ? t.family.waitlisted : t.family.confirmed); } });
  return (
    <>
      <Button variant={office ? "secondary" : "primary"} icon={<UserPlus className="size-5" aria-hidden />} disabled={!players.length}
        onClick={() => setOpen(true)}>{office ? t.actions.add : t.family.register}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t.family.registerTitle(campTitle)}
        footer={<>
          <Button variant="ghost" onClick={() => setOpen(false)}>{c.actions.cancel}</Button>
          <Button disabled={!player} pending={go.pending} onClick={() => go.run({ campId, playerId: player, notes })}>{t.family.register}</Button>
        </>}>
        <div className="space-y-4">
          {players.length > 1 || office ? (
            <Field label={t.family.child}>
              <Select value={player} onChange={(e) => setPlayer(e.target.value)}>{players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
            </Field>
          ) : <p className="font-semibold">{players[0]?.name}</p>}
          <Field label={t.family.notes} hint={t.family.notesHint} optional><Textarea rows={3} value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} /></Field>
          {priceNote ? <p className="text-sm text-ink-2">{priceNote}</p> : null}
          <FormError>{go.error}</FormError>
        </div>
      </Dialog>
    </>
  );
}
