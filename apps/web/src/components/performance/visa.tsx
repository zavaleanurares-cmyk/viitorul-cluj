"use client";
import { useState } from "react";
import { BellRing, Check, FileUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Field, FormError, Input, Textarea } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { useToast } from "@/components/ui/toast";
import { uploadFile } from "@/lib/upload";
import { useT } from "@/messages";
import { addMonths } from "@/components/players/domain";
import { decideVisaDocument, sendVisaReminders, submitVisaDocument } from "@/app/(app)/lot/vize/actions";

const safeName = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-.]+/, "").slice(-80).toLowerCase() || "viza";

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/heic";

/** Încărcarea avizului medical sportiv (părinte, jucător adult sau birou). */
export function VisaUploadButton({ playerId, playerName, today, variant = "primary", size = "md" }: {
  playerId: string; playerName: string; today: string; variant?: "primary" | "secondary"; size?: "sm" | "md";
}) {
  const t = useT().performance.visas;
  const c = useT().common;
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [issued, setIssued] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = useAction(submitVisaDocument, { onSuccess: () => { setOpen(false); setFile(null); setIssued(""); } });
  const send = async () => {
    if (!file) return;
    setBusy(true);
    setErr(null);
    const path = `${playerId}/${crypto.randomUUID()}-${safeName(file.name)}`;
    const up = await uploadFile("visas", path, file);
    setBusy(false);
    if (!up.ok) { setErr(up.error); return; }
    await submit.run({ playerId, path, fileName: file.name, mime: file.type, size: file.size, issuedOn: issued || null });
  };
  return (
    <>
      <Button variant={variant} size={size} icon={<FileUp className="size-5" aria-hidden />} onClick={() => setOpen(true)}>{t.upload}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t.uploadTitle(playerName)}
        footer={<>
          <Button variant="ghost" onClick={() => setOpen(false)}>{c.actions.cancel}</Button>
          <Button disabled={!file} pending={busy || submit.pending} onClick={send}>{c.actions.send}</Button>
        </>}>
        <div className="space-y-4">
          <p className="text-ink-2">{t.uploadText}</p>
          <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-[var(--radius-control)] border border-dashed border-line-strong bg-canvas px-4 py-3 font-semibold hover:bg-sunken">
            <FileUp className="size-6 shrink-0" aria-hidden />
            <span className="min-w-0 break-all">{file ? file.name : t.upload}</span>
            <input type="file" accept={ACCEPT} capture="environment" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <Field label={t.uploadIssued} optional>
            <Input type="date" max={today} value={issued} onChange={(e) => setIssued(e.target.value)} />
          </Field>
          <FormError>{err ?? submit.error}</FormError>
        </div>
      </Dialog>
    </>
  );
}

/** Aprobarea (cu data de valabilitate) sau respingerea (cu motiv) unui document. */
export function VisaDecision({ doc, playerName, validityMonths, today }: {
  doc: { id: string; issued_on: string | null; path: string }; playerName: string; validityMonths: number; today: string;
}) {
  const defaultValidUntil = (issued: string) => addMonths(issued, validityMonths);
  const t = useT().performance.visas;
  const c = useT().common;
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);
  const [issued, setIssued] = useState(doc.issued_on ?? "");
  const [until, setUntil] = useState(doc.issued_on ? defaultValidUntil(doc.issued_on) : "");
  const [reason, setReason] = useState("");
  const decide = useAction(decideVisaDocument, { onSuccess: () => setMode(null) });
  const href = `/api/files/visas/${doc.path.split("/").map(encodeURIComponent).join("/")}`;
  return (
    <div className="flex flex-wrap gap-2">
      <a href={href} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-[var(--radius-control)] border border-border-control bg-surface px-3 text-sm font-semibold hover:bg-canvas">{t.viewDoc}</a>
      <Button size="sm" icon={<Check className="size-4" aria-hidden />} onClick={() => setMode("approve")}>{t.approve}</Button>
      <Button size="sm" variant="secondary" icon={<X className="size-4" aria-hidden />} onClick={() => setMode("reject")}>{t.reject}</Button>
      <Dialog open={mode === "approve"} onClose={() => setMode(null)} title={t.approveTitle(playerName)}
        footer={<>
          <Button variant="ghost" onClick={() => setMode(null)}>{c.actions.cancel}</Button>
          <Button disabled={!until} pending={decide.pending} onClick={() => decide.run({ id: doc.id, approve: true, validUntil: until, issuedOn: issued || null })}>{t.approve}</Button>
        </>}>
        <div className="space-y-4">
          <p className="text-ink-2">{t.approveText}</p>
          <a href={href} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-4">{t.viewDoc}</a>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.issuedOn} optional>
              <Input type="date" max={today} value={issued} onChange={(e) => { setIssued(e.target.value); if (e.target.value) setUntil(defaultValidUntil(e.target.value)); }} />
            </Field>
            <Field label={t.validUntil}><Input type="date" min={today} value={until} onChange={(e) => setUntil(e.target.value)} /></Field>
          </div>
          <FormError>{decide.error}</FormError>
        </div>
      </Dialog>
      <Dialog open={mode === "reject"} onClose={() => setMode(null)} title={t.rejectTitle(playerName)}
        footer={<>
          <Button variant="ghost" onClick={() => setMode(null)}>{c.actions.cancel}</Button>
          <Button variant="danger" disabled={!reason.trim()} pending={decide.pending} onClick={() => decide.run({ id: doc.id, approve: false, reason })}>{t.reject}</Button>
        </>}>
        <div className="space-y-4">
          <Field label={t.rejectReason}><Textarea rows={3} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} /></Field>
          <FormError>{decide.error}</FormError>
        </div>
      </Dialog>
    </div>
  );
}

export function VisaRemindButton({ playerIds }: { playerIds: string[] }) {
  const t = useT().performance.visas;
  const toast = useToast();
  const remind = useAction(sendVisaReminders, { refresh: false, onSuccess: (r) => toast(t.reminded(r.sent)) });
  if (!playerIds.length) return null;
  return (
    <Button variant="secondary" size="sm" pending={remind.pending} icon={<BellRing className="size-4" aria-hidden />} onClick={() => remind.run({ playerIds })}>
      {t.remind}
    </Button>
  );
}
