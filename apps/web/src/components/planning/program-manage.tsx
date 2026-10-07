"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Copy, Trash2 } from "lucide-react";
import { useT } from "@/messages";
import { useAction } from "@/lib/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/overlay";
import { deleteProgram, duplicateProgram, setProgramActive } from "@/app/(app)/programe/actions";

/** Duplicare, arhivare și ștergere (doar dacă programul nu are alocări). */
export function ProgramManage({ id, isActive, hasAssignments }: { id: string; isActive: boolean; hasAssignments: boolean }) {
  const all = useT();
  const t = all.planning.programs;
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const duplicate = useAction(duplicateProgram, { successMessage: t.duplicated, refresh: false, onSuccess: (d) => router.push(`/programe/${d.id}`) });
  const archive = useAction(setProgramActive, { successMessage: isActive ? t.archivedDone : t.unarchivedDone });
  const remove = useAction(deleteProgram, { successMessage: t.deleted, refresh: false, onSuccess: () => router.push("/programe") });

  return (
    <Card>
      <CardHeader title={t.manage} />
      <CardBody className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" pending={duplicate.pending} icon={<Copy className="size-5" aria-hidden />} onClick={() => duplicate.run({ id })}>{t.duplicate}</Button>
          <Button variant="secondary" pending={archive.pending}
            icon={isActive ? <Archive className="size-5" aria-hidden /> : <ArchiveRestore className="size-5" aria-hidden />}
            onClick={() => archive.run({ id, active: !isActive })}>
            {isActive ? t.archive : t.unarchive}
          </Button>
          {!hasAssignments ? (
            <Button variant="ghost" icon={<Trash2 className="size-5" aria-hidden />} onClick={() => setConfirm(true)}>{t.delete}</Button>
          ) : null}
        </div>
        <p className="text-sm text-ink-3">{hasAssignments ? t.deleteBlocked : t.archiveNote}</p>
      </CardBody>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title={t.deleteTitle}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>{all.common.actions.cancel}</Button>
            <Button variant="danger" pending={remove.pending} onClick={() => remove.run({ id })}>{t.delete}</Button>
          </>
        }>
        <p>{t.deleteConfirm} {all.common.confirmDelete}</p>
      </Dialog>
    </Card>
  );
}
