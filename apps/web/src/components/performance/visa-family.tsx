import { Clock } from "lucide-react";
import type { VisaState } from "@/components/squad/queries";
import { Notice } from "@/components/ui/card";
import { VisaUploadButton } from "./visa";
import { getT } from "@/messages";

/**
 * Pentru părinte (și jucătorul adult): ce are de făcut cu viza medicală.
 * În verificare → doar starea; expirată, lipsă, pe cale să expire sau respinsă → buton de încărcare.
 */
export function VisaFamilyNotice({ playerId, playerName, state, today, last, self = false }: {
  playerId: string; playerName: string; state: VisaState; today: string; last: { status: string; reject_reason: string | null } | null;
  /** jucătorul adult, pentru el însuși */
  self?: boolean;
}) {
  const t = getT().performance.visas;
  const f = getT().today.visa;
  if (last?.status === "pending") {
    return <p className="inline-flex items-center gap-2 text-sm font-semibold text-ink-2"><Clock className="size-4" aria-hidden />{f.pending}</p>;
  }
  const rejected = last?.status === "rejected" ? last.reject_reason : null;
  if (state === "ok" && !rejected) return null;
  return (
    <Notice tone={state === "expired" || state === "missing" ? "red" : "yellow"} title={rejected ? t.statusRejected(rejected) : f[state === "ok" ? "expiring" : state]}>
      <p className="mb-2">{self ? f.textSelf : f.text}</p>
      <VisaUploadButton playerId={playerId} playerName={playerName} today={today} size="sm" />
    </Notice>
  );
}
