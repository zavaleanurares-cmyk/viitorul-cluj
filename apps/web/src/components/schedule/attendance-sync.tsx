"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { bumpTries, pendingAttendance, queueAvailable, removeAttendance } from "@/lib/offline-queue";
import { syncAttendance } from "@/app/(app)/program/[id]/prezenta/actions";

let flushing: Promise<{ sent: number; pending: number; error: string | null }> | null = null;

/** Trimite tot ce e în coada offline. Rulează o singură dată în paralel. */
export function flushAttendanceQueue() {
  if (flushing) return flushing;
  flushing = (async () => {
    let sent = 0;
    let error: string | null = null;
    for (const item of await pendingAttendance()) {
      try {
        const res = await syncAttendance({ eventId: item.eventId, rows: item.rows });
        if (res.ok) {
          sent++;
          await removeAttendance(item.eventId, item.savedAt);
        } else {
          error = res.error;
          await bumpTries(item);
        }
      } catch {
        // fără rețea: rămâne în coadă
        break;
      }
    }
    const pending = (await pendingAttendance()).length;
    return { sent, pending, error };
  })().finally(() => { flushing = null; });
  return flushing;
}

/** Montat o dată în aplicație: golește coada la pornire, la revenirea semnalului și periodic cât mai e ceva în ea. */
export function AttendanceSync() {
  const router = useRouter();
  useEffect(() => {
    if (!queueAvailable()) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const run = async () => {
      if (!navigator.onLine) return;
      const r = await flushAttendanceQueue();
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
  }, [router]);
  return null;
}

/** Ce prezențe așteaptă trimiterea și când s-a golit ultima dată coada (pentru ecranul de prezență și Azi). */
export function usePendingAttendance() {
  const [state, setState] = useState<{ ids: string[]; drainedAt: string | null }>({ ids: [], drainedAt: null });
  useEffect(() => {
    if (!queueAvailable()) return;
    const read = () => pendingAttendance().then((q) => {
      const ids = q.map((x) => x.eventId);
      setState((prev) => ({ ids, drainedAt: prev.ids.some((id) => !ids.includes(id)) ? new Date().toISOString() : prev.drainedAt }));
    });
    read();
    window.addEventListener("attendance-queue", read);
    window.addEventListener("online", read);
    return () => {
      window.removeEventListener("attendance-queue", read);
      window.removeEventListener("online", read);
    };
  }, []);
  return state;
}
