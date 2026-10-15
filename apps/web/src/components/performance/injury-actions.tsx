"use client";
import { useState } from "react";
import { ChevronsRight, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/players/confirm-dialog";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { advanceInjuryStage, markInjuryRecovered } from "@/app/(app)/lot/jucatori/[id]/(fisa)/medical/actions";

/** Acțiunile preparatorului pe un rând din lista de accidentări: etapa următoare și „Recuperat". */
export function InjuryActions({ injuryId, playerName, canAdvance }: { injuryId: string; playerName: string; canAdvance: boolean }) {
  const t = useT().performance.medical;
  const [confirm, setConfirm] = useState(false);
  const advance = useAction(advanceInjuryStage);
  const recover = useAction(markInjuryRecovered, { onSuccess: () => setConfirm(false) });
  return (
    <div className="flex flex-wrap gap-2">
      {canAdvance ? (
        <Button variant="secondary" size="sm" pending={advance.pending} icon={<ChevronsRight className="size-4" aria-hidden />} onClick={() => advance.run({ id: injuryId })}>
          {t.advance}
        </Button>
      ) : null}
      <Button variant="secondary" size="sm" icon={<CircleCheck className="size-4" aria-hidden />} onClick={() => setConfirm(true)}>{t.recovered}</Button>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title={t.recoveredTitle(playerName)} confirmLabel={t.recovered}
        danger={false} pending={recover.pending} error={recover.error ?? advance.error} onConfirm={() => recover.run({ id: injuryId })}>
        {t.recoveredText}
      </ConfirmDialog>
    </div>
  );
}
