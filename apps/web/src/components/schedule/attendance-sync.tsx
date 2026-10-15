"use client";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { MAX_TRIES, markFailed, pendingAttendance, queueAvailable, removeAttendance } from "@/lib/offline-queue";
import { syncAttendance } from "@/app/(app)/program/[id]/prezenta/actions";

/** Cine e conectat acum (coada offline e împărțită pe utilizatori). Pus de AppShell. */
export const QueueUserContext = createContext<string | null>(null);
export const useQueueUser = () => useContext(QueueUserContext);

type FlushResult = { sent: number; pending: number; error: string | null };
let flushing: Promise<FlushResult> | null = null;

/**
 * Trimite ce e în coada offline a utilizatorului. Rulează o singură dată în paralel.
 * Intrările refuzate de server de MAX_TRIES ori nu se mai reîncearcă singure, doar la „Trimite acum" (force).
 */
export function flushAttendanceQueue(userId: string, opts: { force?: boolean } = {}) {
  if (flushing) return flushing;
  flushing = (async () => {
    let sent = 0;
    let error: string | null = null;
    for (const item of await pendingAttendance(userId)) {
      if (item.tries >= MAX_TRIES && !opts.force) continue;
      try {
        const res = await syncAttendance({ eventId: item.eventId, rows: item.rows });
        if (res.ok) {
          sent++;
          await removeAttendance(item);
        } else {
          error = res.error;
          await markFailed(item, res.error);
        }
      } catch {
        // fără rețea: rămâne în coadă
        break;
      }
    }
    const pending = (await pendingAttendance(userId)).filter((q) => q.tries < MAX_TRIES).length;
    return { sent, pending, error };
  })().finally(() => { flushing = null; });
  return flushing;
}

/** Montat o dată în aplicație: golește coada la pornire, la revenirea semnalului și periodic cât mai e ceva în ea. */
export function AttendanceSync({ userId }: { userId: string }) {
  const router = useRouter();
  useEffect(() => {
    if (!queueAvailable()) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const run = async () => {
      if (!navigator.onLine) return;
      const r = await flushAttendanceQueue(userId);
      if (r.sent) router.refresh();
      if (!r.pending && timer) { clearInterval(timer); timer = null; }
      if (r.pending && !timer) timer = setInterval(run, 30000);
    };
    run();
    window.addEventListener("online", run);
    window.addEventListener("attendance-queue", run);
    return () => {
      window.removeEventListener("online", run);
      window.removeEventListener("attendance-queue", run);
      if (timer) clearInterval(timer);
    };
  }, [router, userId]);
  return null;
}

type PendingState = { ids: string[]; failed: Record<string, string>; drainedAt: string | null };

/** Ce prezențe așteaptă trimiterea, care au fost refuzate și când s-a golit ultima dată coada. */
export function usePendingAttendance() {
  const userId = useQueueUser();
  const [state, setState] = useState<PendingState>({ ids: [], failed: {}, drainedAt: null });
  useEffect(() => {
    if (!queueAvailable() || !userId) return;
    const read = () => pendingAttendance(userId).then((q) => {
      const ids = q.map((x) => x.eventId);
      const failed = Object.fromEntries(q.filter((x) => x.tries >= MAX_TRIES).map((x) => [x.eventId, x.lastError ?? ""]));
      setState((prev) => ({ ids, failed, drainedAt: prev.ids.some((id) => !ids.includes(id)) ? new Date().toISOString() : prev.drainedAt }));
    });
    read();
    window.addEventListener("attendance-queue", read);
    window.addEventListener("online", read);
    return () => {
      window.removeEventListener("attendance-queue", read);
      window.removeEventListener("online", read);
    };
  }, [userId]);
  return state;
}
