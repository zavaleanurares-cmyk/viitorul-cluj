"use client";
import { useState } from "react";
import { BadgeEuro, ChevronRight, ClipboardList, Crown, HeartPulse, Loader2, Shirt, Target, Users } from "lucide-react";
import { FormError } from "@/components/ui/form";
import { enterDemo } from "@/lib/auth-actions";
import { useT } from "@/messages";

const ICONS: Record<string, typeof Crown> = {
  patron: Crown, director: Target, secretariat: ClipboardList, contabil: BadgeEuro,
  "antrenor.juniori": Users, preparator: HeartPulse, parinte: Users, jucator: Shirt,
};

/** Rolurile demo: un rând pe rol, toate la fel de înalte. */
export function DemoRoles({ roles }: { roles: string[] }) {
  const t = useT().auth.demo;
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function go(role: string) {
    setPending(role);
    setError(null);
    const res = await enterDemo({ role });
    if (res.ok) { window.location.assign(res.data.to); return; }
    setError(res.error);
    setPending(null);
  }
  return (
    <div className="space-y-3">
      <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        {roles.map((r) => {
          const Icon = ICONS[r] ?? Users;
          const [name, what] = t.roles[r] ?? [r, ""];
          return (
            <li key={r}>
              <button type="button" disabled={!!pending} onClick={() => go(r)}
                className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken focus-visible:bg-sunken disabled:opacity-60">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand"><Icon className="size-5" aria-hidden /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{name}</span>
                  <span className="block truncate text-sm text-ink-3">{what}</span>
                </span>
                {pending === r ? <Loader2 className="size-5 animate-spin text-ink-3" aria-hidden /> : <ChevronRight className="size-5 text-ink-3" aria-hidden />}
              </button>
            </li>
          );
        })}
      </ul>
      <FormError>{error}</FormError>
    </div>
  );
}
