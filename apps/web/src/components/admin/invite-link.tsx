"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { useT } from "@/messages";

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function CopyButton({ text, label, size = "md" }: { text: string; label?: string; size?: "sm" | "md" }) {
  const t = useT().admin.link;
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary" size={size}
      icon={copied ? <Check className="size-5" aria-hidden /> : <Copy className="size-5" aria-hidden />}
      onClick={async () => {
        if (await copyText(text)) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        }
      }}
    >
      {copied ? t.copied : label ?? t.copy}
    </Button>
  );
}

export type IssuedLink = { link: string; emailed: boolean; kind: "invite" | "recovery"; email: string; name: string };

/** Linkul de invitație / resetare, afișat o singură dată, ca să poată fi trimis și pe altă cale decât e-mailul. */
export function InviteLink({ issued }: { issued: IssuedLink }) {
  const t = useT().admin.link;
  return (
    <div className="space-y-3">
      <Notice tone={issued.emailed ? "green" : "yellow"} title={issued.emailed ? t.emailed(issued.email) : t.notEmailed}>
        {issued.emailed ? t.emailedHint : t.notEmailedHint}
      </Notice>
      <div>
        <p className="mb-1 text-sm font-semibold text-ink-2">{issued.kind === "invite" ? t.inviteFor(issued.name) : t.resetFor(issued.name)}</p>
        <div className="flex gap-2">
          <Input readOnly value={issued.link} aria-label={t.linkLabel} onFocus={(e) => e.currentTarget.select()} className="min-w-0 font-mono text-sm" />
          <CopyButton text={issued.link} />
        </div>
        <p className="mt-2 text-sm text-ink-3">{issued.kind === "invite" ? t.inviteRules : t.resetRules}</p>
      </div>
    </div>
  );
}
