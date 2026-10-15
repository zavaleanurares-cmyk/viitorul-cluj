"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ban, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { useT } from "@/messages";
import { setEventState } from "@/app/(app)/program/actions";

/** Modifică / anulează / șterge un eveniment; ștergerea are Anulează în mesaj (coș 30 de zile). */
export function EventActions({ id, cancelled, inSeries, canEdit }: { id: string; cancelled: boolean; inSeries: boolean; canEdit: boolean }) {
  const t = useT().schedule.event;
  const c = useT().common.actions;
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | "delete" | "cancel">(null);

  const act = async (state: "cancelled" | "scheduled" | "deleted", scope: "one" | "following") => {
    setBusy(true);
    const res = await setEventState({ id, state, scope });
    setBusy(false);
    setConfirm(null);
    if (!res.ok) return toast(res.error, "error");
    if (state === "deleted") {
      toast(res.data > 1 ? t.deletedMany(res.data) : t.deleted, "ok", {
        undo: async () => { await setEventState({ id, state: "restored", scope }); router.refresh(); router.push(`/program/${id}`); },
      });
      router.push("/program");
    } else {
      toast(state === "cancelled" ? t.cancelledMsg : t.rescheduled);
      router.refresh();
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {canEdit ? <LinkButton href={`/program/${id}/modifica`} icon={<Pencil className="size-5" aria-hidden />}>{t.edit}</LinkButton> : null}
      {cancelled ? (
        <Button variant="secondary" pending={busy} icon={<RotateCcw className="size-5" aria-hidden />} onClick={() => act("scheduled", "one")}>{t.restoreCancelled}</Button>
      ) : (
        <Button variant="ghost" pending={busy} icon={<Ban className="size-5" aria-hidden />} onClick={() => (inSeries ? setConfirm("cancel") : act("cancelled", "one"))}>{t.cancel}</Button>
      )}
      <Button variant="ghost" pending={busy} icon={<Trash2 className="size-5" aria-hidden />} onClick={() => setConfirm("delete")}>{t.delete}</Button>

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)} title={confirm === "delete" ? t.deleteTitle : t.cancel}
        footer={<>
          <Button variant="ghost" onClick={() => setConfirm(null)}>{c.cancel}</Button>
          {inSeries ? <Button variant="secondary" pending={busy} onClick={() => act(confirm === "delete" ? "deleted" : "cancelled", "following")}>{t.deleteFollowing}</Button> : null}
          <Button variant={confirm === "delete" ? "danger" : "primary"} pending={busy} onClick={() => act(confirm === "delete" ? "deleted" : "cancelled", "one")}>{inSeries ? t.deleteOne : confirm === "delete" ? t.delete : t.cancel}</Button>
        </>}>
        <p className="text-ink-2">{confirm === "delete" ? t.deleteText : t.cancelSeries}</p>
      </Dialog>
    </div>
  );
}
