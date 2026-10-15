"use client";
import { useRef, useState } from "react";
import { HeartPulse, ImageUp, Trash2, TriangleAlert, Users } from "lucide-react";
import type { ClubSettings } from "@club/shared";
import { saveClubIdentity, saveClubSettings, setClubLogo } from "@/app/(app)/administrare/club/actions";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Notice } from "@/components/ui/card";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { clubThemeStyle, inkOn } from "@/lib/theme";
import { uploadFile } from "@/lib/upload";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { HEX, contrast } from "./color";

const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/webp": "webp", "image/jpeg": "jpg" };
const LOGO_MAX = 2 * 1024 * 1024;
const TIMEZONES = [
  "Europe/Bucharest", "Europe/Chisinau", "Europe/Budapest", "Europe/Sofia", "Europe/Belgrade", "Europe/Vienna", "Europe/Berlin",
  "Europe/Rome", "Europe/Paris", "Europe/Madrid", "Europe/London", "Europe/Lisbon", "Europe/Athens", "Europe/Istanbul", "Europe/Kyiv",
];

function ColorField({ label, hint, value, onChange }: { label: string; hint?: string; value: string; onChange: (v: string) => void }) {
  const valid = HEX.test(value);
  return (
    <Field label={label} hint={hint}>
      <span className="flex gap-2">
        <input
          type="color" aria-label={label} value={valid ? value : "#000000"} onChange={(e) => onChange(e.target.value)}
          className="h-12 w-14 shrink-0 cursor-pointer rounded-[var(--radius-control)] border border-line-strong bg-surface p-1"
        />
        <Input
          value={value} onChange={(e) => onChange(e.target.value.trim())} maxLength={7} spellCheck={false} autoCapitalize="off"
          aria-invalid={!valid} className="font-mono uppercase"
        />
      </span>
    </Field>
  );
}

