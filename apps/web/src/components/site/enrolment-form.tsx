"use client";
import { useState } from "react";
import { CircleCheck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, FormError } from "@/components/ui/form";
import { RequestFields } from "@/components/club/enrolment-admin";
import type { RequestInput } from "@/app/(app)/club/inscrieri/actions";
import { submitEnrolment } from "@/app/c/[slug]/actions";
import { useT } from "@/messages";

const blank: RequestInput = { childName: "", birthDate: "", groupId: "", previousClub: "", position: "", notes: "", parentName: "", relation: "parent", email: "", phone: "" };

export function PublicEnrolmentForm({ slug, groups, privacyHref }: { slug: string; groups: Array<{ id: string; name: string }>; privacyHref: string | null }) {
  const t = useT().site.enrol;
  const errs = useT().site.errors;
  const [v, setV] = useState<RequestInput>(blank);
  const [consent, setConsent] = useState(false);
  const [trap, setTrap] = useState("");
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  if (done) {
    return (
      <div role="status" className="space-y-3 rounded-[var(--radius-card)] border border-st-green/40 bg-st-green/10 p-6">
        <p className="flex items-center gap-2 text-xl font-bold"><CircleCheck className="size-7 text-st-green" aria-hidden />{t.sent}</p>
        <p className="text-ink-2">{t.sentBody}</p>
        <Button variant="secondary" onClick={() => { setV(blank); setConsent(false); setDone(false); setStartedAt(Date.now()); }}>{t.another}</Button>
      </div>
    );
  }
  const submit = async () => {
    setBusy(true); setError(null);
    const res = await submitEnrolment(slug, { ...v, consent: consent as true }, { startedAt, website: trap }).catch(() => ({ ok: false as const, error: "" }));
    setBusy(false);
    if (res.ok) setDone(true); else setError(res.error || errs.generic);
  };
  return (
    <form className="space-y-5 rounded-[var(--radius-card)] border border-line/70 bg-surface p-4 md:p-6 shadow-[var(--shadow-card)]" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <RequestFields v={v} set={(p) => setV({ ...v, ...p })} groups={groups} />
      {/* capcană pentru roboți: ascunsă vizual și pentru cititoarele de ecran */}
      <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>Website<input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} name="website" /></label>
      </div>
      <Checkbox checked={consent} onChange={(e) => setConsent(e.target.checked)} label={t.consent}
        description={privacyHref ? <a href={privacyHref} className="underline underline-offset-4">{t.consentLink}</a> : undefined} />
      <FormError>{error}</FormError>
      <Button type="submit" size="lg" disabled={!consent} pending={busy} icon={<Send className="size-5" aria-hidden />}>{t.submit}</Button>
    </form>
  );
}
