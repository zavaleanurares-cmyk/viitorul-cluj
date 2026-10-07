"use client";
import { useState } from "react";
import { createDataRequest } from "@/app/(app)/profil/actions";
import { Button } from "@/components/ui/button";
import { Field, FormError, Textarea } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";

type Kind = "rectify" | "delete" | "withdraw_consent";

/** Cele trei cereri GDPR. Fiecare se confirmă într-o fereastră, cu un mesaj opțional pentru club. */
export function GdprRequests({ openKinds }: { openKinds: string[] }) {
  const t = useT().player.gdpr;
  const [kind, setKind] = useState<Kind | null>(null);
  const [message, setMessage] = useState("");
  const send = useAction(createDataRequest, {
    onSuccess: () => {
      setKind(null);
      setMessage("");
    },
  });
  const close = () => {
    setKind(null);
    send.clearError();
  };
  const kinds: Kind[] = ["rectify", "delete", "withdraw_consent"];

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-3">
        {kinds.map((k) => (
          <Button key={k} variant="secondary" className="w-full whitespace-normal" disabled={openKinds.includes(k)} onClick={() => setKind(k)}>
            {t.kinds[k].button}
          </Button>
        ))}
      </div>
      {openKinds.length ? <p className="mt-2 text-sm text-ink-3">{t.alreadyOpen}</p> : null}
      {kind ? (
        <Dialog
          open
          onClose={close}
          title={t.kinds[kind].title}
          footer={
            <>
              <Button variant="secondary" onClick={close}>{t.cancel}</Button>
              <Button variant={kind === "rectify" ? "primary" : "danger"} pending={send.pending} onClick={() => send.run({ kind, message })}>
                {t.kinds[kind].confirm}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-ink-2">{t.kinds[kind].explain}</p>
            <Field label={kind === "rectify" ? t.messageRectify : t.message} optional={kind !== "rectify"}>
              <Textarea rows={4} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />
            </Field>
            <FormError>{send.error}</FormError>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
