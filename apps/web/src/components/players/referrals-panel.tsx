"use client";
import Link from "next/link";
import { useState } from "react";
import { Send } from "lucide-react";
import { formatDateShort, formatDateTime } from "@club/shared";
import { createReferral, setReferralActive } from "@/app/(app)/lot/jucatori/[id]/(fisa)/medical/actions";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Notice } from "@/components/ui/card";
import { Field, FormError, Select, Textarea } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { Badge } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { dayOf, injuryZoneText } from "./domain";
import type { InjuryRow, PartnerOption, ReferralWithNotes } from "./queries";

/** Trimiterile către partenerul medical extern și notele lui (doar preparatorul). */
export function ReferralsPanel({ playerId, referrals, partners, injuries, names, timezone, canManage = true }: {
  canManage?: boolean; playerId: string; referrals: ReferralWithNotes[]; partners: PartnerOption[]; injuries: InjuryRow[];
  names: Record<string, string>; timezone: string;
}) {
  const t = useT().players.medical;
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const toggle = useAction(setReferralActive, { onSuccess: (d) => toast(d.active ? t.referralReopenedToast : t.referralClosedToast) });
  const injuryById = new Map(injuries.map((i) => [i.id, i]));
  const sorted = [...referrals].sort((a, b) => Number(b.is_active) - Number(a.is_active) || b.created_at.localeCompare(a.created_at));

  return (
    <Card>
      <CardHeader
        title={t.referralsTitle}
        description={t.referralsDescription}
        action={canManage && partners.length ? (
          <Button variant="secondary" icon={<Send className="size-5" aria-hidden />} onClick={() => setOpen(true)}>
            <span className="max-sm:sr-only">{t.referralAdd}</span>
          </Button>
        ) : undefined}
      />
      <CardBody className="space-y-3">
        {canManage && !partners.length ? (
          <Notice tone="blue" title={t.noPartnersTitle}>
            {t.noPartnersBody}{" "}
            <Link href="/administrare/conturi" className="font-semibold underline underline-offset-4">{t.noPartnersLink}</Link>
          </Notice>
        ) : null}
        {!sorted.length ? (
          partners.length || !canManage ? <p className="text-ink-3">{t.referralsEmpty}</p> : null
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {sorted.map((r) => {
              const injury = r.injury_id ? injuryById.get(r.injury_id) : null;
              return (
                <li key={r.id} className="py-3">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-bold">
                        {names[r.partner_user_id] ?? t.partnerUnknown}
                        <Badge tone={r.is_active ? "blue" : "gray"}>{r.is_active ? t.referralActive : t.referralClosed}</Badge>
                      </p>
                      <p className="text-sm text-ink-3">
                        {injury ? t.referralScopeInjury(formatDateShort(injury.occurred_on), injuryZoneText(injury, true)) : t.referralScopeAll}
                        {" · "}{t.referralSentOn(formatDateShort(dayOf(r.created_at, timezone)))}
                        {r.closed_at ? <> · {t.referralClosedOn(formatDateShort(dayOf(r.closed_at, timezone)))}</> : null}
                      </p>
                      {r.reason ? <p className="mt-1">{r.reason}</p> : null}
                    </div>
                    {canManage ? (
                      <Button
                        variant="secondary" size="sm" className="h-10" disabled={toggle.pending}
                        onClick={() => toggle.run({ id: r.id, active: !r.is_active })}
                      >
                        {r.is_active ? t.referralClose : t.referralReopen}
                      </Button>
                    ) : null}
                  </div>
                  <div className="mt-2 rounded-[var(--radius-control)] bg-canvas px-3 py-2">
                    <p className="text-sm font-semibold text-ink-3">{t.partnerNotes}</p>
                    {r.partner_notes.length ? (
                      <ul className="mt-1 space-y-2">
                        {r.partner_notes.map((n) => (
                          <li key={n.id}>
                            <p className="whitespace-pre-line">{n.note}</p>
                            <p className="text-sm text-ink-3">{formatDateTime(n.created_at, timezone)}</p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-ink-3">{t.partnerNotesEmpty}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <FormError>{toggle.error}</FormError>
      </CardBody>
      {open ? <ReferralDialog playerId={playerId} partners={partners} injuries={injuries} onClose={() => setOpen(false)} /> : null}
    </Card>
  );
}

function ReferralDialog({ playerId, partners, injuries, onClose }: {
  playerId: string; partners: PartnerOption[]; injuries: InjuryRow[]; onClose: () => void;
}) {
  const t = useT().players.medical;
  const c = useT().common;
  const [partnerId, setPartnerId] = useState(partners.length === 1 ? partners[0].id : "");
  const [injuryId, setInjuryId] = useState("");
  const [reason, setReason] = useState("");
  const save = useAction(createReferral, { onSuccess: onClose });
  return (
    <Dialog
      open
      onClose={onClose}
      title={t.referralDialog}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{c.actions.cancel}</Button>
          <Button pending={save.pending} disabled={!partnerId} onClick={() => save.run({ playerId, partnerId, injuryId, reason })}>{t.referralSave}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t.referralPartner}>
          <Select value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
            {partners.length > 1 ? <option value="">—</option> : null}
            {partners.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </Select>
        </Field>
        <Field label={t.referralInjury} hint={injuryId ? t.referralInjuryHint : t.referralAllHint}>
          <Select value={injuryId} onChange={(e) => setInjuryId(e.target.value)}>
            <option value="">{t.referralAllInjuries}</option>
            {injuries.map((i) => (
              <option key={i.id} value={i.id}>{t.recurrenceOption(formatDateShort(i.occurred_on), injuryZoneText(i, true))}</option>
            ))}
          </Select>
        </Field>
        <Field label={t.referralReason} optional>
          <Textarea rows={2} maxLength={500} value={reason} placeholder={t.referralReasonPlaceholder} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <FormError>{save.error}</FormError>
      </div>
    </Dialog>
  );
}
