"use client";
import { useRef, useState } from "react";
import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { sendInvites, type InviteScope } from "@/app/(app)/administrare/conturi/actions";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Notice } from "@/components/ui/card";
import { FormError, Segmented } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { useT } from "@/messages";

type Run = { total: number; sent: number; failed: Array<{ name: string; email: string }>; done: boolean };

/**
 * Invitațiile în masă: browserul trimite loturi mici până se termină lista, cu progres vizibil.
 * `pending` vine de la server (conturi fără parolă și fără link valabil), pe categorii.
 */
export function BulkInvites({ pending, blocked }: {
  pending: Record<InviteScope, number>;
  /** de ce nu pot pleca e-mailuri: clubul demo sau Resend neconfigurat */
  blocked: "demo" | "config" | null;
}) {
  const t = useT().admin.invites;
  const toast = useToast();
  const router = useRouter();
  const [scope, setScope] = useState<InviteScope>(pending.staff ? "staff" : "all");
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stop = useRef(false);
  const busy = !!run && !run.done;
  const count = pending[scope];

  if (!pending.all && !run) return null;

  const start = async () => {
    stop.current = false;
    setError(null);
    let state: Run = { total: count, sent: 0, failed: [], done: false };
    setRun(state);
    for (;;) {
      let res;
      try {
        res = await sendInvites({ scope });
      } catch {
        res = { ok: false as const, error: "Nu s-a putut contacta serverul. Verifică conexiunea." };
      }
      if (!res.ok) {
        setError(res.error);
        break;
      }
      state = { ...state, sent: state.sent + res.data.sent, failed: [...state.failed, ...res.data.failed] };
      setRun(state);
      if (!res.data.remaining || stop.current) break;
    }
    state = { ...state, done: true };
    setRun(state);
    if (state.sent) toast(t.done(state.sent));
    router.refresh();
  };

  const processed = run ? run.sent + run.failed.length : 0;

  return (
    <Card className="mb-6">
      <CardHeader title={t.title} description={t.description} />
      <CardBody className="space-y-4">
        {blocked ? <Notice tone="yellow">{blocked === "demo" ? t.demo : t.notConfigured}</Notice> : null}
        <Segmented
          label={t.scopeLabel}
          value={scope}
          onChange={(v) => !busy && setScope(v)}
          options={(["staff", "guardian", "player", "all"] as const).map((s) => ({ value: s, label: `${t.scopes[s]} · ${pending[s]}` }))}
        />
        <p className="text-sm text-ink-2" aria-live="polite">{t.pending(count)}</p>

        {run ? (
          <div className="space-y-1">
            <progress className="h-2 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-brand [&::-webkit-progress-bar]:bg-sunken [&::-webkit-progress-value]:bg-brand"
              value={processed} max={Math.max(run.total, processed, 1)} aria-label={t.progressLabel} />
            <p className="text-sm text-ink-3">{t.progress(processed, Math.max(run.total, processed))}</p>
          </div>
        ) : null}

        <FormError>{error}</FormError>
        {run?.failed.length ? (
          <Notice tone="red" title={t.failedTitle(run.failed.length)}>
            <p className="mb-1">{t.failedHint}</p>
            <ul className="list-disc pl-5">
              {run.failed.map((f) => <li key={f.email}>{f.name} ({f.email})</li>)}
            </ul>
          </Notice>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button icon={<Send className="size-5" aria-hidden />} pending={busy} disabled={!!blocked || !count || busy} onClick={start}>
            {t.send(count)}
          </Button>
          {busy ? <Button variant="secondary" onClick={() => { stop.current = true; }}>{t.stop}</Button> : null}
        </div>
      </CardBody>
    </Card>
  );
}
