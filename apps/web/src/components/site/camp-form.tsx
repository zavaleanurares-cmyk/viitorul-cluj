"use client";
import { useState } from "react";
import { CircleCheck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input, Textarea } from "@/components/ui/form";
import { submitCampRegistration } from "@/app/c/[slug]/actions";
import { useT } from "@/messages";

export function PublicCampForm({ slug, campId }: { slug: string; campId: string }) {
  const t = useT().club.camps;
  const f = useT().club.enrolment.fields;
  const errs = useT().site.errors;
  const blank = { childName: "", birthDate: "", parentName: "", email: "", phone: "", notes: "" };
  const [v, setV] = useState(blank);
  const [consent, setConsent] = useState(false);
  const [trap, setTrap] = useState("");
  const [startedAt] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  if (done) {
    return (
      <div role="status" className="space-y-2 rounded-[var(--radius-card)] border border-st-green/40 bg-st-green/10 p-6">
        <p className="flex items-center gap-2 text-xl font-bold"><CircleCheck className="size-7 text-st-green" aria-hidden />{t.public.sent}</p>
        <p className="text-ink-2">{t.public.sentBody}</p>
      </div>
    );
  }
  const set = (p: Partial<typeof v>) => setV({ ...v, ...p });
  const submit = async () => {
    setBusy(true); setError(null);
    const res = await submitCampRegistration(slug, campId, { ...v, consent: consent as true }, { startedAt, website: trap }).catch(() => ({ ok: false as const, error: "" }));
    setBusy(false);
    if (res.ok) setDone(true); else setError(res.error || errs.generic);
  };
  return (
    <form className="space-y-4 rounded-[var(--radius-card)] border border-line/70 bg-surface p-4 md:p-6 shadow-[var(--shadow-card)]" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <Field label={f.childName}><Input value={v.childName} maxLength={120} onChange={(e) => set({ childName: e.target.value })} /></Field>
        <Field label={f.birthDate}><Input type="date" value={v.birthDate} onChange={(e) => set({ birthDate: e.target.value })} /></Field>
      </div>
      <Field label={f.parentName}><Input value={v.parentName} maxLength={120} autoComplete="name" onChange={(e) => set({ parentName: e.target.value })} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={f.email} hint={f.contactHint}><Input type="email" value={v.email} maxLength={200} autoComplete="email" onChange={(e) => set({ email: e.target.value })} /></Field>
        <Field label={f.phone}><Input type="tel" value={v.phone} maxLength={20} autoComplete="tel" onChange={(e) => set({ phone: e.target.value })} /></Field>
      </div>
      <Field label={t.family.notes} hint={t.family.notesHint} optional><Textarea rows={2} value={v.notes} maxLength={1000} onChange={(e) => set({ notes: e.target.value })} /></Field>
      <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>Website<input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} name="website" /></label>
      </div>
      <Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} label={t.public.consent} />
      <FormError>{error}</FormError>
      <Button type="submit" size="lg" disabled={!consent} pending={busy} icon={<Send className="size-5" aria-hidden />}>{t.public.register}</Button>
    </form>
  );
}
