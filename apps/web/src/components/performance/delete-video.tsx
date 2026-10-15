"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/players/confirm-dialog";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { deleteVideo } from "@/app/(app)/performanta/video/actions";

export function DeleteVideoButton({ id }: { id: string }) {
  const t = useT().performance.video;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const del = useAction(deleteVideo, { onSuccess: () => router.push("/performanta/video") });
  return (
    <>
      <Button variant="ghost" icon={<Trash2 className="size-5" aria-hidden />} onClick={() => setOpen(true)}>{t.delete}</Button>
      <ConfirmDialog open={open} onClose={() => setOpen(false)} title={t.delete} confirmLabel={t.delete} pending={del.pending} error={del.error} onConfirm={() => del.run({ id })}>{t.deleteText}</ConfirmDialog>
    </>
  );
}
