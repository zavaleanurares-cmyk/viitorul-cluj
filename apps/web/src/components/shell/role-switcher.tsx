"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { useT } from "@/messages";
import { cn } from "@/lib/cn";
import { switchMembership } from "./actions";

export type MembershipOption = { id: string; label: string; current: boolean };

/** Alegerea clubului / rolului curent, pentru conturile cu mai multe roluri. */
export function RoleSwitcher({ memberships, tone }: { memberships: MembershipOption[]; tone: "brand" | "plain" }) {
  const t = useT().common.roles;
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const current = memberships.find((m) => m.current)?.id ?? "";
  return (
    <label className="mt-2 block">
      <span className={cn("mb-1 block text-sm font-semibold", tone === "brand" ? "opacity-90" : "text-ink-2")}>{t.switch}</span>
      <select
        value={current}
        disabled={busy}
        onChange={async (e) => {
          setBusy(true);
          const res = await switchMembership(e.target.value);
          setBusy(false);
          if (!res.ok) return toast(res.error, "error");
          router.push("/");
          router.refresh();
        }}
        className={cn("h-11 w-full rounded-lg px-2 font-semibold",
          tone === "brand" ? "border border-brand-ink/40 bg-brand text-brand-ink" : "border border-border-control bg-surface text-ink")}
      >
        {memberships.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
      </select>
    </label>
  );
}
