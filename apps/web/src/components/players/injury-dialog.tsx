"use client";
import { useState } from "react";
import { INJURY_CONTACT, INJURY_CONTEXT, INJURY_SEVERITY, INJURY_TYPES, RTP_STAGES, formatDateShort } from "@club/shared";
import { saveInjury } from "@/app/(app)/jucatori/[id]/medical/actions";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { injuryZoneText } from "./domain";
import type { InjuryRow } from "./queries";
import { ZonePicker, type ZoneValue } from "./zone-picker";

type Props = {
  playerId: string;
  /** accidentarea de modificat; lipsă = adăugare */
  injury?: InjuryRow | null;
  /** celelalte accidentări ale jucătorului (pentru „recidivă a…") */
  others: InjuryRow[];
  today: string;
  /** eticheta stării „accidentat" a clubului (ACC), dacă există */
  injuredLabel: string | null;
  /** eticheta stării „apt" a clubului, dacă există */
  fitLabel: string | null;
  /** jucătorul nu este apt acum și nu are altă accidentare activă: propunem marcarea ca apt la revenire */
  suggestFit: boolean;
  onClose: () => void;
};

/** Adăugare / modificare accidentare. Se montează doar cât este deschisă, ca starea să pornească curată. */
export function InjuryDialog(props: Props & { open: boolean }) {
  if (!props.open) return null;
  return <InjuryForm key={props.injury?.id ?? "new"} {...props} />;
}

