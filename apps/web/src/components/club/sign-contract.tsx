"use client";
import { useEffect, useRef, useState } from "react";
import { Eraser, PenLine, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Checkbox, Field, FormError, Input, Textarea } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { uploadFile } from "@/lib/upload";
import { useT } from "@/messages";
import { declineContract, signContract } from "@/app/(app)/club/contracte/actions";

/** Chenarul de semnătură: degetul sau mouse-ul, linie neagră pe alb, exportat ca PNG. */
function SignaturePad({ onChange }: { onChange: (empty: boolean) => void; }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  useEffect(() => {
    const c = ref.current!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0e1726";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
  }, []);
  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
  return (
    <canvas ref={ref} aria-label={useT().club.contracts.family.draw} role="img"
      className="h-44 w-full touch-none rounded-[var(--radius-control)] border-2 border-dashed border-line-strong bg-white"
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); drawing.current = true; const ctx = e.currentTarget.getContext("2d")!; const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); }}
      onPointerMove={(e) => { if (!drawing.current) return; const ctx = e.currentTarget.getContext("2d")!; const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke(); if (!dirty.current) { dirty.current = true; onChange(false); } }}
      onPointerUp={() => { drawing.current = false; }}
      onPointerCancel={() => { drawing.current = false; }}
    />
  );
}

export function SignContract({ id, clubId, defaultName }: { id: string; clubId: string; defaultName: string }) {
  const t = useT().club.contracts.family;
  const e = useT().club.contracts.errors;
  const c = useT().common;
  const [read, setRead] = useState(false);
  const [name, setName] = useState(defaultName);
  const [empty, setEmpty] = useState(true);
  const [padKey, setPadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState("");
  const wrap = useRef<HTMLDivElement>(null);
  const sign = useAction(signContract);
  const decline = useAction(declineContract, { onSuccess: () => setDeclineOpen(false) });
  const submit = async () => {
    const canvas = wrap.current?.querySelector("canvas");
    if (!canvas || empty) { setErr(e.signature); return; }
    setBusy(true); setErr(null);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (!blob) { setBusy(false); setErr(e.upload); return; }
    const path = `${clubId}/${id}/semnatura-${crypto.randomUUID()}.png`;
    const up = await uploadFile("contracts", path, blob);
    setBusy(false);
    if (!up.ok) { setErr(e.upload); return; }
    await sign.run({ id, name, signaturePath: path });
  };
  return (
    <div className="space-y-4 rounded-[var(--radius-card)] border border-line/70 bg-surface p-4 shadow-[var(--shadow-card)]">
      <Checkbox label={t.read} checked={read} onChange={(ev) => setRead(ev.target.checked)} />
      <Field label={t.name} hint={t.nameHint}><Input value={name} maxLength={120} autoComplete="name" onChange={(ev) => setName(ev.target.value)} /></Field>
      <div ref={wrap}>
        <p className="mb-1 text-sm font-semibold text-ink-2">{t.draw}</p>
        <SignaturePad key={padKey} onChange={setEmpty} />
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="text-sm text-ink-3">{t.drawHint}</p>
          <Button variant="ghost" size="sm" icon={<Eraser className="size-4" aria-hidden />} onClick={() => { setPadKey(padKey + 1); setEmpty(true); }}>{t.clear}</Button>
        </div>
      </div>
      <p className="text-sm text-ink-3">{t.legal}</p>
      <FormError>{err ?? sign.error}</FormError>
      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="ghost" icon={<X className="size-5" aria-hidden />} onClick={() => setDeclineOpen(true)}>{t.decline}</Button>
        <Button size="lg" disabled={!read || name.trim().length < 3 || empty} pending={busy || sign.pending} icon={<PenLine className="size-5" aria-hidden />} onClick={submit}>{t.sign}</Button>
      </div>
      <Dialog open={declineOpen} onClose={() => setDeclineOpen(false)} title={t.decline}
        footer={<>
          <Button variant="ghost" onClick={() => setDeclineOpen(false)}>{c.actions.cancel}</Button>
          <Button variant="danger" disabled={reason.trim().length < 2} pending={decline.pending} onClick={() => decline.run({ id, reason })}>{t.decline}</Button>
        </>}>
        <Field label={t.declineReason}><Textarea rows={3} value={reason} maxLength={500} onChange={(ev) => setReason(ev.target.value)} /></Field>
        <FormError>{decline.error}</FormError>
      </Dialog>
    </div>
  );
}