export function ClubIdentityForm({ club, logoUrl }: {
  club: { id: string; name: string; shortName: string; primaryColor: string; accentColor: string; hasLogo: boolean }; logoUrl: string | null;
}) {
  const t = useT().admin.club;
  const [name, setName] = useState(club.name);
  const [shortName, setShortName] = useState(club.shortName);
  const [primary, setPrimary] = useState(club.primaryColor);
  const [accent, setAccent] = useState(club.accentColor);
  const [uploading, setUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const save = useAction(saveClubIdentity);
  const logo = useAction(setClubLogo);

  const primaryOk = HEX.test(primary);
  const accentOk = HEX.test(accent);
  const shown = primaryOk ? primary : club.primaryColor;
  const ink = inkOn(shown);
  const onInk = contrast(shown, ink);
  const onWhite = contrast(shown, "#ffffff");
  const dirty = name !== club.name || shortName !== club.shortName || primary.toLowerCase() !== club.primaryColor.toLowerCase() || accent.toLowerCase() !== club.accentColor.toLowerCase();
  const ratio = (n: number) => n.toFixed(1).replace(".", ",");

  const pickLogo = async (file: File | undefined) => {
    if (!file) return;
    setLogoError(null);
    const ext = LOGO_TYPES[file.type];
    if (!ext) return setLogoError(t.logoType);
    if (file.size > LOGO_MAX) return setLogoError(t.logoSize);
    setUploading(true);
    const path = `${club.id}/sigla-${Date.now()}.${ext}`;
    const res = await uploadFile("branding", path, file);
    if (!res.ok) {
      setUploading(false);
      return setLogoError(res.error);
    }
    await logo.run({ path });
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Card>
      <CardHeader title={t.identityTitle} description={t.identityHint} />
      <CardBody className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <Field label={t.name}>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </Field>
          <Field label={t.shortName} hint={t.shortNameHint}>
            <Input value={shortName} onChange={(e) => setShortName(e.target.value)} maxLength={20} />
          </Field>
        </div>

        <div>
          <p className="mb-1 text-sm font-semibold text-ink-2">{t.logo}</p>
          <div className="flex flex-wrap items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={t.logoAlt} className="size-16 shrink-0 rounded-lg border border-line bg-white object-contain p-1" />
            ) : (
              <span aria-hidden className="inline-flex size-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-line-strong text-2xl font-bold text-ink-3">
                {(shortName || name).slice(0, 1)}
              </span>
            )}
            <input ref={fileRef} type="file" accept="image/png,image/webp,image/jpeg" className="sr-only" tabIndex={-1} aria-label={t.logoUpload} onChange={(e) => pickLogo(e.target.files?.[0])} />
            <Button variant="secondary" pending={uploading} icon={<ImageUp className="size-5" aria-hidden />} onClick={() => fileRef.current?.click()}>
              {club.hasLogo ? t.logoReplace : t.logoUpload}
            </Button>
            {club.hasLogo ? (
              <Button variant="ghost" pending={logo.pending && !uploading} icon={<Trash2 className="size-5" aria-hidden />} onClick={() => logo.run({ path: null })}>{t.logoRemove}</Button>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-ink-3">{t.logoHint}</p>
          <div className="mt-2"><FormError>{logoError ?? logo.error}</FormError></div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField label={t.primaryColor} hint={t.primaryHint} value={primary} onChange={setPrimary} />
          <ColorField label={t.accentColor} hint={t.accentHint} value={accent} onChange={setAccent} />
        </div>

        <div>
          <p className="mb-1 text-sm font-semibold text-ink-2">{t.preview}</p>
          <div style={clubThemeStyle({ primary_color: shown, accent_color: accentOk ? accent : shown })} className="overflow-hidden rounded-[var(--radius-card)] border border-line">
            <div className="flex items-center gap-2.5 bg-brand px-3 py-2.5 text-brand-ink">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="size-9 shrink-0 rounded-md bg-white object-contain p-0.5" />
              ) : (
                <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-ink/15 text-lg font-bold">{(shortName || name).slice(0, 1)}</span>
              )}
              <span className="truncate text-lg font-bold">{shortName || name}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 bg-surface p-3">
              <span className="inline-flex h-12 items-center rounded-[var(--radius-control)] bg-brand px-4 font-semibold text-brand-ink">{t.previewButton}</span>
              <span className="flex flex-col items-center gap-0.5 text-xs font-semibold text-brand">
                <span className="flex h-8 w-14 items-center justify-center rounded-full bg-brand text-brand-ink"><HeartPulse className="size-5" aria-hidden /></span>
                {t.previewActive}
              </span>
              <span className="flex flex-col items-center gap-0.5 text-xs font-semibold text-ink-3">
                <span className="flex h-8 w-14 items-center justify-center"><Users className="size-5" aria-hidden /></span>
                {t.previewInactive}
              </span>
              <span className="h-2 w-16 rounded-full" style={{ background: "var(--club-accent)" }} title={t.accentColor} />
            </div>
          </div>
          <p className="mt-2 text-sm text-ink-3">{t.contrastInfo(ink === "#ffffff" ? t.inkWhite : t.inkDark, ratio(onInk))}</p>
          {!primaryOk || !accentOk ? <Notice tone="red" className="mt-2">{t.colorInvalid}</Notice> : null}
          {primaryOk && onInk < 4.5 ? (
            <Notice tone="yellow" className="mt-2" title={<span className="flex items-center gap-2"><TriangleAlert className="size-5 shrink-0" aria-hidden />{t.contrastLowTitle}</span>}>
              {t.contrastLow(ratio(onInk))}
            </Notice>
          ) : null}
          {primaryOk && onWhite < 3 ? (
            <Notice tone="yellow" className="mt-2" title={<span className="flex items-center gap-2"><TriangleAlert className="size-5 shrink-0" aria-hidden />{t.tooLightTitle}</span>}>
              {t.tooLight(ratio(onWhite))}
            </Notice>
          ) : null}
        </div>

        <FormError>{save.error}</FormError>
        <Button
          pending={save.pending} disabled={!dirty || !primaryOk || !accentOk}
          onClick={() => save.run({ name, shortName, primaryColor: primary, accentColor: accent })}
        >
          {t.saveIdentity}
        </Button>
      </CardBody>
    </Card>
  );
}

type NumKey = "reminder_hour" | "medical_visa_validity_months" | "retention_months";
type AlertKey = keyof ClubSettings["alerts"];

