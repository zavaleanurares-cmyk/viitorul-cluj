"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Upload } from "lucide-react";
import { parseMatchVideoUrl } from "@club/shared";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { uploadFile } from "@/lib/upload";
import { useT } from "@/messages";
import { addVideo } from "@/app/(app)/performanta/video/actions";

type Ev = { id: string; date: string; groupIds: string[]; title: string };
const safeName = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-.]+/, "").slice(-80).toLowerCase() || "video.mp4";

/** Adăugarea unei înregistrări: link sau fișier, echipa, data; evenimentul zilei se alege singur. */
export function AddVideoButton({ clubId, teams, events, today }: { clubId: string; teams: Array<{ id: string; name: string }>; events: Ev[]; today: string }) {
  const t = useT().performance.video;
  const c = useT().common;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [date, setDate] = useState(today);
  const [title, setTitle] = useState("");
  const candidates = useMemo(() => events.filter((e) => e.date === date && (!teamId || e.groupIds.includes(teamId))), [events, date, teamId]);
  const [eventId, setEventId] = useState<string | "auto">("auto");
  const chosen = eventId === "auto" ? candidates[0]?.id ?? "" : eventId;
  const add = useAction(addVideo, { onSuccess: (r) => { setOpen(false); router.push(`/performanta/video/${r.id}`); } });
  const parsed = url ? parseMatchVideoUrl(url) : null;
  const send = async () => {
    setErr(null);
    let storagePath: string | null = null;
    if (file) {
      storagePath = `${clubId}/${crypto.randomUUID()}-${safeName(file.name)}`;
      setProgress(0);
      const up = await uploadFile("videos", storagePath, file, { onProgress: setProgress });
      setProgress(null);
      if (!up.ok) { setErr(up.error); return; }
    }
    const evTitle = candidates.find((e) => e.id === chosen)?.title;
    add.run({ title: title.trim() || evTitle || t.addTitle, url: file ? null : url, storagePath, groupId: teamId || null, eventId: chosen || null, recordedOn: date });
  };
  return (
    <>
      <Button icon={<Plus className="size-5" aria-hidden />} onClick={() => setOpen(true)}>{t.add}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t.addTitle}
        footer={<>
          <Button variant="ghost" onClick={() => setOpen(false)}>{c.actions.cancel}</Button>
          <Button disabled={!file && !parsed} pending={add.pending || progress !== null} onClick={send}>{progress !== null ? t.uploading(progress) : c.actions.save}</Button>
        </>}>
        <div className="space-y-4">
          <Field label={t.link} hint={t.linkHint}><Input type="url" inputMode="url" placeholder="https://" value={url} disabled={!!file} onChange={(e) => setUrl(e.target.value)} /></Field>
          <p className="text-center text-sm text-ink-3">{t.or}</p>
          <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border border-dashed border-line-strong px-4 py-2 font-semibold hover:bg-canvas">
            <Upload className="size-5 shrink-0" aria-hidden /><span className="min-w-0 break-all">{file ? file.name : t.upload}</span>
            <input type="file" accept="video/mp4,video/webm,video/quicktime" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.team}>
              <Select value={teamId} onChange={(e) => { setTeamId(e.target.value); setEventId("auto"); }}>{teams.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select>
            </Field>
            <Field label={t.date}><Input type="date" max={today} value={date} onChange={(e) => { setDate(e.target.value); setEventId("auto"); }} /></Field>
          </div>
          <Field label={t.event} hint={eventId === "auto" && candidates.length ? t.eventAuto : undefined}>
            <Select value={chosen} onChange={(e) => setEventId(e.target.value)}>
              <option value="">{t.noEvent}</option>
              {candidates.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
            </Select>
          </Field>
          <Field label={t.videoTitle} optional><Input value={title} maxLength={120} placeholder={candidates.find((e) => e.id === chosen)?.title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <FormError>{err ?? add.error ?? (url && !parsed ? t.errors.source : null)}</FormError>
        </div>
      </Dialog>
    </>
  );
}
