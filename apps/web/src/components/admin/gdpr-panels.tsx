"use client";
import Link from "next/link";
import { useState } from "react";
import { Download, EyeOff, Trash2 } from "lucide-react";
import { anonymizePlayer, erasePlayer, resolveRequest, withdrawPlayerConsents } from "@/app/(app)/administrare/gdpr/actions";
import { Button, buttonClass } from "@/components/ui/button";
import { Field, FormError, Segmented, Textarea } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { Badge } from "@/components/ui/status";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { Confirm } from "./confirm";

export type GdprPlayer = { id: string; displayName: string; anonymized: boolean; hasAccount: boolean };

/** „Descarcă datele”, „Anonimizează”, „Șterge definitiv” pentru un jucător. Ultimele două cer tastarea numelui. */
export function PlayerDataActions({ player, withExport = true, size = "sm" }: { player: GdprPlayer; withExport?: boolean; size?: "sm" | "md" }) {
  const t = useT().admin.gdpr;
  const [confirm, setConfirm] = useState<"anonymize" | "erase" | null>(null);
  const anonymize = useAction(anonymizePlayer, { onSuccess: () => setConfirm(null) });
  const erase = useAction(erasePlayer, { onSuccess: () => setConfirm(null) });
  const icon = size === "sm" ? "size-4" : "size-5";
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {withExport ? (
          <a href={`/administrare/gdpr/export/${player.id}`} download className={buttonClass("secondary", size)}>
            <Download className={icon} aria-hidden />{t.download}
          </a>
        ) : null}
        {!player.anonymized ? (
          <Button variant="secondary" size={size} icon={<EyeOff className={icon} aria-hidden />} onClick={() => setConfirm("anonymize")}>{t.anonymize}</Button>
        ) : null}
        <Button variant="secondary" size={size} className="text-st-red" icon={<Trash2 className={icon} aria-hidden />} onClick={() => setConfirm("erase")}>{t.erase}</Button>
      </div>
      <Confirm
        open={confirm === "anonymize"} onClose={() => setConfirm(null)} title={t.anonymizeTitle(player.displayName)} confirmLabel={t.anonymizeConfirm}
        requireText={player.displayName} pending={anonymize.pending} error={anonymize.error}
        onConfirm={(typed) => anonymize.run({ playerId: player.id, confirmName: typed })}
      >
        <p>{t.anonymizeExplain}</p>
        {player.hasAccount ? <p>{t.anonymizeAccount}</p> : null}
        <p className="font-semibold">{t.irreversible}</p>
      </Confirm>
      <Confirm
        open={confirm === "erase"} onClose={() => setConfirm(null)} title={t.eraseTitle(player.displayName)} confirmLabel={t.eraseConfirm}
        requireText={player.displayName} pending={erase.pending} error={erase.error}
        onConfirm={(typed) => erase.run({ playerId: player.id, confirmName: typed })}
      >
        <p>{t.eraseExplain}</p>
        {player.hasAccount ? <p>{t.eraseAccount}</p> : null}
        <p className="font-semibold">{t.irreversible}</p>
      </Confirm>
    </>
  );
}

export type RequestItem = {
  id: string;
  kind: "export" | "delete" | "rectify" | "withdraw_consent";
  status: "open" | "done" | "rejected";
  who: string;
  whoRole: string | null;
  player: (GdprPlayer & { activeConsents: number }) | null;
  message: string | null;
  createdAt: string;
  handledBy: string | null;
  handledAt: string | null;
  response: string | null;
};

/** O cerere a unui utilizator: ce a cerut, acțiunile potrivite și închiderea cu răspuns scris. */
export function RequestCard({ request }: { request: RequestItem }) {
  const t = useT().admin.gdpr;
  const c = useT().common;
  const [resolving, setResolving] = useState(false);
  const [status, setStatus] = useState<"done" | "rejected">("done");
  const [response, setResponse] = useState("");
  const resolve = useAction(resolveRequest, { onSuccess: () => setResolving(false) });
  const withdraw = useAction(withdrawPlayerConsents);
  const open = request.status === "open";
  const p = request.player;

  return (
    <li className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-bold">
            {t.kinds[request.kind]}
            {!open ? <Badge tone={request.status === "done" ? "green" : "gray"}>{t.statuses[request.status]}</Badge> : null}
          </p>
          <p className="text-sm text-ink-3">
            {request.who}{request.whoRole ? ` (${request.whoRole})` : ""} · {request.createdAt}
          </p>
          {p ? (
            <p className="text-sm">
              {t.aboutPlayer}{" "}
              <Link href={`/jucatori/${p.id}`} className="font-semibold underline underline-offset-4">{p.displayName}</Link>
            </p>
          ) : null}
        </div>
        {open ? <Button size="sm" onClick={() => setResolving(true)}>{t.resolve}</Button> : null}
      </div>
      {request.message ? <blockquote className="border-l-4 border-line-strong pl-3 text-ink-2">{request.message}</blockquote> : <p className="text-sm text-ink-3">{t.noMessage}</p>}

      {open ? (
        <div className="space-y-2 rounded-[var(--radius-control)] bg-canvas p-3">
          <p className="text-sm text-ink-2">{t.kindHelp[request.kind]}</p>
          {p ? (
            <div className="flex flex-wrap gap-2">
              {request.kind === "rectify" ? (
                <Link href={`/jucatori/${p.id}`} className={buttonClass("secondary", "sm")}>{t.openFile}</Link>
              ) : null}
              {request.kind === "withdraw_consent" ? (
                <Button variant="secondary" size="sm" pending={withdraw.pending} disabled={p.activeConsents === 0} onClick={() => withdraw.run({ playerId: p.id })}>
                  {p.activeConsents ? t.withdrawConsent : t.consentAlreadyWithdrawn}
                </Button>
              ) : null}
              <PlayerDataActions player={p} withExport />
            </div>
          ) : null}
          <FormError>{withdraw.error}</FormError>
        </div>
      ) : (
        <div className="rounded-[var(--radius-control)] bg-canvas p-3 text-sm">
          <p className="text-ink-3">{t.handled(request.handledBy ?? "—", request.handledAt ?? "—")}</p>
          {request.response ? <p className="mt-1">{request.response}</p> : null}
        </div>
      )}

      <Dialog
        open={resolving} onClose={() => setResolving(false)} title={t.resolveTitle}
        footer={
          <>
            <Button variant="secondary" onClick={() => setResolving(false)}>{c.actions.cancel}</Button>
            <Button pending={resolve.pending} onClick={() => resolve.run({ id: request.id, status, response })}>{t.resolveSave}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Segmented label={t.resolveStatus} value={status} onChange={setStatus} options={[{ value: "done", label: t.statuses.done }, { value: "rejected", label: t.statuses.rejected }]} />
          <Field label={t.response} hint={t.responseHint}>
            <Textarea rows={4} maxLength={2000} value={response} onChange={(e) => setResponse(e.target.value)} />
          </Field>
          <FormError>{resolve.error}</FormError>
        </div>
      </Dialog>
    </li>
  );
}
