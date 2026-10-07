"use client";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { useT } from "@/messages";

/** Confirmare pentru operațiunile care nu pot fi anulate. */
export function ConfirmDialog({ open, onClose, title, children, confirmLabel, onConfirm, pending, error, danger = true }: {
  open: boolean; onClose: () => void; title: ReactNode; children?: ReactNode; confirmLabel: string;
  onConfirm: () => void; pending?: boolean; error?: string | null; danger?: boolean;
}) {
  const c = useT().common;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{c.actions.cancel}</Button>
          <Button variant={danger ? "danger" : "primary"} pending={pending} onClick={onConfirm}>{confirmLabel}</Button>
        </>
      }
    >
      <div className="space-y-3">
        {children ? <div className="text-ink-2">{children}</div> : null}
        <FormError>{error}</FormError>
      </div>
    </Dialog>
  );
}
