"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { BODY_ZONES, formatDate, isBodyZone, zoneIsSided, type BodySide, type WellnessEntry } from "@club/shared";
import { deleteWellnessEntry, saveWellnessEntry } from "@/app/(app)/wellness/actions";
import { BodyMap } from "@/components/ui/body-map";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { ScaleInput } from "@/components/ui/scale";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { rawValues } from "./domain";

type Values = {
  fatigue: number | null; muscle: number | null; zone: string | null; side: string | null; intensity: number | null; note: string;
};

function valuesOf(e: WellnessEntry | null): Values {
  return {
    fatigue: e?.fatigue ?? null,
    muscle: e?.muscle_load ?? null,
    zone: isBodyZone(e?.pain_zone) ? e.pain_zone : null,
    side: e?.pain_side ?? null,
    intensity: e?.pain_intensity ?? null,
    note: e?.pain_note ?? "",
  };
}

/**
 * Corectarea sau introducerea unui chestionar de către preparator.
 * Cu `pickDate`, data se alege în fereastră; dacă pentru ziua aleasă există deja un chestionar
 * (`entries`), valorile lui se încarcă și salvarea îl modifică.
 */
export function EntryDialog({ open, onClose, player, date: initialDate, entry, today, pickDate = false, entries = [] }: {
  open: boolean; onClose: () => void; player: { id: string; name: string }; date: string; entry: WellnessEntry | null;
  today: string; pickDate?: boolean; entries?: WellnessEntry[];
}) {
  const t = useT().wellness.dialog;
  const c = useT().common;
  const [date, setDate] = useState(initialDate);
  const current = pickDate ? entries.find((x) => x.entry_date === date) ?? null : entry;
  const [v, setV] = useState<Values>(() => valuesOf(current));
  const [showMap, setShowMap] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const save = useAction(saveWellnessEntry, { onSuccess: onClose });
  const remove = useAction(deleteWellnessEntry, { onSuccess: onClose });

  const set = (patch: Partial<Values>) => setV((old) => ({ ...old, ...patch }));
  const sided = zoneIsSided(v.zone);
  const pain = !!v.zone || !!v.note.trim();
  const raw = current?.needs_review ? rawValues(current.raw) : null;

  const changeDate = (next: string) => {
    setDate(next);
    setV(valuesOf(entries.find((x) => x.entry_date === next) ?? null));
    setConfirmDelete(false);
  };

  const submit = () =>
    save.run({
      playerId: player.id,
      date,
      fatigue: v.fatigue,
      muscleLoad: v.muscle,
      painZone: v.zone,
      painSide: sided ? (v.side as BodySide | null) : null,
      painIntensity: pain ? v.intensity : null,
      painNote: v.note.trim() || null,
    });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={current ? t.titleEdit : t.titleAdd}
      footer={
        <>
          {current ? (
            <Button
              variant={confirmDelete ? "danger" : "ghost"}
              className="mr-auto"
              pending={remove.pending}
              icon={<Trash2 className="size-5" aria-hidden />}
              onClick={() => (confirmDelete ? remove.run({ id: current.id }) : setConfirmDelete(true))}
            >
              {confirmDelete ? t.deleteConfirm : c.actions.delete}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose}>{c.actions.cancel}</Button>
          <Button pending={save.pending} disabled={!date} onClick={submit}>{t.save}</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="text-lg font-bold">{player.name}</p>
          {pickDate ? (
            <Field label={t.date} className="mt-2" hint={current ? t.dateHasEntry : undefined}>
              <Input type="date" value={date} max={today} onChange={(e) => changeDate(e.target.value)} />
            </Field>
          ) : (
            <p className="text-ink-3">{formatDate(date, { weekday: true })}</p>
          )}
        </div>

        {current?.needs_review ? (
          <Notice tone="yellow" title={t.reviewTitle}>
            {current.review_note ? <p>{current.review_note}</p> : null}
            {raw ? (
              <p className="mt-1">
                {t.original}{" "}
                {[
                  raw.fatigue ? `${t.fatigueShort} „${raw.fatigue}”` : null,
                  raw.muscle ? `${t.muscleShort} „${raw.muscle}”` : null,
                  raw.pain ? `${t.zoneShort} „${raw.pain}”` : null,
                ].filter(Boolean).join(", ")}
              </p>
            ) : null}
            <p className="mt-1 text-sm">{t.reviewHint}</p>
          </Notice>
        ) : null}

        <ScaleInput label={t.fatigue} value={v.fatigue} onChange={(n) => set({ fatigue: n === v.fatigue ? null : n })} minLabel={c.scale.none} maxLabel={c.scale.max} />
        <ScaleInput label={t.muscleLoad} value={v.muscle} onChange={(n) => set({ muscle: n === v.muscle ? null : n })} minLabel={c.scale.none} maxLabel={c.scale.max} />

        <fieldset className="space-y-3">
          <legend className="mb-2 text-lg font-bold">{t.pain}</legend>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <Select
              aria-label={t.zone}
              value={v.zone ?? ""}
              onChange={(e) => {
                const zone = e.target.value || null;
                set({ zone, side: zoneIsSided(zone) ? v.side : null });
              }}
            >
              <option value="">{t.noZone}</option>
              {BODY_ZONES.map((z) => <option key={z.code} value={z.code}>{z.label}</option>)}
            </Select>
            <Select aria-label={t.side} value={sided ? v.side ?? "" : ""} disabled={!sided} onChange={(e) => set({ side: e.target.value || null })}>
              <option value="">{t.side}</option>
              <option value="left">{t.sideLeft}</option>
              <option value="right">{t.sideRight}</option>
              <option value="both">{t.sideBoth}</option>
            </Select>
          </div>
          <button
            type="button"
            aria-expanded={showMap}
            onClick={() => setShowMap((s) => !s)}
            className="inline-flex h-10 items-center gap-1 font-semibold text-ink-2 underline underline-offset-4"
          >
            {showMap ? t.hideMap : t.showMap}
            {showMap ? <ChevronUp className="size-5" aria-hidden /> : <ChevronDown className="size-5" aria-hidden />}
          </button>
          {showMap ? (
            <BodyMap
              showList={false}
              value={isBodyZone(v.zone) ? { zone: v.zone, side: (v.side as BodySide | null) ?? null } : null}
              onChange={(sel) => set({ zone: sel?.zone ?? null, side: sel?.side ?? null })}
            />
          ) : null}
          <Field label={t.note} optional>
            <Input value={v.note} maxLength={300} placeholder={t.notePlaceholder} onChange={(e) => set({ note: e.target.value })} />
          </Field>
          {pain ? (
            <ScaleInput label={t.intensity} value={v.intensity} onChange={(n) => set({ intensity: n === v.intensity ? null : n })} minLabel={t.intensityMin} maxLabel={t.intensityMax} />
          ) : null}
        </fieldset>

        <p className="text-sm text-ink-3">{current ? t.sourceKept : t.sourceStaff}</p>
        <FormError>{save.error ?? remove.error}</FormError>
      </div>
    </Dialog>
  );
}
