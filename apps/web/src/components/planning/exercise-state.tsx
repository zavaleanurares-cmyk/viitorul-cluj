"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/messages";
import { useAction } from "@/lib/use-action";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/overlay";
import { deleteExercise, setExerciseActive } from "@/app/(app)/biblioteca/actions";

/** Dezactivare / reactivare și ștergere (doar dacă exercițiul nu este folosit nicăieri). */
export function ExerciseState({ id, isActive, inUse }: { id: string; isActive: boolean; inUse: boolean }) {
  const t = useT();
  const d = t.library.detail;
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const toggle = useAction(setExerciseActive, { successMessage: isActive ? d.deactivated : d.reactivated });
  const remove = useAction(deleteExercise, { successMessage: d.deleted, refresh: false, onSuccess: () => router.push("/biblioteca") });

  return (
    <Card>
      <CardHeader title={d.state} description={isActive ? d.active : d.inactiveNote} />
      <CardBody className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" pending={toggle.pending} onClick={() => toggle.run({ id, active: !isActive })}>
            {isActive ? d.deactivate : d.reactivate}
          </Button>
          {!inUse ? <Button variant="ghost" onClick={() => setConfirm(true)}>{d.delete}</Button> : null}
        </div>
        {inUse ? <p className="text-sm text-ink-3">{d.cannotDelete}</p> : null}
      </CardBody>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title={d.deleteTitle}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>{t.common.actions.cancel}</Button>
            <Button variant="danger" pending={remove.pending} onClick={() => remove.run({ id })}>{d.delete}</Button>
          </>
        }>
        <p>{d.deleteConfirm} {t.common.confirmDelete}</p>
      </Dialog>
    </Card>
  );
}
