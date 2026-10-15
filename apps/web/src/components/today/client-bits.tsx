"use client";
import { useEffect } from "react";
import { CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePendingAttendance, flushAttendanceQueue, useQueueUser } from "@/components/schedule/attendance-sync";
import { useT } from "@/messages";

/** Cere service worker-ului să păstreze ecranele de prezență ale zilei, ca să meargă și fără semnal la teren. */
export function WarmOffline({ urls }: { urls: string[] }) {
  const key = urls.join("|");
  useEffect(() => {
    if (!key) return;
    navigator.serviceWorker?.ready.then((reg) => reg.active?.postMessage({ type: "warm", urls: key.split("|") })).catch(() => {});
  }, [key]);
  return null;
}

/** Prezențele salvate offline care încă nu au ajuns la server. */
export function PendingSyncNotice() {
  const m = useT();
  const userId = useQueueUser();
  const { ids, failed } = usePendingAttendance();
  if (!ids.length || !userId) return null;
  const refused = Object.keys(failed).length;
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] bg-st-yellow-soft px-4 py-3">
      <CloudOff className="size-5 shrink-0" aria-hidden />
      <span className="flex-1">
        <span className="block font-semibold">{m.today.pendingSync(ids.length)}</span>
        {refused ? <span className="block text-sm text-ink-2">{m.schedule.attendance.refused(refused)}</span> : null}
      </span>
      <Button variant="secondary" size="sm" onClick={() => flushAttendanceQueue(userId, { force: true })}>{m.schedule.attendance.retry}</Button>
    </div>
  );
}
