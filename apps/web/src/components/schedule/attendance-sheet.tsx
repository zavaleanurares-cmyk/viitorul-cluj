"use client";
import { useMemo, useState, useSyncExternalStore } from "react";
import { Check, ChevronLeft, CloudOff, RefreshCw, X } from "lucide-react";
import { ABSENCE_REASONS, ABSENCE_REASON_LABELS, ATTENDANCE_LABELS, type AbsenceReason } from "@club/shared";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { enqueueAttendance, queueAvailable } from "@/lib/offline-queue";
import { useT } from "@/messages";
import { cn } from "@/lib/cn";
import { flushAttendanceQueue, usePendingAttendance, useQueueUser } from "./attendance-sync";
import { syncAttendance } from "@/app/(app)/program/[id]/prezenta/actions";

type Player = { id: string; name: string; number: number | null; injured: boolean; status: string | null; reason: string | null };
/** `at`: când a atins antrenorul rândul (ora telefonului); rândurile neatinse nu suprascriu ce e deja pe server. */
type Mark = { status: "present" | "late" | "absent" | "injured"; reason: AbsenceReason | null; auto?: boolean; at?: string };

const subscribe = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); };
};
const useOnline = () => useSyncExternalStore(subscribe, () => navigator.onLine, () => true);

export function AttendanceSheet({ eventId, title, subtitle, players, savedAt, loadedAt }: { eventId: string; title: string; subtitle: string; players: Player[]; savedAt: string | null; loadedAt: string }) {
  const messages = useT();
  const t = messages.schedule.attendance;
  const toast = useToast();
  const online = useOnline();
  const queue = usePendingAttendance();
  const userId = useQueueUser();
  const initial = useMemo(() => {
    const m: Record<string, Mark> = {};
    for (const p of players) {
      if (p.status) m[p.id] = { status: p.status as Mark["status"], reason: (p.reason as AbsenceReason | null) ?? null };
      else if (p.injured) m[p.id] = { status: "injured", reason: "injured", auto: true };
      else m[p.id] = { status: "present", reason: null };
    }
    return m;
  }, [players]);
  const [marks, setMarks] = useState(initial);
  const [sheetFor, setSheetFor] = useState<Player | null>(null);
  const [screen, setScreen] = useState<"list" | "saved">(savedAt ? "saved" : "list");
  const [syncedAt, setSyncedAt] = useState<string | null>(savedAt);
  const [busy, setBusy] = useState(false);

  const isOut = (m: Mark) => m.status === "absent" || m.status === "injured";
  const present = players.filter((p) => !isOut(marks[p.id])).length;
  const absentees = players.filter((p) => isOut(marks[p.id]));
  const waiting = queue.ids.includes(eventId);
  const refused = eventId in queue.failed;
  const mark = (id: string, m: Omit<Mark, "at">) => setMarks((prev) => ({ ...prev, [id]: { ...m, at: new Date().toISOString() } }));
  const lastSent = [syncedAt, queue.drainedAt].filter(Boolean).sort().pop() ?? null;

  const save = async () => {
    setBusy(true);
    // trimitem doar ce a atins antrenorul și rândurile încă negăsite pe server (cu ora deschiderii paginii),
    // ca o listă deschisă de mult să nu șteargă o corectură făcută între timp de altcineva
    const rows = players
      .filter((p) => marks[p.id].at || !p.status)
      .map((p) => ({ player_id: p.id, status: marks[p.id].status, reason: marks[p.id].reason, recorded_at: marks[p.id].at ?? loadedAt }));
    if (!rows.length) {
      setBusy(false);
      setScreen("saved");
      return;
    }
    if (queueAvailable() && userId) {
      await enqueueAttendance(userId, eventId, rows);
      const r = await flushAttendanceQueue(userId, { force: true });
      if (!r.pending) setSyncedAt(new Date().toISOString());
      else if (r.error) toast(r.error, "error");
    } else {
      const res = await syncAttendance({ eventId, rows }).catch(() => null);
      if (res?.ok) setSyncedAt(new Date().toISOString());
      else toast(res && !res.ok ? res.error : t.offline, "error");
    }
    setBusy(false);
    setScreen("saved");
    window.scrollTo({ top: 0 });
  };

  const back = (
    <a href={`/program/${eventId}`} className="mb-1 inline-flex h-10 items-center gap-1 text-sm font-semibold text-ink-2 hover:text-ink">
      <ChevronLeft className="size-4" aria-hidden /> {t.backToEvent}
    </a>
  );

  if (screen === "saved") {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        {back}
        <div className="flex flex-col items-center gap-2 pt-2 text-center">
          <span aria-hidden className="inline-flex size-14 items-center justify-center rounded-full bg-st-green text-white"><Check className="size-7" strokeWidth={2.5} /></span>
          <h1 className="text-2xl">{t.saved}</h1>
          <p className="text-ink-2">{t.counts(present, absentees.length)}</p>
        </div>
        {refused ? (
          <Notice tone="red" title={t.refusedTitle}>
            {queue.failed[eventId] ? <span className="block">{queue.failed[eventId]}</span> : null}
            {t.refusedHint}
          </Notice>
        ) : waiting || !online ? (
          <Notice tone="yellow" title={t.pending(1)}>
            {t.savedOffline}
            {online ? <Button variant="secondary" className="mt-2" size="sm" icon={<RefreshCw className="size-4" aria-hidden />} onClick={() => userId && flushAttendanceQueue(userId, { force: true })}>{t.retry}</Button> : null}
          </Notice>
        ) : lastSent ? (
          <Notice tone="green" title={t.synced(new Intl.DateTimeFormat("ro-RO", { hour: "2-digit", minute: "2-digit" }).format(new Date(lastSent)))} />
        ) : null}
        <Card className="overflow-hidden">
          <h2 className="px-4 pb-2 pt-4 text-lg">{t.absentees}</h2>
          {absentees.length === 0 ? <p className="px-4 pb-4 text-ink-3">{t.noAbsentees}</p> : (
            <ul className="divide-y divide-line border-t border-line">
              {absentees.map((p) => (
                <li key={p.id} className="flex justify-between gap-3 px-4 py-3">
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-ink-2">{marks[p.id].reason ? ABSENCE_REASON_LABELS[marks[p.id].reason!] : "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="flex flex-col gap-2">
          <a href="/azi" className="inline-flex h-11 items-center justify-center rounded-full bg-brand px-4 font-medium text-brand-ink hover:brightness-110">{t.backToToday}</a>
          <Button variant="ghost" onClick={() => setScreen("list")}>{t.edit}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl pb-24">
      {back}
      <h1 className="text-2xl">{title}</h1>
      <p className="text-ink-3">{subtitle}</p>
      {!online ? (
        <div role="status" className="mt-3 flex items-center gap-2 rounded-[var(--radius-control)] bg-st-yellow-soft px-3 py-2 text-sm">
          <CloudOff className="size-5 shrink-0" aria-hidden /> {t.offline}
        </div>
      ) : null}
      <p className="mt-4 text-xl font-bold">{t.counts(present, absentees.length)}</p>
      <p className="mb-3 text-sm text-ink-3">{t.hint}</p>

      <ul aria-label={title} className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line/70 bg-surface shadow-[var(--shadow-card)]">
        {players.map((p) => {
          const m = marks[p.id];
          const out = isOut(m);
          return (
            <li key={p.id}>
              <button type="button"
                aria-label={out ? t.markPresent(p.name) : t.markAbsent(p.name)}
                onClick={() => (out || m.status === "late" ? mark(p.id, { status: "present", reason: null }) : setSheetFor(p))}
                className={cn("flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left", out ? "bg-st-red-soft" : "bg-surface hover:bg-canvas")}>
                <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken text-sm font-bold text-ink-2">{p.number ?? "–"}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.name}</span>
                  {out || m.status === "late" ? (
                    <span className="block text-sm text-ink-2">
                      {m.status === "late" ? t.lateAt : m.reason ? ABSENCE_REASON_LABELS[m.reason] : ""}{m.auto ? t.fromMedical : ""}
                    </span>
                  ) : null}
                </span>
                {out ? (
                  <span className="inline-flex h-8 items-center gap-1 rounded-md bg-st-red px-2.5 text-sm font-bold text-white"><X className="size-4" strokeWidth={2.5} aria-hidden />{ATTENDANCE_LABELS.absent}</span>
                ) : m.status === "late" ? (
                  <span className="inline-flex h-8 items-center gap-1 rounded-md bg-st-yellow px-2.5 text-sm font-bold text-ink"><Check className="size-4" strokeWidth={2.5} aria-hidden />{t.lateAt}</span>
                ) : (
                  <span className="inline-flex h-8 items-center gap-1 rounded-md bg-st-green px-2.5 text-sm font-bold text-white"><Check className="size-4" strokeWidth={2.5} aria-hidden />{ATTENDANCE_LABELS.present}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-line bg-surface px-4 py-3 md:static md:mt-4 md:border-0 md:bg-transparent md:p-0">
        <Button variant="primary" className="w-full md:w-auto" pending={busy} onClick={save}>{t.save(present, players.length)}</Button>
      </div>

      {sheetFor ? (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-labelledby="why-title">
          <button type="button" aria-label={messages.common.actions.close} tabIndex={-1} className="absolute inset-0 bg-ink/50" onClick={() => setSheetFor(null)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-[var(--radius-sheet)] bg-surface p-4 pb-safe md:inset-x-auto md:left-1/2 md:top-1/2 md:bottom-auto md:w-[28rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[var(--radius-sheet)]">
            <h2 id="why-title" className="mb-3 text-lg">{t.why(sheetFor.name)}</h2>
            <div className="grid gap-2">
              <button type="button" autoFocus onClick={() => { mark(sheetFor.id, { status: "late", reason: null }); setSheetFor(null); }}
                className="flex h-14 items-center rounded-[var(--radius-control)] bg-sunken px-4 text-left font-medium transition-colors hover:bg-line">{t.late}</button>
              {ABSENCE_REASONS.map((r) => (
                <button key={r} type="button" onClick={() => { mark(sheetFor.id, { status: r === "injured" ? "injured" : "absent", reason: r }); setSheetFor(null); }}
                  className="flex h-14 items-center rounded-[var(--radius-control)] bg-sunken px-4 text-left font-medium transition-colors hover:bg-line">{ABSENCE_REASON_LABELS[r]}</button>
              ))}
              <Button variant="ghost" onClick={() => setSheetFor(null)}>{messages.common.actions.cancel}</Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
