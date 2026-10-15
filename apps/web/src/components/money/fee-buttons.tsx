"use client";
import { BellRing, ReceiptText } from "lucide-react";
import { formatLei } from "@club/shared";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { issueCharges, remindOverdue } from "@/app/(app)/bani/taxe/actions";

export function IssueButton({ period, label, variant = "primary", size = "md" }: { period: string; label?: string; variant?: "primary" | "secondary"; size?: "sm" | "md" }) {
  const t = useT().money.fees;
  const toast = useToast();
  const a = useAction(issueCharges, { successMessage: false, onSuccess: (r) => toast(t.issued(r.created, formatLei(r.total))) });
  return (
    <Button variant={variant} size={size} pending={a.pending} icon={<ReceiptText className="size-5" aria-hidden />} onClick={() => a.run({ period })}>
      {label ?? t.issueNow}
    </Button>
  );
}

export function RemindButton({ families }: { families: number }) {
  const t = useT().money.fees;
  const toast = useToast();
  const a = useAction(remindOverdue, { successMessage: false, refresh: false, onSuccess: (n) => toast(t.reminded(n)) });
  return (
    <Button variant="secondary" disabled={families === 0} pending={a.pending} icon={<BellRing className="size-5" aria-hidden />} onClick={() => a.run()}>
      {t.remind(families)}
    </Button>
  );
}
