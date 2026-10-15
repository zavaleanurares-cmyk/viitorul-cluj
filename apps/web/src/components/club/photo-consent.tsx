"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { withdrawPhotoConsent } from "@/app/(app)/club/site/actions";

export function WithdrawConsentButton({ playerId }: { playerId: string }) {
  const t = useT().club.website.family;
  const [sure, setSure] = useState(false);
  const go = useAction(withdrawPhotoConsent, { onSuccess: () => setSure(false) });
  return sure ? (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-ink-2">{t.withdrawConfirm}</span>
      <Button size="sm" variant="danger" pending={go.pending} onClick={() => go.run(playerId)}>{t.withdraw}</Button>
    </span>
  ) : <Button size="sm" variant="secondary" onClick={() => setSure(true)}>{t.withdraw}</Button>;
}