function NumberRow({ label, hint, value, onChange, min, max, unit }: { label: string; hint: string; value: string; onChange: (v: string) => void; min: number; max: number; unit?: string }) {
  return (
    <label className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-3">
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="block text-sm text-ink-3">{hint}</span>
      </span>
      <span className="flex items-center gap-2">
        <Input type="number" inputMode="numeric" min={min} max={max} step={1} value={value} onChange={(e) => onChange(e.target.value)} className="w-20 shrink-0 text-center font-bold" />
        {unit ? <span className="w-14 shrink-0 whitespace-nowrap text-sm text-ink-3">{unit}</span> : null}
      </span>
    </label>
  );
}

export function ClubSettingsForm({ settings }: { settings: ClubSettings }) {
  const t = useT().admin.club;
  const [timezone, setTimezone] = useState(settings.timezone);
  const [seasonStart, setSeasonStart] = useState(settings.season_start ?? "");
  const [nums, setNums] = useState<Record<NumKey, string>>({
    reminder_hour: String(settings.reminder_hour),
    medical_visa_validity_months: String(settings.medical_visa_validity_months),
    retention_months: String(settings.retention_months),
  });
  const [alerts, setAlerts] = useState<Record<AlertKey, string>>(() =>
    Object.fromEntries(Object.entries(settings.alerts).map(([k, v]) => [k, String(v)])) as Record<AlertKey, string>);
  const save = useAction(saveClubSettings);
  const zones = TIMEZONES.includes(settings.timezone) ? TIMEZONES : [settings.timezone, ...TIMEZONES];
  const num = (v: string) => (v.trim() === "" ? Number.NaN : Number(v));

  const submit = () =>
    save.run({
      timezone,
      season_start: seasonStart || null,
      reminder_hour: num(nums.reminder_hour),
      medical_visa_validity_months: num(nums.medical_visa_validity_months),
      retention_months: num(nums.retention_months),
      alerts: Object.fromEntries(Object.entries(alerts).map(([k, v]) => [k, num(v)])) as ClubSettings["alerts"],
    });

  const alertRows: Array<{ key: AlertKey; min: number; max: number; unit?: string }> = [
    { key: "fatigue_threshold", min: 1, max: 10, unit: t.unitOf10 },
    { key: "muscle_load_threshold", min: 1, max: 10, unit: t.unitOf10 },
    { key: "spike_delta", min: 1, max: 9, unit: t.unitPoints },
    { key: "pain_intensity_threshold", min: 1, max: 10, unit: t.unitOf10 },
    { key: "missing_days", min: 1, max: 30, unit: t.unitDays },
    { key: "visa_days_before", min: 1, max: 180, unit: t.unitDays },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={t.rulesTitle} description={t.rulesHint} />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.timezone} hint={t.timezoneHint}>
              <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {zones.map((z) => <option key={z} value={z}>{z.replace("Europe/", "").replace("_", " ")}</option>)}
              </Select>
            </Field>
            <Field label={t.seasonStart} hint={t.seasonStartHint} optional>
              <Input type="date" value={seasonStart} onChange={(e) => setSeasonStart(e.target.value)} />
            </Field>
          </div>
          <div className="mt-2 divide-y divide-line">
            <NumberRow label={t.reminderHour} hint={t.reminderHourHint} min={0} max={23} unit={t.unitHour} value={nums.reminder_hour} onChange={(v) => setNums((n) => ({ ...n, reminder_hour: v }))} />
            <NumberRow label={t.visaMonths} hint={t.visaMonthsHint} min={1} max={36} unit={t.unitMonths} value={nums.medical_visa_validity_months} onChange={(v) => setNums((n) => ({ ...n, medical_visa_validity_months: v }))} />
            <NumberRow label={t.retentionMonths} hint={t.retentionMonthsHint} min={1} max={240} unit={t.unitMonths} value={nums.retention_months} onChange={(v) => setNums((n) => ({ ...n, retention_months: v }))} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t.alertsTitle} description={t.alertsHint} />
        <CardBody className="divide-y divide-line py-1">
          {alertRows.map((r) => (
            <NumberRow
              key={r.key} label={t.alerts[r.key].label} hint={t.alerts[r.key].hint} min={r.min} max={r.max} unit={r.unit}
              value={alerts[r.key]} onChange={(v) => setAlerts((a) => ({ ...a, [r.key]: v }))}
            />
          ))}
        </CardBody>
      </Card>

      <FormError>{save.error}</FormError>
      <Button pending={save.pending} onClick={submit}>{t.saveSettings}</Button>
    </div>
  );
}
