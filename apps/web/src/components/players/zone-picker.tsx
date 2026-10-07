"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { describeZone, isBodyZone, type BodySide } from "@club/shared";
import { BodyMap } from "@/components/ui/body-map";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { useT } from "@/messages";

export type ZoneValue = { zone: string | null; side: string | null; detail: string; uncertain: boolean };

export const EMPTY_ZONE: ZoneValue = { zone: null, side: null, detail: "", uncertain: false };

/**
 * Zona accidentată: selecție pe harta corpului + detaliu în text liber (ex. „ligament") + „incert / de confirmat".
 * `collapsible`: silueta stă ascunsă până o cere utilizatorul (în ferestrele scurte, pe telefon).
 */
export function ZonePicker({ value, onChange, collapsible = false, label }: {
  value: ZoneValue; onChange: (v: ZoneValue) => void; collapsible?: boolean; label?: string;
}) {
  const t = useT().players.statusDialog;
  const [open, setOpen] = useState(!collapsible);
  const selection = isBodyZone(value.zone) ? { zone: value.zone, side: (value.side as BodySide | null) ?? null } : null;
  const summary = describeZone({ zone: value.zone, side: value.side });

  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-sm font-semibold text-ink-2">{label ?? t.zone}</legend>
      {collapsible ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex h-12 w-full items-center justify-between gap-2 rounded-[var(--radius-control)] border border-line-strong bg-surface px-3 text-left font-semibold hover:bg-canvas"
        >
          <span className={summary ? undefined : "font-normal text-ink-3"}>{summary || t.zoneNone}</span>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm text-ink-3">
            {open ? t.zoneHide : t.zonePick}
            {open ? <ChevronUp className="size-5" aria-hidden /> : <ChevronDown className="size-5" aria-hidden />}
          </span>
        </button>
      ) : null}
      {open ? (
        <BodyMap
          value={selection}
          onChange={(sel) => onChange({ ...value, zone: sel?.zone ?? null, side: sel?.side ?? null })}
        />
      ) : null}
      <Field label={t.detail} optional>
        <Input
          value={value.detail}
          maxLength={200}
          placeholder={t.detailPlaceholder}
          onChange={(e) => onChange({ ...value, detail: e.target.value })}
        />
      </Field>
      <Checkbox
        label={t.uncertain}
        description={t.uncertainHint}
        checked={value.uncertain}
        onChange={(e) => onChange({ ...value, uncertain: e.target.checked })}
      />
    </fieldset>
  );
}