function InjuryForm({ playerId, injury, others, today, injuredLabel, fitLabel, suggestFit, onClose }: Props) {
  const t = useT().players.medical;
  const c = useT().common;
  const adding = !injury;
  const [zone, setZone] = useState<ZoneValue>({
    zone: injury?.zone ?? null, side: injury?.side ?? null, detail: injury?.zone_detail ?? "", uncertain: injury?.zone_uncertain ?? false,
  });
  const [v, setV] = useState({
    injuryType: injury?.injury_type ?? "",
    contact: injury?.contact ?? "",
    context: injury?.context ?? "",
    occurredOn: injury?.occurred_on ?? today,
    diagnosis: injury?.diagnosis ?? "",
    severity: injury?.severity ?? "",
    expectedReturnOn: injury?.expected_return_on ?? "",
    actualReturnOn: injury?.actual_return_on ?? "",
    rtpStage: injury?.rtp_stage ?? 0,
    notes: injury?.notes ?? "",
    recurrenceOf: injury?.recurrence_of ?? "",
  });
  const set = <K extends keyof typeof v>(k: K, value: (typeof v)[K]) => setV((s) => ({ ...s, [k]: value }));
  const [syncInjured, setSyncInjured] = useState(true);
  const [syncFit, setSyncFit] = useState<boolean | null>(null);
  const save = useAction(saveInjury, { onSuccess: onClose });

  const offerInjured = adding && !!injuredLabel && !v.actualReturnOn;
  // revenirea reală tocmai a fost completată (nu era deja salvată)
  const offerFit = !!fitLabel && !!v.actualReturnOn && !injury?.actual_return_on;
  const fitChecked = syncFit ?? suggestFit;
  const candidates = others.filter((o) => o.id !== injury?.id && o.occurred_on <= v.occurredOn);
  const returnInvalid =
    (!!v.actualReturnOn && v.actualReturnOn < v.occurredOn) || (!!v.expectedReturnOn && v.expectedReturnOn < v.occurredOn);

  const submit = () =>
    save.run({
      id: injury?.id ?? null,
      playerId,
      zone: zone.zone, side: zone.side, detail: zone.detail, uncertain: zone.uncertain,
      ...v,
      recurrenceOf: candidates.some((o) => o.id === v.recurrenceOf) ? v.recurrenceOf : "",
      syncStatus: offerFit && fitChecked ? "fit" : offerInjured && syncInjured ? "injured" : null,
    });

  const options = (map: Record<string, string>) =>
    Object.entries(map).map(([k, l]) => <option key={k} value={k}>{l}</option>);

  return (
    <Dialog
      open
      wide
      onClose={onClose}
      title={adding ? t.dialogAdd : t.dialogEdit}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{c.actions.cancel}</Button>
          <Button pending={save.pending} disabled={returnInvalid || !v.occurredOn} onClick={submit}>{t.save}</Button>
        </>
      }
    >
      <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
        <ZonePicker value={zone} onChange={setZone} label={t.zone} />
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label={t.occurredOn}>
              <Input type="date" required value={v.occurredOn} max={today} onChange={(e) => set("occurredOn", e.target.value)} />
            </Field>
            <Field label={t.type} optional>
              <Select value={v.injuryType} onChange={(e) => set("injuryType", e.target.value)}>
                <option value="">{t.typeNone}</option>
                {options(INJURY_TYPES)}
              </Select>
            </Field>
            <Field label={t.mechanism} optional>
              <Select value={v.contact} onChange={(e) => set("contact", e.target.value)}>
                <option value="">{t.typeNone}</option>
                {options(INJURY_CONTACT)}
              </Select>
            </Field>
            <Field label={t.context} optional>
              <Select value={v.context} onChange={(e) => set("context", e.target.value)}>
                <option value="">{t.typeNone}</option>
                {options(INJURY_CONTEXT)}
              </Select>
            </Field>
          </div>
          <Field label={t.diagnosis} optional>
            <Textarea rows={2} maxLength={500} value={v.diagnosis} onChange={(e) => set("diagnosis", e.target.value)} />
          </Field>
          <Field label={t.severity} optional>
            <Select value={v.severity} onChange={(e) => set("severity", e.target.value)}>
              <option value="">{t.typeNone}</option>
              {options(INJURY_SEVERITY)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label={t.expectedReturn} optional>
              <Input type="date" value={v.expectedReturnOn} min={v.occurredOn} onChange={(e) => set("expectedReturnOn", e.target.value)} />
            </Field>
            <Field label={t.actualReturn} optional>
              <Input type="date" value={v.actualReturnOn} min={v.occurredOn} onChange={(e) => set("actualReturnOn", e.target.value)} />
            </Field>
          </div>
          {returnInvalid ? <FormError>{t.returnBeforeStart}</FormError> : null}
          <Field label={t.rtpLabel}>
            <Select value={String(v.rtpStage)} onChange={(e) => set("rtpStage", Number(e.target.value))}>
              {RTP_STAGES.map((name, i) => <option key={i} value={i}>{i} — {name}</option>)}
            </Select>
          </Field>
          <Field label={t.recurrence} optional>
            <Select value={candidates.some((o) => o.id === v.recurrenceOf) ? v.recurrenceOf : ""} onChange={(e) => set("recurrenceOf", e.target.value)} disabled={!candidates.length}>
              <option value="">{t.recurrenceNone}</option>
              {candidates.map((o) => (
                <option key={o.id} value={o.id}>{t.recurrenceOption(formatDateShort(o.occurred_on), injuryZoneText(o, true))}</option>
              ))}
            </Select>
          </Field>
          <Field label={t.notes} optional>
            <Textarea rows={3} maxLength={4000} value={v.notes} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
        <div className="space-y-1 md:col-span-2">
          {offerFit ? (
            <Checkbox label={t.syncFit(fitLabel!)} description={t.syncFitHint} checked={fitChecked} onChange={(e) => setSyncFit(e.target.checked)} />
          ) : offerInjured ? (
            <Checkbox label={t.syncInjured(injuredLabel!)} description={t.syncInjuredHint} checked={syncInjured} onChange={(e) => setSyncInjured(e.target.checked)} />
          ) : null}
          <FormError>{save.error}</FormError>
        </div>
      </div>
    </Dialog>
  );
}
