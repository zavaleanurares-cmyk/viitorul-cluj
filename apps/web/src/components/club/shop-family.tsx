"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { cancelOrder } from "@/app/(app)/club/magazin/actions";

export function CancelOwnOrder({ id }: { id: string }) {
  const t = useT().club.shop.family;
  const [sure, setSure] = useState(false);
  const go = useAction(cancelOrder);
  return sure ? <Button size="sm" variant="danger" pending={go.pending} onClick={() => go.run({ id, reason: "" })}>{t.cancel}</Button>
    : <Button size="sm" variant="ghost" onClick={() => setSure(true)}>{t.cancel}</Button>;
}
