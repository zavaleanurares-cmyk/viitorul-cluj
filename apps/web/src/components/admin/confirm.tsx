"use client";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { useT } from "@/messages";

/**
 * Confirmare pentru operațiunile care nu pot fi anulate. Cu `requireText`, butonul se activează
 * doar după ce utilizatorul tastează exact textul cerut (numele jucătorului).
 */
export function Confirm({ open, onClose, title, children, confirmLabel, onConfirm, pending, error, requireText, danger = true }: {
  open: boolean; onClose: () => void; title: ReactNode; children?: ReactNode; confirmLabel: string;
  onConfirm: (typed: string) => void; pending?: boolean; error?: string | null; requireText?: string; danger?: boolean;
}) {
  const t = useT().admin.confirm;
  const c = useT().common;
  const [typed, setTyped] = useState("");
  const matches = !requireText || typed.trim() === requireText.trim();
  const close = () => {
    setTyped("");
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={close}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={close}>{c.actions.cancel}</Button>
          <Button variant={danger ? "danger" : "primary"} pending={pending} disabled={!matches} onClick={() => onConfirm(typed.trim())}>{confirmLabel}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {children ? <div className="space-y-2 text-ink-2">{children}</div> : null}
        {requireText ? (
          <Field label={t.typeName(requireText)} hint={t.typeHint}>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false} />
          </Field>
        ) : null}
        <FormError>{error}</FormError>
      </div>
    </Dialog>
  );
}
