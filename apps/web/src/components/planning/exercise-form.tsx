"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2, Upload } from "lucide-react";
import {
  BODY_ZONES, EQUIPMENT, EXERCISE_CATEGORIES, EXERCISE_LEVELS, parseVideoUrl, zoneLabel, type BodyZoneCode, type Tables,
} from "@club/shared";
import { useT } from "@/messages";
import { useAction } from "@/lib/use-action";
import { uploadFile } from "@/lib/upload";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Notice } from "@/components/ui/card";
import { Field, FormError, Input, Segmented, Select, Textarea } from "@/components/ui/form";
import { BodyMap } from "@/components/ui/body-map";
import { ExerciseMedia } from "@/components/ui/video";
import { ProgressBar } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { discardClipUpload, prepareClipUpload, saveExercise, type ExerciseInput } from "@/app/(app)/biblioteca/actions";
import { ChipToggles } from "./chips";

const MAX_CLIP_BYTES = 100 * 1024 * 1024;
const CLIP_EXTENSIONS = ["mp4", "webm", "mov"];

type MediaMode = "none" | "file" | "link";

const formatSize = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`);

/** Formularul unui exercițiu (adăugare și modificare). Clipul se încarcă din browser în depozitul privat, la salvare. */
export function ExerciseForm({ exercise, clipUrl, clubName }: {
  exercise: Tables<"exercises"> | null;
  /** adresa clipului deja încărcat (`fileUrl`) */
  clipUrl: string | null;
  clubName: string;
}) {
  const t = useT().library.form;
  const router = useRouter();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [v, setV] = useState(() => ({
    name: exercise?.name ?? "",
    description: exercise?.description ?? "",
    steps: exercise?.steps?.length ? exercise.steps : [""],
    category: exercise?.category ?? "prevention",
    level: exercise?.level ?? "beginner",
    zones: exercise?.zones ?? [],
    equipment: exercise?.equipment ?? [],
    contraindications: exercise?.contraindications ?? "",
    link: exercise?.video_url ?? "",
    image_url: exercise?.image_url ?? "",
    source: exercise?.source ?? "",
    license: exercise?.license ?? "",
    attribution: exercise?.attribution ?? "",
  }));
  const set = (patch: Partial<typeof v>) => setV((old) => ({ ...old, ...patch }));
  const [mode, setMode] = useState<MediaMode>(exercise?.video_path ? "file" : exercise?.video_url ? "link" : "none");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => () => { if (filePreview) URL.revokeObjectURL(filePreview); }, [filePreview]);

  const save = useAction(saveExercise, { successMessage: false });

  const link = v.link.trim();
  const parsedLink = link ? parseVideoUrl(link) : null;
  const existingPath = exercise?.video_path ?? null;
  const hasClip = mode === "file" ? !!file || !!existingPath : mode === "link" ? !!link : false;
  const hasMedia = hasClip || !!v.image_url.trim();

  const fillOwnClip = () => set({ source: t.ownClip, license: t.ownClipLicense, attribution: clubName });

  const pickFile = (f: File | undefined) => {
    setProblem(null);
    if (!f) return;
    const ext = f.name.slice(f.name.lastIndexOf(".") + 1).toLowerCase();
    if (!CLIP_EXTENSIONS.includes(ext)) return setProblem(t.fileWrongType);
    if (f.size > MAX_CLIP_BYTES) return setProblem(t.fileTooBig);
    setFile(f);
    setFilePreview(URL.createObjectURL(f));
    // clipurile filmate de club: propunem sursa și licența, dacă nu au fost completate
    if (!v.source.trim() && !v.license.trim() && !v.attribution.trim()) fillOwnClip();
  };

  const submit = async () => {
    setProblem(null);
    save.clearError();
    if (!v.name.trim()) return setProblem(t.nameRequired);
    if (mode === "file" && !file && !existingPath) return setProblem(t.fileMissing);
    if (mode === "link" && !link) return setProblem(t.linkMissing);
    if (mode === "link" && !parsedLink) return setProblem(t.linkInvalid);
    if (hasMedia && !(v.source.trim() && v.license.trim() && v.attribution.trim())) return setProblem(t.licenseRequired);

    let video: ExerciseInput["video"] = { kind: "none" };
    let uploadedPath: string | null = null;
    if (mode === "link" && link) video = { kind: "link", url: link };
    if (mode === "file" && file) {
      setUploading(true);
      setProgress(0);
      try {
        const prep = await prepareClipUpload({ fileName: file.name, size: file.size, type: file.type });
        if (!prep.ok) {
          setProblem(prep.error);
          return;
        }
        // unele browsere nu dau tipul fișierelor .mov: trimitem tipul stabilit de server după extensie
        const body = file.type === prep.data.contentType ? file : new File([file], file.name, { type: prep.data.contentType });
        const up = await uploadFile("exercise-media", prep.data.path, body, { onProgress: setProgress });
        if (!up.ok) {
          setProblem(`${t.uploadFailed} ${up.error}`);
          return;
        }
        uploadedPath = prep.data.path;
        video = { kind: "file", path: uploadedPath };
      } catch {
        setProblem(t.uploadFailed);
        return;
      } finally {
        setUploading(false);
      }
    } else if (mode === "file" && existingPath) {
      video = { kind: "file", path: existingPath };
    }

    const res = await save.run({
      id: exercise?.id ?? null,
      name: v.name,
      description: v.description,
      steps: v.steps.map((s) => s.trim()).filter(Boolean),
      category: v.category as ExerciseInput["category"],
      level: v.level as ExerciseInput["level"],
      zones: v.zones,
      equipment: v.equipment as ExerciseInput["equipment"],
      contraindications: v.contraindications,
      video,
      image_url: v.image_url.trim(),
      source: v.source,
      license: v.license,
      attribution: v.attribution,
    });
    if (!res.ok) {
      if (uploadedPath) await discardClipUpload({ path: uploadedPath });
      return;
    }
    toast(res.data.created ? t.created : t.saved);
    if (res.data.created) router.push("/biblioteca");
  };

  const steps = v.steps;
  const setStep = (i: number, value: string) => set({ steps: steps.map((s, j) => (j === i ? value : s)) });
  const moveStep = (i: number, delta: number) => {
    const to = i + delta;
    if (to < 0 || to >= steps.length) return;
    const next = [...steps];
    [next[i], next[to]] = [next[to], next[i]];
    set({ steps: next });
  };

  const busy = uploading || save.pending;

  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate>
      <Card>
        <CardHeader title={t.sectionBasics} />
        <CardBody className="space-y-4">
          <Field label={t.name}>
            <Input value={v.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} placeholder={t.namePlaceholder} required autoComplete="off" />
          </Field>
          <Field label={t.description} hint={t.descriptionHint} optional>
            <Textarea value={v.description} onChange={(e) => set({ description: e.target.value })} maxLength={2000} rows={3} />
          </Field>
          <fieldset>
            <legend className="mb-1 text-sm font-semibold text-ink-2">{t.steps}</legend>
            <ol className="space-y-2">
              {steps.map((step, i) => (
                <li key={i} className="rounded-[var(--radius-control)] border border-line p-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor={`step-${i}`} className="pl-1 text-sm font-bold">{t.stepLabel(i + 1)}</label>
                    <div className="flex">
                      <IconButton label={t.moveStepUp(i + 1)} disabled={i === 0} onClick={() => moveStep(i, -1)}><ArrowUp className="size-5" aria-hidden /></IconButton>
                      <IconButton label={t.moveStepDown(i + 1)} disabled={i === steps.length - 1} onClick={() => moveStep(i, 1)}><ArrowDown className="size-5" aria-hidden /></IconButton>
                      <IconButton label={t.removeStep(i + 1)} onClick={() => set({ steps: steps.length > 1 ? steps.filter((_, j) => j !== i) : [""] })}><Trash2 className="size-5" aria-hidden /></IconButton>
                    </div>
                  </div>
                  <Textarea id={`step-${i}`} value={step} onChange={(e) => setStep(i, e.target.value)} maxLength={500} rows={2} placeholder={t.stepPlaceholder} />
                </li>
              ))}
            </ol>
            <Button variant="secondary" className="mt-2" icon={<Plus className="size-5" aria-hidden />} disabled={steps.length >= 20} onClick={() => set({ steps: [...steps, ""] })}>
              {t.addStep}
            </Button>
          </fieldset>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t.sectionClassify} />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.category}>
              <Select value={v.category} onChange={(e) => set({ category: e.target.value })}>
                {Object.entries(EXERCISE_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
            </Field>
            <Field label={t.level}>
              <Select value={v.level} onChange={(e) => set({ level: e.target.value })}>
                {Object.entries(EXERCISE_LEVELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
            </Field>
          </div>
          <fieldset>
            <legend className="mb-1 text-sm font-semibold text-ink-2">{t.zones}</legend>
            <ChipToggles
              label={t.zones}
              value={v.zones}
              onChange={(zones) => set({ zones })}
              options={BODY_ZONES.map((z) => ({ value: z.code as string, label: zoneLabel(z.code, null, true), title: z.label }))}
            />
            <details className="mt-2">
              <summary className="inline-flex h-12 cursor-pointer items-center font-semibold text-ink-2">{t.zonesOnBody}</summary>
              <BodyMap
                className="mx-auto max-w-sm"
                showList={false}
                value={null}
                highlights={v.zones.map((zone) => ({ zone, tone: "gray" as const }))}
                onChange={(sel) => {
                  if (!sel) return;
                  const zone: BodyZoneCode = sel.zone;
                  set({ zones: v.zones.includes(zone) ? v.zones.filter((z) => z !== zone) : [...v.zones, zone] });
                }}
              />
            </details>
          </fieldset>
          <fieldset>
            <legend className="mb-1 text-sm font-semibold text-ink-2">{t.equipment}</legend>
            <ChipToggles
              label={t.equipment}
              value={v.equipment}
              onChange={(equipment) => set({ equipment })}
              options={Object.entries(EQUIPMENT).map(([k, l]) => ({ value: k, label: l }))}
            />
          </fieldset>
          <Field label={t.contraindications} optional>
            <Textarea value={v.contraindications} onChange={(e) => set({ contraindications: e.target.value })} maxLength={1000} rows={2} placeholder={t.contraindicationsPlaceholder} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t.sectionMedia} />
        <CardBody className="space-y-4">
          <Segmented<MediaMode>
            label={t.mediaMode}
            value={mode}
            onChange={(m) => { setMode(m); setProblem(null); }}
            options={[{ value: "none", label: t.mediaNone }, { value: "file", label: t.mediaFile }, { value: "link", label: t.mediaLink }]}
          />

          {mode === "file" ? (
            <div className="space-y-3">
              <input
                ref={fileInput}
                type="file"
                accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                className="sr-only"
                aria-label={t.file}
                onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="secondary" icon={<Upload className="size-5" aria-hidden />} onClick={() => fileInput.current?.click()}>
                  {file || existingPath ? t.fileReplace : t.fileChoose}
                </Button>
                <span className="text-sm text-ink-3">
                  {file ? t.fileSelected(file.name, formatSize(file.size)) : existingPath ? t.fileCurrent : t.fileHint}
                </span>
              </div>
              {file || existingPath ? (
                <div className="max-w-xl">
                  <ExerciseMedia title={v.name || t.preview} fileUrl={filePreview ?? clipUrl} imageUrl={v.image_url.trim() || null} attribution={v.attribution || null} />
                </div>
              ) : null}
            </div>
          ) : null}

          {mode === "link" ? (
            <div className="space-y-3">
              <Field label={t.link} hint={link && parsedLink ? t.linkKind[parsedLink.kind] : t.linkHint} error={link && !parsedLink ? t.linkInvalid : undefined}>
                <Input type="url" inputMode="url" value={v.link} onChange={(e) => set({ link: e.target.value })} maxLength={500}
                  placeholder={t.linkPlaceholder} aria-invalid={!!link && !parsedLink} autoComplete="off" />
              </Field>
              {parsedLink ? (
                <div className="max-w-xl">
                  <ExerciseMedia title={v.name || t.preview} url={link} imageUrl={v.image_url.trim() || null} attribution={v.attribution || null} />
                </div>
              ) : null}
            </div>
          ) : null}

          <Field label={t.image} hint={t.imageHint} optional>
            <Input type="url" inputMode="url" value={v.image_url} onChange={(e) => set({ image_url: e.target.value })} maxLength={500} placeholder={t.imagePlaceholder} autoComplete="off" />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t.sectionLicense} description={t.licenseHint}
          action={<Button variant="secondary" size="sm" onClick={fillOwnClip}>{t.ownClip}</Button>} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label={t.source} optional={!hasMedia}>
            <Input value={v.source} onChange={(e) => set({ source: e.target.value })} maxLength={200} placeholder={t.sourcePlaceholder} required={hasMedia} />
          </Field>
          <Field label={t.license} optional={!hasMedia}>
            <Input value={v.license} onChange={(e) => set({ license: e.target.value })} maxLength={100} placeholder={t.licensePlaceholder} list="license-suggestions" required={hasMedia} />
            <datalist id="license-suggestions">
              {t.licenseSuggestions.map((s) => <option key={s} value={s} />)}
            </datalist>
          </Field>
          <Field label={t.attribution} optional={!hasMedia} className="sm:col-span-2">
            <Input value={v.attribution} onChange={(e) => set({ attribution: e.target.value })} maxLength={300} placeholder={t.attributionPlaceholder} required={hasMedia} />
          </Field>
        </CardBody>
      </Card>

      <FormError>{problem ?? save.error}</FormError>
      {uploading ? (
        <Notice tone="blue">
          <p className="font-semibold" aria-live="polite">{t.uploadProgress(progress)}</p>
          <ProgressBar className="mt-2" value={progress} max={100} label={t.uploading} />
        </Notice>
      ) : null}
      <div className="sticky bottom-16 z-20 -mx-4 border-t border-line bg-surface px-4 py-3 md:bottom-0 md:mx-0 md:rounded-[var(--radius-card)] md:border">
        <Button type="submit" pending={busy} className="w-full sm:w-auto">{exercise ? t.save : t.create}</Button>
      </div>
    </form>
  );
}
