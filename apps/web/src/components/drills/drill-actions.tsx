"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Copy, Pencil, Trash2 } from "lucide-react";
import { copyDrill, deleteDrill, setDrillArchived } from "@/app/(app)/program/sectiuni/actions";
import { Button, LinkButton } from "@/components/ui/button";
import { Confirm } from "@/components/admin/confirm";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";

/** Acțiunile din pagina unei secțiuni: modificare și arhivare (autorul sau biroul), copie (oricine din staff). */
export function DrillActions({ id, name, canEdit, canCopy, archived }: { id: string; name: string; canEdit: boolean; canCopy: boolean; archived: boolean }) {
  const t = useT().drills.view;
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const copy = useAction(copyDrill, { refresh: false, onSuccess: (r) => router.push(`/program/sectiuni/${r.id}/modifica`) });
  const archive = useAction(setDrillArchived);
  const remove = useAction(deleteDrill, { refresh: false, onSuccess: () => router.push("/program/sectiuni") });
  return (
    <div className="flex flex-wrap gap-2 no-print">
      {canEdit ? <LinkButton href={`/program/sectiuni/${id}/modifica`} variant="primary" icon={<Pencil className="size-5" aria-hidden />}>{t.edit}</LinkButton> : null}
      {canCopy ? <Button variant="secondary" pending={copy.pending} icon={<Copy className="size-5" aria-hidden />} onClick={() => copy.run({ id })}>{t.copy}</Button> : null}
      {canEdit ? (
        <Button variant="secondary" pending={archive.pending} icon={archived ? <ArchiveRestore className="size-5" aria-hidden /> : <Archive className="size-5" aria-hidden />}
          onClick={() => archive.run({ id, archived: !archived })}>
          {archived ? t.unarchive : t.archive}
        </Button>
      ) : null}
      {canEdit ? (
        <>
          <Button variant="ghost" className="text-st-red" icon={<Trash2 className="size-5" aria-hidden />} onClick={() => setConfirm(true)}>{t.delete}</Button>
          <Confirm open={confirm} onClose={() => setConfirm(false)} title={t.delete} confirmLabel={t.delete}
            pending={remove.pending} error={remove.error} onConfirm={() => remove.run({ id })}>
            {t.deleteConfirm(name)}
          </Confirm>
        </>
      ) : null}
    </div>
  );
}
