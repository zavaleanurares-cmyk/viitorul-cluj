"use client";
import { useRef, useState } from "react";
import { Download, ExternalLink, FileText, Trash2, Upload } from "lucide-react";
import { DOCUMENT_KINDS, label } from "@club/shared";
import { saveCaseDocument } from "@/app/(app)/cazuri/actions";
import { deleteDocument, saveDocument } from "@/app/(app)/lot/jucatori/[id]/(fisa)/documente/actions";
import { Button, IconButton, buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { ProgressBar } from "@/components/ui/misc";
import { Dialog } from "@/components/ui/overlay";
import { Badge } from "@/components/ui/status";
import { uploadFile, safeFileName } from "@/lib/upload";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { ConfirmDialog } from "./confirm-dialog";
import { MEDICAL_FILE_ACCEPT, MEDICAL_FILE_MAX_BYTES, formatBytes, medicalMimeType } from "./domain";

export type DocumentItem = {
  id: string;
  title: string;
  kind: string;
  /** accidentarea asociată, deja formatată */
  injury: string | null;
  uploadedBy: string | null;
  /** data încărcării, deja formatată */
  date: string;
  size: number | null;
  openUrl: string;
  downloadUrl: string;
  canDelete: boolean;
};

export type UploadTarget =
  | { mode: "player"; playerId: string; injuries: Array<{ id: string; label: string }> }
  | { mode: "case"; playerId: string; referralId: string };

/** Lista documentelor medicale + încărcare. Folosită în fișa jucătorului și pe cazul partenerului medical. */
export function DocumentsPanel({ title, description, docs, upload, emptyTitle, emptyDescription }: {
  title: string; description?: string; docs: DocumentItem[]; upload: UploadTarget | null; emptyTitle: string; emptyDescription: string;
}) {
  const t = useT().players.docs;
  const c = useT().common;
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<DocumentItem | null>(null);
  const remove = useAction(deleteDocument, { onSuccess: () => setDeleting(null) });

  return (
    <section aria-labelledby="docs-title">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 id="docs-title" className="text-lg">{title}</h2>
          {description ? <p className="text-sm text-ink-3">{description}</p> : null}
        </div>
        {upload ? (
          <Button icon={<Upload className="size-5" aria-hidden />} onClick={() => setUploading(true)}>{t.upload}</Button>
        ) : null}
      </div>

      {!docs.length ? (
        <EmptyState icon={<FileText className="size-8" aria-hidden />} title={emptyTitle} description={emptyDescription} />
      ) : (
        <ul className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line py-2 pl-3 pr-2 last:border-b-0 md:flex-nowrap">
              <FileText className="hidden size-6 shrink-0 text-ink-3 md:block" aria-hidden />
              <div className="min-w-0 flex-1 basis-full md:basis-0">
                <a
                  href={d.openUrl} target="_blank" rel="noopener noreferrer"
                  className="block truncate font-bold underline-offset-4 hover:underline"
                  aria-label={t.openLabel(d.title)}
                >
                  {d.title}
                </a>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-3">
                  <Badge tone="outline">{label(DOCUMENT_KINDS, d.kind)}</Badge>
                  <span>{d.date}</span>
                  {d.uploadedBy ? <span>· {t.uploadedBy(d.uploadedBy)}</span> : null}
                  {d.size ? <span>· {formatBytes(d.size)}</span> : null}
                </p>
                {d.injury ? <p className="mt-0.5 truncate text-sm">{t.forInjury(d.injury)}</p> : null}
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-1">
                <a href={d.openUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm", "h-10")}>
                  <ExternalLink className="size-4" aria-hidden />{t.open}
                </a>
                <a href={d.downloadUrl} className={buttonClass("secondary", "sm", "h-10")} aria-label={t.downloadLabel(d.title)}>
                  <Download className="size-4" aria-hidden />{c.actions.download}
                </a>
                {d.canDelete ? (
                  <IconButton label={t.delete(d.title)} className="size-10" onClick={() => setDeleting(d)}>
                    <Trash2 className="size-5" aria-hidden />
                  </IconButton>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {upload && uploading ? <UploadDialog target={upload} onClose={() => setUploading(false)} /> : null}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={t.deleteTitle}
        confirmLabel={c.actions.delete}
        pending={remove.pending}
        error={remove.error}
        onConfirm={() => deleting && remove.run({ documentId: deleting.id })}
      >
        {deleting ? <p className="font-semibold text-ink">{deleting.title}</p> : null}
        <p>{t.deleteBody}</p>
      </ConfirmDialog>
    </section>
  );
}

function UploadDialog({ target, onClose }: { target: UploadTarget; onClose: () => void }) {
  const t = useT().players.docs;
  const c = useT().common;
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("other");
  const [injuryId, setInjuryId] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const savePlayer = useAction(saveDocument, { onSuccess: onClose });
  const saveCase = useAction(saveCaseDocument, { onSuccess: onClose });
  const busy = progress !== null || savePlayer.pending || saveCase.pending;

  const pick = (f: File | null) => {
    setError(null);
    if (f && !medicalMimeType(f.name)) { setFile(null); return setError(t.errType); }
    if (f && f.size > MEDICAL_FILE_MAX_BYTES) { setFile(null); return setError(t.errSize); }
    if (f && f.size === 0) { setFile(null); return setError(t.errEmpty); }
    setFile(f);
    if (f && !title.trim()) setTitle(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 200));
  };

  const submit = async () => {
    if (busy) return;
    if (!file) return setError(t.errPick);
    if (!title.trim()) return setError(t.errTitle);
    setError(null);
    setProgress(0);
    // tipul se stabilește după extensie: browserele nu raportează mereu corect HEIC și ZIP
    const body = new File([file], file.name, { type: medicalMimeType(file.name)! });
    const path = `${target.playerId}/${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const res = await uploadFile("medical", path, body, { onProgress: setProgress });
    if (!res.ok) {
      setProgress(null);
      return setError(res.error || t.errUpload);
    }
    setProgress(100);
    const saved = target.mode === "player"
      ? await savePlayer.run({ playerId: target.playerId, path, title, kind, injuryId })
      : await saveCase.run({ referralId: target.referralId, path, title, kind });
    setProgress(null);
    if (!saved.ok) setError(saved.error);
  };

  return (
    <Dialog
      open
      onClose={busy ? () => {} : onClose}
      title={t.uploadTitle}
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>{c.actions.cancel}</Button>
          <Button pending={busy} onClick={submit}>{busy ? t.uploading : t.save}</Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <Field label={t.file} hint={t.fileHint}>
          <input
            ref={input} type="file" accept={MEDICAL_FILE_ACCEPT} disabled={busy}
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
            className="block w-full rounded-[var(--radius-control)] border border-line-strong bg-surface text-ink file:mr-3 file:h-12 file:cursor-pointer file:border-0 file:border-r file:border-line-strong file:bg-canvas file:px-4 file:font-semibold file:text-ink"
          />
        </Field>
        <Field label={t.docTitle}>
          <Input value={title} maxLength={200} placeholder={t.docTitlePlaceholder} disabled={busy} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label={t.kind}>
          <Select value={kind} disabled={busy} onChange={(e) => setKind(e.target.value)}>
            {Object.entries(DOCUMENT_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </Select>
        </Field>
        {target.mode === "player" && target.injuries.length ? (
          <Field label={t.injury} optional>
            <Select value={injuryId} disabled={busy} onChange={(e) => setInjuryId(e.target.value)}>
              <option value="">{t.injuryNone}</option>
              {target.injuries.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
            </Select>
          </Field>
        ) : null}
        {progress !== null ? (
          <div role="status">
            <p className="mb-1 text-sm font-semibold">{t.progress(progress)}</p>
            <ProgressBar value={progress} max={100} label={t.uploading} />
          </div>
        ) : null}
        <FormError>{error}</FormError>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
