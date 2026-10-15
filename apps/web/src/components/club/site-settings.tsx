"use client";
import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { publishPolicy, saveSettings, type SiteSettingsInput } from "@/app/(app)/club/site/actions";

const SECTIONS = ["news", "teams", "camps", "gallery", "enrolment", "support", "contact"] as const;

export function SiteSettingsForm({ initial, groups }: { initial: SiteSettingsInput; groups: Array<{ id: string; name: string }> }) {
  const t = useT().club.website.settings;
  const toast = useToast();
  const [v, setV] = useState<SiteSettingsInput>(initial);
  const save = useAction(saveSettings, { successMessage: false, onSuccess: (n) => toast(t.saved(n)) });
  const set = (p: Partial<SiteSettingsInput>) => setV({ ...v, ...p });
  const text = (k: keyof SiteSettingsInput, label: string, type = "text") => (
    <Field label={label} optional><Input type={type} value={String(v[k] ?? "")} maxLength={300} onChange={(e) => set({ [k]: e.target.value } as Partial<SiteSettingsInput>)} /></Field>
  );
  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-[var(--radius-card)] border border-line/70 bg-surface p-4 shadow-[var(--shadow-card)]">
        <h2 className="text-lg">{t.sections}</h2>
        <p className="text-sm text-ink-3">{t.sectionsHint}</p>
        <div className="grid gap-3 md:grid-cols-2">
          {SECTIONS.map((k) => <Checkbox key={k} label={t.section[k].label} description={t.section[k].hint} checked={!!v[k]} onChange={(e) => set({ [k]: e.target.checked } as Partial<SiteSettingsInput>)} />)}
        </div>
      </section>
      <section className="space-y-3 rounded-[var(--radius-card)] border border-line/70 bg-surface p-4 shadow-[var(--shadow-card)]">
        <h2 className="text-lg">{t.privacyTitle}</h2>
        <Checkbox label={t.showStaff} checked={v.show_staff} onChange={(e) => set({ show_staff: e.target.checked })} />
        <Checkbox label={t.indexable} checked={v.indexable} onChange={(e) => set({ indexable: e.target.checked })} />
        <fieldset>
          <legend className="mb-1 font-semibold">{t.rosterGroups}</legend>
          <p className="mb-2 text-sm text-ink-3">{t.rosterHint}</p>
          <div className="flex flex-wrap gap-1.5">
            {groups.map((g) => {
              const on = v.roster_groups.includes(g.id);
              return <button key={g.id} type="button" aria-pressed={on} onClick={() => set({ roster_groups: on ? v.roster_groups.filter((x) => x !== g.id) : [...v.roster_groups, g.id] })}
                className={on ? "inline-flex h-10 items-center rounded-full bg-ink px-3 text-sm font-semibold text-surface" : "inline-flex h-10 items-center rounded-full border border-line-strong px-3 text-sm font-semibold hover:bg-canvas"}>{g.name}</button>;
            })}
          </div>
        </fieldset>
      </section>
      <section className="space-y-3 rounded-[var(--radius-card)] border border-line/70 bg-surface p-4 shadow-[var(--shadow-card)]">
        <h2 className="text-lg">{t.texts}</h2>
        {text("tagline", t.tagline)}
        <Field label={t.about} optional><Textarea rows={5} value={v.about} maxLength={4000} onChange={(e) => set({ about: e.target.value })} /></Field>
      </section>
      <section className="space-y-3 rounded-[var(--radius-card)] border border-line/70 bg-surface p-4 shadow-[var(--shadow-card)]">
        <h2 className="text-lg">{t.contactTitle}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {text("address", t.address)}{text("map_url", t.mapUrl, "url")}{text("email", t.email, "email")}{text("phone", t.phone, "tel")}
        </div>
        <h3 className="pt-2 text-base">{t.social}</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {text("facebook", "Facebook", "url")}{text("instagram", "Instagram", "url")}{text("youtube", "YouTube", "url")}{text("tiktok", "TikTok", "url")}
        </div>
      </section>
      <FormError>{save.error}</FormError>
      <Button size="lg" pending={save.pending} icon={<Save className="size-5" aria-hidden />} onClick={() => save.run(v)}>{t.save}</Button>
    </div>
  );
}

export function PolicyEditor({ initial, starter }: { initial: string; starter: string }) {
  const t = useT().club.website.privacy;
  const toast = useToast();
  const [body, setBody] = useState(initial);
  const pub = useAction(publishPolicy, { successMessage: false, onSuccess: (v) => toast(t.published(v)) });
  return (
    <div className="space-y-3">
      {!initial ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] bg-sunken p-3">
          <p className="flex-1 text-sm text-ink-2">{t.starterNote}</p>
          <Button variant="secondary" onClick={() => setBody(starter)}>{t.starter}</Button>
        </div>
      ) : null}
      <Field label={t.body}><Textarea rows={20} value={body} maxLength={60000} onChange={(e) => setBody(e.target.value)} /></Field>
      <FormError>{pub.error}</FormError>
      <Button disabled={body.trim().length < 50 || body.trim() === initial.trim()} pending={pub.pending} onClick={() => pub.run(body)}>{t.publish}</Button>
    </div>
  );
}
