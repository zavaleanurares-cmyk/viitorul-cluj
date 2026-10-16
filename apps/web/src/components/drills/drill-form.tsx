"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, X } from "lucide-react";
import { saveDrill, discardDrillImage, type DrillInput } from "@/app/(app)/program/sectiuni/actions";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, FormError, Input, Segmented, Select, Textarea } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { uploadFile } from "@/lib/upload";
import { useT } from "@/messages";
import { emptyDiagram, type Diagram } from "./diagram-schema";
import { PitchEditor } from "./pitch-editor";
import { drillMinutes, type DrillRow } from "./queries";

type Form = {
  name: string; ageGroup: string; kind: string; category: string; visibility: "club" | "private";
  players: string; goalkeepers: string; intensity: string; workMin: string; restSec: string; reps: string;
  area: string; equipment: string; organization: string; criteria: string; videoUrl: string;
  diagram: Diagram; imagePaths: string[];
};

const str = (n: number | null | undefined) => (n == null ? "" : String(n).replace(".", ","));
const toNum = (s: string) => {
  const v = s.trim().replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Formularul unei secțiuni: date generale, schema pe teren, detalii tehnice, imagini și video. */
export function DrillForm({ drill, clubId }: { drill: DrillRow | null; clubId: string }) {
  const t = useT().drills;
  const f = t.form;
  const c = useT().common;
  const router = useRouter();
  const [v, setV] = useState<Form>(() => ({
    name: drill?.name ?? "", ageGroup: drill?.age_group ?? "", kind: drill?.kind ?? "", category: drill?.category ?? "",
    visibility: drill?.visibility ?? "club",
    players: str(drill?.players), goalkeepers: str(drill?.goalkeepers), intensity: str(drill?.intensity),
    workMin: str(drill?.work_min), restSec: str(drill?.rest_sec), reps: str(drill?.reps),
    area: drill?.area ?? "", equipment: drill?.equipment ?? "", organization: drill?.organization ?? "", criteria: drill?.criteria ?? "",
    videoUrl: drill?.video_url ?? "", diagram: drill?.diagram ?? emptyDiagram(), imagePaths: drill?.image_paths ?? [],
  }));
  const set = (p: Partial<Form>) => setV((x) => ({ ...x, ...p }));
  const [uploading, setUploading] = useState(false);
  const [upErr, setUpErr] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const added = useRef<string[]>([]);
  const save = useAction(saveDrill, {
    refresh: false,
    onSuccess: (r) => { added.current = []; router.push(`/program/sectiuni/${r.id}`); },
  });

  const upload = async (file: File) => {
    setUploading(true); setUpErr(null);
    const ext = (file.type.split("/")[1] ?? "jpg").replace("jpeg", "jpg");
    const path = `${clubId}/${crypto.randomUUID()}.${ext}`;
    const r = await uploadFile("drills", path, file);
    setUploading(false);
    if (r.ok) { added.current.push(path); set({ imagePaths: [...v.imagePaths, path] }); } else setUpErr(r.error);
  };
  const cancel = () => {
    // imaginile încărcate acum, dar nesalvate, nu rămân în depozit
    for (const p of added.current) void discardDrillImage({ path: p });
    router.push(drill ? `/program/sectiuni/${drill.id}` : "/program/sectiuni");
  };

  const total = drillMinutes({ reps: toNum(v.reps), work_min: toNum(v.workMin), rest_sec: toNum(v.restSec) });
  const input: DrillInput = {
    id: drill?.id ?? null, name: v.name, ageGroup: v.ageGroup, kind: v.kind,
    category: (v.category || null) as DrillInput["category"], visibility: v.visibility,
    players: toNum(v.players), goalkeepers: toNum(v.goalkeepers), intensity: toNum(v.intensity),
    workMin: toNum(v.workMin), restSec: toNum(v.restSec), reps: toNum(v.reps),
    area: v.area, equipment: v.equipment, organization: v.organization, criteria: v.criteria, videoUrl: v.videoUrl,
    diagram: v.diagram, imagePaths: v.imagePaths,
  };

  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); void save.run(input); }}>
      <Card>
        <CardHeader title={f.general} />
        <CardBody className="space-y-4">
          <Field label={f.name}><Input value={v.name} maxLength={120} required onChange={(e) => set({ name: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={f.ageGroup} optional>
              <Select value={v.ageGroup} onChange={(e) => set({ ageGroup: e.target.value })}>
                <option value="">—</option>
                {t.ageGroups.map((g) => <option key={g} value={g}>{g}</option>)}
              </Select>
            </Field>
            <Field label={f.kind} optional>
              <Input list="drill-kinds" value={v.kind} maxLength={60} onChange={(e) => set({ kind: e.target.value })} />
              <datalist id="drill-kinds">{t.kinds.map((k) => <option key={k} value={k} />)}</datalist>
            </Field>
            <Field label={f.category} optional>
              <Select value={v.category} onChange={(e) => set({ category: e.target.value })}>
                <option value="">—</option>
                {(Object.keys(t.categories) as Array<keyof typeof t.categories>).map((k) => <option key={k} value={k}>{t.categories[k]}</option>)}
              </Select>
            </Field>
          </div>
          <Field label={f.visibility}>
            <Segmented label={f.visibility} value={v.visibility} onChange={(x) => set({ visibility: x })}
              options={[{ value: "club", label: f.visibilityClub }, { value: "private", label: f.visibilityPrivate }]} className="sm:max-w-sm" />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={f.diagram} description={f.diagramHint} />
        <CardBody><PitchEditor value={v.diagram} onChange={(d) => set({ diagram: d })} /></CardBody>
      </Card>

      <Card>
        <CardHeader title={f.technical} />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label={f.players} optional><Input inputMode="numeric" value={v.players} maxLength={2} onChange={(e) => set({ players: e.target.value })} /></Field>
            <Field label={f.goalkeepers} optional><Input inputMode="numeric" value={v.goalkeepers} maxLength={1} onChange={(e) => set({ goalkeepers: e.target.value })} /></Field>
            <Field label={f.intensity} optional className="col-span-2 sm:col-span-1">
              <Select value={v.intensity} onChange={(e) => set({ intensity: e.target.value })}>
                <option value="">—</option>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} · {t.intensity[n]}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label={f.reps} optional><Input inputMode="numeric" value={v.reps} maxLength={2} onChange={(e) => set({ reps: e.target.value })} /></Field>
            <Field label={f.workMin} optional><Input inputMode="decimal" value={v.workMin} maxLength={5} onChange={(e) => set({ workMin: e.target.value })} /></Field>
            <Field label={f.restSec} optional><Input inputMode="numeric" value={v.restSec} maxLength={4} onChange={(e) => set({ restSec: e.target.value })} /></Field>
            <Field label={f.total}>
              <p className="flex h-11 items-center font-semibold tabular-nums" aria-live="polite">{total ? t.minutes(total) : "—"}</p>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={f.area} optional><Input value={v.area} maxLength={120} placeholder={f.areaPlaceholder} onChange={(e) => set({ area: e.target.value })} /></Field>
            <Field label={f.equipment} optional><Input value={v.equipment} maxLength={500} placeholder={f.equipmentPlaceholder} onChange={(e) => set({ equipment: e.target.value })} /></Field>
          </div>
          <Field label={f.organization} optional><Textarea rows={4} value={v.organization} maxLength={4000} placeholder={f.organizationPlaceholder} onChange={(e) => set({ organization: e.target.value })} /></Field>
          <Field label={f.criteria} optional><Textarea rows={3} value={v.criteria} maxLength={4000} placeholder={f.criteriaPlaceholder} onChange={(e) => set({ criteria: e.target.value })} /></Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={f.media} description={f.mediaHint} />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {v.imagePaths.map((p) => (
              <div key={p} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/files/drills/${p}`} alt="" className="size-28 rounded-[var(--radius-control)] bg-sunken object-cover" />
                <button type="button" aria-label={f.removeImage} className="absolute right-1 top-1 inline-flex size-8 items-center justify-center rounded-full bg-surface shadow"
                  onClick={() => set({ imagePaths: v.imagePaths.filter((x) => x !== p) })}>
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            ))}
            {v.imagePaths.length < 6 ? (
              <button type="button" onClick={() => fileInput.current?.click()} disabled={uploading}
                className="flex size-28 flex-col items-center justify-center gap-1 rounded-[var(--radius-control)] border-2 border-dashed border-line-strong px-2 text-center text-sm text-ink-3 hover:bg-canvas">
                <ImagePlus className="size-6" aria-hidden />{uploading ? "…" : f.addImage}
              </button>
            ) : null}
          </div>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1}
            onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void upload(file); }} />
          <FormError>{upErr}</FormError>
          <Field label={f.video} optional>
            <Input type="url" inputMode="url" value={v.videoUrl} maxLength={500} placeholder={f.videoPlaceholder} onChange={(e) => set({ videoUrl: e.target.value })} />
          </Field>
        </CardBody>
      </Card>

      <FormError>{save.error}</FormError>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" pending={save.pending} disabled={uploading || !v.name.trim()}>{c.actions.save}</Button>
        <Button variant="secondary" onClick={cancel}>{c.actions.cancel}</Button>
      </div>
    </form>
  );
}
