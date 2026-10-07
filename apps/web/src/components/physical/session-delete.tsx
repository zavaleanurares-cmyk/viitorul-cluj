"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteSession } from "@/app/(app)/fizic/actions";
import { ConfirmDialog } from "@/components/players/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";

export function SessionDeleteButton({ sessionId, backHref, rows }: { sessionId: string; backHref: string; rows: number }) {
  const t = useT().physical.session;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const remove = useAction(deleteSession, { refresh: false, onSuccess: () => router.replace(backHref) });
  return (
    <>
      <Button variant="secondary" icon={<Trash2 className="size-5" aria-hidden />} onClick={() => setOpen(true)}>{t.delete}</Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={t.deleteTitle}
        confirmLabel={t.deleteConfirm}
        pending={remove.pending}
        error={remove.error}
        onConfirm={() => remove.run({ id: sessionId })}
      >
        {t.deleteText(rows)}
      </ConfirmDialog>
    </>
  );
}
