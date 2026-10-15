"use client";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { cancelMessage } from "@/app/(app)/club/mesaje/actions";

export function CancelMessageButton({ id }: { id: string }) {
  const t = useT().club.messages;
  const cancel = useAction(cancelMessage);
  return <Button variant="secondary" icon={<X className="size-5" aria-hidden />} pending={cancel.pending} onClick={() => cancel.run({ id })}>{t.cancel}</Button>;
}
