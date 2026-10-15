"use client";
import { useState } from "react";
import { CircleCheck, FileDown } from "lucide-react";
import { COUNTIES, isValidCnp } from "@club/shared";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input, Select } from "@/components/ui/form";
import { useT } from "@/messages";

const blank = { lastName: "", firstName: "", fatherInitial: "", cnp: "", street: "", number: "", block: "", stair: "", floor: "", apartment: "", county: "", city: "", postalCode: "", email: "", phone: "" };

/** Formularul 230: datele rămân în browser și în PDF; serverul păstrează doar numele (și contactul, cu acord). */
export function Form230({ slug }: { slug: string }) {
  const t = useT().club.supporters.public;
  const errs = useT().site.errors;
  const [v, setV] = useState(blank);
  const [twoYears, setTwoYears] = useState(true);
  const [shareData, setShareData] = useState(true);
  const [keepContact, setKeepContact] = useState(false);
  const [trap, setTrap] = useState("");
  const [startedAt] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const set = (p: Partial<typeof v>) => setV({ ...v, ...p });
  const cnpBad = v.cnp.length === 13 && !isValidCnp(v.cnp);
  const ready = v.lastName.trim().length >= 2 && v.firstName.trim().length >= 2 && isValidCnp(v.cnp) && v.street.trim() && v.number.trim() && v.county && v.city.trim();
  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/c/${slug}/sustine/formular`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...v, twoYears, shareData, keepContact, startedAt, website: trap }),
      });
      if (!res.ok) { setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? errs.generic); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = (res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1]) ?? "formular-230.pdf";
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setDone(true);
      setV(blank);
    } catch {
      setError(errs.generic);
    } finally {
      setBusy(false);
    }
  };
  const f = (k: keyof typeof blank, label: string, opts: { max?: number; optional?: boolean; type?: string; mode?: "numeric" | "text"; auto?: string } = {}) => (
    <Field label={label} optional={opts.optional}>
      <Input type={opts.type ?? "text"} inputMode={opts.mode} autoComplete={opts.auto ?? "off"} maxLength={opts.max ?? 60} value={v[k]} onChange={(e) => set({ [k]: e.target.value } as Partial<typeof v>)} />
    </Field>
  );
  return (
    <form className="space-y-4 rounded-[var(--radius-card)] border border-line/70 bg-surface p-4 md:p-6 shadow-[var(--shadow-card)]" onSubmit={(e) => { e.preventDefault(); if (ready) void submit(); }}>
      {done ? (
        <p role="status" className="flex items-start gap-2 rounded-[var(--radius-control)] bg-st-green/10 p-3 font-semibold"><CircleCheck className="mt-0.5 size-5 shrink-0 text-st-green" aria-hidden />{t.done}</p>
      ) : null}
      <h2 className="text-xl">{t.form}</h2>
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_2fr]">
        {f("lastName", t.lastName, { auto: "family-name" })}
        {f("fatherInitial", t.fatherInitial, { max: 3, optional: true })}
        {f("firstName", t.firstName, { auto: "given-name" })}
      </div>
      <Field label={t.cnp} error={cnpBad ? t.cnpInvalid : undefined}>
        <Input inputMode="numeric" autoComplete="off" maxLength={13} value={v.cnp} onChange={(e) => set({ cnp: e.target.value.replace(/\D/g, "") })} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-[3fr_1fr]">{f("street", t.street, { max: 100 })}{f("number", t.number, { max: 10 })}</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {f("block", t.block, { max: 10, optional: true })}{f("stair", t.stair, { max: 5, optional: true })}{f("floor", t.floor, { max: 5, optional: true })}{f("apartment", t.apartment, { max: 6, optional: true })}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t.county}>
          <Select value={v.county} onChange={(e) => set({ county: e.target.value })}>
            <option value="">—</option>{COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        {f("city", t.city)}
        {f("postalCode", t.postalCode, { max: 6, optional: true, mode: "numeric" })}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{f("email", t.email, { max: 200, optional: true, type: "email", auto: "email" })}{f("phone", t.phone, { max: 20, optional: true, type: "tel", auto: "tel" })}</div>
      <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>Website<input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} name="website" /></label>
      </div>
      <div className="space-y-2">
        <Checkbox label={t.twoYears} checked={twoYears} onChange={(e) => setTwoYears(e.target.checked)} />
        <Checkbox label={t.shareData} checked={shareData} onChange={(e) => setShareData(e.target.checked)} />
        <Checkbox label={t.keepContact} checked={keepContact} onChange={(e) => setKeepContact(e.target.checked)} />
      </div>
      <p className="text-sm text-ink-3">{t.privacy}</p>
      <FormError>{error}</FormError>
      <Button type="submit" size="lg" disabled={!ready} pending={busy} icon={<FileDown className="size-5" aria-hidden />}>{t.download}</Button>
    </form>
  );
}
