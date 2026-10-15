"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { isBodyZone, zoneLabel, type BodySide, type WellnessConfig } from "@club/shared";
import { saveWellness } from "@/app/(app)/chestionar/actions";
import { BodyMap, type BodySelection } from "@/components/ui/body-map";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { ScaleInput } from "@/components/ui/scale";
import { useToast } from "@/components/ui/toast";
import { useT } from "@/messages";

export type WellnessInitial = {
  fatigue: number | null;
  muscle_load: number | null;
  pain_zone: string | null;
  pain_side: string | null;
  pain_intensity: number | null;
  pain_note: string | null;
  sleep_quality: number | null;
  sleep_hours: number | null;
  stress: number | null;
  mood: number | null;
};

const SLEEP_HOURS = Array.from({ length: 21 }, (_, i) => 3 + i * 0.5); // 3 … 13 ore, din jumătate în jumătate

/**
 * Chestionarul zilnic. Fluxul fără durere: două atingeri (oboseală, încărcătură) + „Salvează".
 * Zona dureroasă stă pliată; întrebările suplimentare apar doar dacă preparatorul le-a activat pe grupă.
 */
export function WellnessForm({ initial, config }: { initial: WellnessInitial | null; config: WellnessConfig }) {
  const t = useT().player;
  const router = useRouter();
  const toast = useToast();

  const [fatigue, setFatigue] = useState<number | null>(initial?.fatigue ?? null);
  const [muscle, setMuscle] = useState<number | null>(initial?.muscle_load ?? null);
  const hadPain = !!initial?.pain_zone || !!initial?.pain_note;
  const [painOpen, setPainOpen] = useState(hadPain);
  const [zone, setZone] = useState<BodySelection | null>(
    initial && isBodyZone(initial.pain_zone) ? { zone: initial.pain_zone, side: (initial.pain_side as BodySide | null) ?? null } : null,
  );
  const [painIntensity, setPainIntensity] = useState<number | null>(initial?.pain_intensity ?? null);
  const [painNote, setPainNote] = useState(initial?.pain_note ?? "");
  const [sleepQuality, setSleepQuality] = useState<number | null>(initial?.sleep_quality ?? null);
  const [sleepHours, setSleepHours] = useState<string>(initial?.sleep_hours != null ? String(initial.sleep_hours) : "");
  const [stress, setStress] = useState<number | null>(initial?.stress ?? null);
  const [mood, setMood] = useState<number | null>(initial?.mood ?? null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** orice răspuns nou șterge mesajul de eroare rămas de la încercarea anterioară */
  const answer = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setError(null);
  };

  async function submit() {
    if (fatigue === null || muscle === null) return setError(t.errors.scalesNeeded);
    if (painOpen && !zone) return setError(t.errors.painZoneNeeded);
    if (painOpen && painIntensity === null) return setError(t.errors.painIntensityNeeded);
    if ((config.sleep && sleepQuality === null) || (config.stress && stress === null) || (config.mood && mood === null)) {
      return setError(t.errors.extraNeeded);
    }
    setError(null);
    setPending(true);
    let res: Awaited<ReturnType<typeof saveWellness>>;
    try {
      res = await saveWellness({
        fatigue,
        muscleLoad: muscle,
        pain: painOpen && zone && painIntensity !== null ? { zone: zone.zone, side: zone.side, intensity: painIntensity, note: painNote } : null,
        sleepQuality: config.sleep ? sleepQuality : null,
        sleepHours: config.sleep && sleepHours ? Number(sleepHours) : null,
        stress: config.stress ? stress : null,
        mood: config.mood ? mood : null,
      });
    } catch {
      res = { ok: false, error: t.errors.network };
    }
    if (res.ok) {
      toast(t.wellness.saved);
      router.replace("/azi");
      router.refresh();
      return; // butonul rămâne în așteptare până se schimbă pagina
    }
    setPending(false);
    setError(res.error);
  }

  return (
    <div className="space-y-6">
      <ScaleInput label={t.wellness.fatigue} value={fatigue} onChange={answer(setFatigue)} minLabel={t.scales.none} maxLabel={t.scales.max} />
      <ScaleInput label={t.wellness.muscleLoad} value={muscle} onChange={answer(setMuscle)} minLabel={t.scales.none} maxLabel={t.scales.max} />

      {config.sleep ? (
        <div className="space-y-3">
          <ScaleInput label={t.wellness.sleepQuality} value={sleepQuality} onChange={answer(setSleepQuality)} minLabel={t.scales.sleepMin} maxLabel={t.scales.sleepMax} />
          <Field label={t.wellness.sleepHours} optional>
            <Select value={sleepHours} onChange={(e) => answer(setSleepHours)(e.target.value)}>
              <option value="">{t.wellness.sleepHoursNone}</option>
              {SLEEP_HOURS.map((h) => (
                <option key={h} value={h}>{t.wellness.hours(h)}</option>
              ))}
            </Select>
          </Field>
        </div>
      ) : null}
      {config.stress ? (
        <ScaleInput label={t.wellness.stress} value={stress} onChange={answer(setStress)} minLabel={t.scales.none} maxLabel={t.scales.max} />
      ) : null}
      {config.mood ? (
        <ScaleInput label={t.wellness.mood} value={mood} onChange={answer(setMood)} minLabel={t.scales.moodMin} maxLabel={t.scales.moodMax} />
      ) : null}

      {painOpen ? (
        <section aria-label={t.wellness.painTitle} className="rounded-[var(--radius-card)] border border-line/70 bg-surface p-4 shadow-[var(--shadow-card)]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg">{t.wellness.painTitle}</h2>
            <Button
              variant="ghost"
              size="sm"
              icon={<X className="size-4" aria-hidden />}
              onClick={() => {
                setPainOpen(false);
                setError(null);
              }}
            >
              {t.wellness.painRemove}
            </Button>
          </div>
          <p className="mb-2 text-sm text-ink-3">{t.wellness.painPick}</p>
          <BodyMap value={zone} onChange={answer(setZone)} className="mx-auto max-w-sm" />
          <p className="mt-2 font-semibold" aria-live="polite">
            {zone ? zoneLabel(zone.zone, zone.side) : t.wellness.painNoZone}
          </p>
          <div className="mt-4 space-y-4">
            <ScaleInput label={t.wellness.painIntensity} value={painIntensity} onChange={answer(setPainIntensity)} minLabel={t.scales.painMin} maxLabel={t.scales.painMax} />
            <Field label={t.wellness.painNote} optional>
              <Input value={painNote} maxLength={300} onChange={(e) => answer(setPainNote)(e.target.value)} placeholder={t.wellness.painNotePlaceholder} />
            </Field>
          </div>
        </section>
      ) : (
        <Button variant="secondary" className="w-full" icon={<Plus className="size-5" aria-hidden />} onClick={() => answer(setPainOpen)(true)}>
          {t.wellness.painOpen}
        </Button>
      )}

      {/* spațiu pentru bara fixă de pe telefon */}
      <div className="h-20 md:hidden" aria-hidden />
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] z-20 space-y-2 border-t border-line bg-surface px-4 py-3 md:static md:border-0 md:bg-transparent md:p-0">
        <FormError>{error}</FormError>
        <Button size="lg" className="w-full md:w-auto" pending={pending} onClick={submit}>
          {initial ? t.wellness.update : t.wellness.save}
        </Button>
      </div>
    </div>
  );
}
