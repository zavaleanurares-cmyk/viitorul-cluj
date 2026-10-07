"use client";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  AVAILABILITY_LABELS, describeZone, diffDays, formatDate, formatDateShort, relativeDay,
  type ClubStatus, type Group,
} from "@club/shared";
import {
  addAnthropometric, deleteAnthropometric, recordGuardianConsent, saveContacts, setMedicalVisa, setPlayerActive, withdrawConsent,
} from "@/app/(app)/jucatori/actions";
import { TrendChart } from "@/components/charts";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Notice } from "@/components/ui/card";
import { Field, FormError, Input, Select } from "@/components/ui/form";
import { DataList, TableWrap } from "@/components/ui/misc";
import { Dialog } from "@/components/ui/overlay";
import { Badge, StatusChip } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { ConfirmDialog } from "./confirm-dialog";
import { addMonths, availabilityOf, visaState } from "./domain";
import { PlayerFormDialog, type KnownPlayer, type PlayerFormValues } from "./player-form-dialog";
import type { Anthropometric, PlayerContact } from "./queries";
import { StatusDialog, type StatusDialogPlayer } from "./status-dialog";

// ---------------------------------------------------------------------------
// Stare curentă
// ---------------------------------------------------------------------------
export function StatusCard({ player, statuses, canManage, today, since }: {
  player: StatusDialogPlayer; statuses: ClubStatus[]; canManage: boolean; today: string; since: string | null;
}) {
  const t = useT().players.summary;
  const [open, setOpen] = useState(false);
  const status = statuses.find((s) => s.id === player.status_id) ?? null;
  const zone = describeZone({
    zone: player.status_zone, side: player.status_side, detail: player.status_zone_detail, uncertain: player.status_zone_uncertain,
  });
  const overdue = !!player.status_return_on && diffDays(today, player.status_return_on) < 0;
  const items = [
    zone ? { label: t.zone, value: zone } : null,
    player.status_return_on
      ? { label: t.returnOn, value: `${formatDate(player.status_return_on)} (${overdue ? t.returnOverdue : relativeDay(player.status_return_on, today)})` }
      : null,
    player.training_restrictions ? { label: t.restrictions, value: player.training_restrictions } : null,
    player.status_note ? { label: t.note, value: player.status_note } : null,
  ].filter((x) => x !== null);

  return (
    <Card>
      <CardHeader
        title={t.statusTitle}
        action={canManage ? <Button onClick={() => setOpen(true)}>{t.changeStatus}</Button> : undefined}
      />
      <CardBody className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <StatusChip status={status} size="lg" full />
          <span className="text-ink-3">
            {status ? AVAILABILITY_LABELS[availabilityOf(status)] : null}
            {since ? `${status ? ", " : ""}${t.since(since)}` : null}
          </span>
        </div>
        {items.length ? <DataList items={items} /> : null}
        {player.needs_review ? (
          <Notice tone="yellow" title={t.reviewTitle}>
            {player.review_note ? <p>{player.review_note}</p> : null}
            {canManage ? <p className="text-sm">{t.reviewHint}</p> : null}
          </Notice>
        ) : null}
      </CardBody>
      {canManage ? <StatusDialog player={open ? player : null} statuses={statuses} onClose={() => setOpen(false)} /> : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Profil: modificare, dezactivare
// ---------------------------------------------------------------------------
export function EditPlayerButton({ playerId, initial, groups, known, today }: {
  playerId: string; initial: PlayerFormValues; groups: Group[]; known: KnownPlayer[]; today: string;
}) {
  const t = useT().players.summary;
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" icon={<Pencil className="size-4" aria-hidden />} onClick={() => setOpen(true)}>{t.edit}</Button>
      <PlayerFormDialog open={open} onClose={() => setOpen(false)} groups={groups} known={known} playerId={playerId} initial={initial} today={today} />
    </>
  );
}

export function ActiveToggle({ playerId, active, name }: { playerId: string; active: boolean; name: string }) {
  const t = useT().players.summary;
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const save = useAction(setPlayerActive, {
    onSuccess: (d) => { setConfirm(false); toast(d.active ? t.reactivated : t.deactivated); },
  });
  if (!active) {
    return (
      <div className="space-y-2">
        <Button variant="secondary" pending={save.pending} onClick={() => save.run({ playerId, active: true })}>{t.reactivate}</Button>
        <FormError>{save.error}</FormError>
      </div>
    );
  }
  return (
    <>
      <Button variant="secondary" onClick={() => setConfirm(true)}>{t.deactivate}</Button>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t.deactivateTitle}
        confirmLabel={t.deactivate}
        pending={save.pending}
        error={save.error}
        onConfirm={() => save.run({ playerId, active: false })}
      >
        <p className="font-semibold text-ink">{name}</p>
        <p>{t.deactivateBody}</p>
      </ConfirmDialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Viza medicală
// ---------------------------------------------------------------------------
export function VisaCard({ playerId, expiresOn, canManage, today, warnDays, validityMonths }: {
  playerId: string; expiresOn: string | null; canManage: boolean; today: string; warnDays: number; validityMonths: number;
}) {
  const t = useT().players.summary;
  const [date, setDate] = useState(expiresOn ?? "");
  const save = useAction(setMedicalVisa, { onSuccess: (d) => setDate(d.expiresOn ?? "") });
  const state = visaState(expiresOn, today, warnDays);
  const left = expiresOn ? diffDays(today, expiresOn) : 0;
  const text =
    state === "missing" ? t.visaMissing
    : state === "expired" ? t.visaExpired(-left)
    : left === 0 ? t.visaExpiresToday
    : state === "expiring" ? t.visaExpiring(left)
    : t.visaValid;
  const tone = state === "expired" ? "red" : state === "expiring" ? "orange" : state === "valid" ? "green" : "gray";

  return (
    <Card>
      <CardHeader title={t.visaTitle} />
      <CardBody className="space-y-3">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {expiresOn ? <span className="text-lg font-bold">{formatDate(expiresOn)}</span> : null}
          <Badge tone={tone}>{text}</Badge>
        </p>
        {canManage ? (
          <form
            className="space-y-2"
            onSubmit={(e) => { e.preventDefault(); save.run({ playerId, expiresOn: date }); }}
          >
            <Field label={t.visaExpires}>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="secondary" pending={save.pending} disabled={date === (expiresOn ?? "")}>{t.visaSave}</Button>
              <Button
                variant="secondary" disabled={save.pending}
                title={t.visaRenewHint(validityMonths)}
                onClick={() => save.run({ playerId, expiresOn: addMonths(today, validityMonths) })}
              >
                {t.visaRenewToday}
              </Button>
            </div>
            <p className="text-sm text-ink-3">{t.visaRenewHint(validityMonths)}</p>
            <FormError>{save.error}</FormError>
          </form>
        ) : null}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Date de contact (doar preparatorul)
// ---------------------------------------------------------------------------
export function ContactsCard({ playerId, contacts, minor }: { playerId: string; contacts: PlayerContact | null; minor: boolean }) {
  const t = useT().players.summary;
  const c = useT().common;
  const [open, setOpen] = useState(false);
  const empty = { phone: "", email: "", guardianName: "", guardianPhone: "", guardianEmail: "" };
  const current = contacts
    ? {
        phone: contacts.phone ?? "", email: contacts.email ?? "", guardianName: contacts.guardian_name ?? "",
        guardianPhone: contacts.guardian_phone ?? "", guardianEmail: contacts.guardian_email ?? "",
      }
    : empty;
  const [v, setV] = useState(current);
  const save = useAction(saveContacts, { onSuccess: () => setOpen(false) });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  const hasAny = Object.values(current).some(Boolean);
  const hasGuardian = !!(current.guardianName || current.guardianPhone || current.guardianEmail);
  const link = (href: string, text: string) => <a href={href} className="underline underline-offset-4">{text}</a>;

  return (
    <Card>
      <CardHeader
        title={t.contactsTitle}
        description={t.contactsDescription}
        action={
          <IconButton label={t.contactsEdit} onClick={() => { setV(current); save.clearError(); setOpen(true); }}>
            <Pencil className="size-5" aria-hidden />
          </IconButton>
        }
      />
      <CardBody>
        {hasAny ? (
          <DataList
            className="break-words"
            items={[
              { label: t.phone, value: current.phone ? link(`tel:${current.phone.replace(/\s+/g, "")}`, current.phone) : "—" },
              { label: t.email, value: current.email ? link(`mailto:${current.email}`, current.email) : "—" },
              ...(minor || hasGuardian
                ? [
                    { label: t.guardianName, value: current.guardianName || "—" },
                    { label: t.guardianPhone, value: current.guardianPhone ? link(`tel:${current.guardianPhone.replace(/\s+/g, "")}`, current.guardianPhone) : "—" },
                    { label: t.guardianEmail, value: current.guardianEmail ? link(`mailto:${current.guardianEmail}`, current.guardianEmail) : "—" },
                  ]
                : []),
            ]}
          />
        ) : (
          <p className="text-ink-3">{t.contactsEmpty}</p>
        )}
      </CardBody>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t.contactsEdit}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>{c.actions.cancel}</Button>
            <Button pending={save.pending} onClick={() => save.run({ playerId, ...v })}>{t.contactsSave}</Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.run({ playerId, ...v }); }}>
          <Field label={t.phone} optional><Input type="tel" inputMode="tel" autoComplete="off" maxLength={40} value={v.phone} onChange={set("phone")} /></Field>
          <Field label={t.email} optional><Input type="email" autoComplete="off" maxLength={200} value={v.email} onChange={set("email")} /></Field>
          <Field label={t.guardianName} optional><Input autoComplete="off" maxLength={120} value={v.guardianName} onChange={set("guardianName")} /></Field>
          <Field label={t.guardianPhone} optional><Input type="tel" inputMode="tel" autoComplete="off" maxLength={40} value={v.guardianPhone} onChange={set("guardianPhone")} /></Field>
          <Field label={t.guardianEmail} optional><Input type="email" autoComplete="off" maxLength={200} value={v.guardianEmail} onChange={set("guardianEmail")} /></Field>
          <FormError>{save.error}</FormError>
          <button type="submit" hidden />
        </form>
      </Dialog>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Antropometrie
// ---------------------------------------------------------------------------
const num = (v: number | null, digits = 1) => (v === null ? "—" : v.toFixed(digits).replace(".", ","));

export function AnthroCard({ playerId, rows, canManage, today }: {
  playerId: string; rows: Anthropometric[]; canManage: boolean; today: string;
}) {
  const t = useT().players.summary;
  const c = useT().common;
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Anthropometric | null>(null);
  const blank = { measuredOn: today, heightCm: "", weightKg: "", bodyFatPct: "", muscleMassKg: "", notes: "" };
  const [v, setV] = useState(blank);
  const add = useAction(addAnthropometric, { onSuccess: () => setOpen(false) });
  const remove = useAction(deleteAnthropometric, { onSuccess: () => setDeleting(null) });
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: e.target.value }));
  const toNum = (s: string) => (s.trim() ? Number(s.replace(",", ".")) : null);
  const submit = () =>
    add.run({
      playerId, measuredOn: v.measuredOn, heightCm: toNum(v.heightCm), weightKg: toNum(v.weightKg),
      bodyFatPct: toNum(v.bodyFatPct), muscleMassKg: toNum(v.muscleMassKg), notes: v.notes,
    });

  const latest = rows[0];
  const chart = [...rows].reverse().filter((r) => r.weight_kg !== null)
    .map((r) => ({ x: formatDateShort(r.measured_on, false), weight: Number(r.weight_kg) }));
  const decimal = { inputMode: "decimal" as const, autoComplete: "off" };

  return (
    <Card>
      <CardHeader
        title={t.anthroTitle}
        description={latest ? `${t.latest}: ${formatDate(latest.measured_on)}` : undefined}
        action={canManage ? (
          <Button variant="secondary" icon={<Plus className="size-5" aria-hidden />} onClick={() => { setV({ ...blank, heightCm: latest?.height_cm != null ? String(latest.height_cm) : "" }); add.clearError(); setOpen(true); }}>
            <span className="max-sm:sr-only">{t.anthroAdd}</span>
          </Button>
        ) : undefined}
      />
      <CardBody className="space-y-4">
        {!rows.length ? (
          <p className="text-ink-3">{t.anthroEmpty}</p>
        ) : (
          <>
            {chart.length > 1 ? (
              <div>
                <h3 className="mb-1 text-sm font-semibold text-ink-3">{t.weightCaption}</h3>
                <TrendChart data={chart} series={[{ key: "weight", label: t.weightChart }]} caption={t.weightCaption} height={180} />
              </div>
            ) : null}
            <TableWrap className="max-md:[&_td]:!px-2 max-md:[&_th]:!px-2">
              <thead>
                <tr>
                  <th scope="col" className="align-top">{t.anthroDate}</th>
                  {([[t.heightShort, "cm"], [t.weightShort, "kg"], [t.bodyFatShort, "%"], [t.muscleMassShort, "kg"]] as const).map(([name, unit]) => (
                    <th key={name} scope="col" className="text-right">
                      {name}<span className="block text-xs font-normal">{unit}</span>
                    </th>
                  ))}
                  {canManage ? <th scope="col" aria-label={c.actions.delete} /> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap font-semibold">
                      {formatDateShort(r.measured_on)}
                      {r.notes ? <span className="block max-w-48 whitespace-normal text-sm font-normal text-ink-3">{r.notes}</span> : null}
                    </td>
                    <td className="text-right">{num(r.height_cm, 0)}</td>
                    <td className="text-right font-semibold">{num(r.weight_kg)}</td>
                    <td className="text-right">{num(r.body_fat_pct)}</td>
                    <td className="text-right">{num(r.muscle_mass_kg)}</td>
                    {canManage ? (
                      <td className="w-10 !px-0 !py-0 text-right">
                        <IconButton label={t.anthroDelete(formatDateShort(r.measured_on))} className="size-10 text-ink-3" onClick={() => setDeleting(r)}>
                          <Trash2 className="size-4" aria-hidden />
                        </IconButton>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </>
        )}
      </CardBody>
      {canManage ? (
        <>
          <Dialog
            open={open}
            onClose={() => setOpen(false)}
            title={t.anthroAdd}
            footer={
              <>
                <Button variant="secondary" onClick={() => setOpen(false)}>{c.actions.cancel}</Button>
                <Button pending={add.pending} onClick={submit}>{t.anthroSave}</Button>
              </>
            }
          >
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
              <Field label={t.anthroDate}><Input type="date" required max={today} value={v.measuredOn} onChange={set("measuredOn")} /></Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label={t.height} optional><Input {...decimal} value={v.heightCm} onChange={set("heightCm")} /></Field>
                <Field label={t.weight} optional><Input {...decimal} value={v.weightKg} onChange={set("weightKg")} /></Field>
                <Field label={t.bodyFat} optional><Input {...decimal} value={v.bodyFatPct} onChange={set("bodyFatPct")} /></Field>
                <Field label={t.muscleMass} optional><Input {...decimal} value={v.muscleMassKg} onChange={set("muscleMassKg")} /></Field>
              </div>
              <Field label={t.anthroNotes} optional><Input maxLength={500} value={v.notes} onChange={set("notes")} /></Field>
              <FormError>{add.error}</FormError>
              <button type="submit" hidden />
            </form>
          </Dialog>
          <ConfirmDialog
            open={!!deleting}
            onClose={() => setDeleting(null)}
            title={deleting ? t.anthroDelete(formatDateShort(deleting.measured_on)) : ""}
            confirmLabel={c.actions.delete}
            pending={remove.pending}
            error={remove.error}
            onConfirm={() => deleting && remove.run({ id: deleting.id })}
          >
            <p>{c.confirmDelete}</p>
          </ConfirmDialog>
        </>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Consimțământ (doar preparatorul)
// ---------------------------------------------------------------------------
export type ConsentItem = {
  id: string; kind: string; guardianName: string | null; guardianRelation: string | null;
  date: string; version: string; recordedBy: string | null; withdrawnOn: string | null;
};

export function ConsentCard({ playerId, consents, minor, guardianMissing, defaultGuardian, today }: {
  playerId: string; consents: ConsentItem[]; minor: boolean; guardianMissing: boolean; defaultGuardian: string; today: string;
}) {
  const t = useT().players.summary;
  const c = useT().common;
  const [open, setOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState<ConsentItem | null>(null);
  const relations = Object.values(t.consentRelations);
  const [v, setV] = useState({ guardianName: defaultGuardian, guardianRelation: relations[0] as string, signedOn: today });
  const record = useAction(recordGuardianConsent, { onSuccess: () => setOpen(false) });
  const withdraw = useAction(withdrawConsent, { onSuccess: () => setWithdrawing(null) });
  const submit = () => record.run({ playerId, ...v });

  return (
    <Card>
      <CardHeader
        title={t.consentTitle}
        action={minor ? (
          <Button variant="secondary" icon={<Plus className="size-5" aria-hidden />} onClick={() => { record.clearError(); setOpen(true); }}>
            <span className="max-sm:sr-only">{t.consentRecord}</span>
          </Button>
        ) : undefined}
      />
      <CardBody className="space-y-3">
        {guardianMissing ? <Notice tone="yellow">{t.consentMinorMissing}</Notice> : null}
        {!consents.length ? (
          <p className="text-ink-3">{t.consentEmpty}</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {consents.map((x) => (
              <li key={x.id} className="flex items-start gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {t.consentKinds[x.kind as keyof typeof t.consentKinds] ?? x.kind}
                    {x.withdrawnOn ? <Badge tone="gray" className="ml-2">{t.consentWithdrawn(x.withdrawnOn)}</Badge> : null}
                  </p>
                  <p className="text-sm text-ink-3">
                    {[
                      x.date,
                      x.guardianName ? t.consentBy(x.guardianName, x.guardianRelation) : null,
                      x.recordedBy ? t.consentRecordedBy(x.recordedBy) : null,
                      t.consentVersion(x.version),
                    ].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {x.kind === "guardian_paper" && !x.withdrawnOn ? (
                  <Button variant="ghost" size="sm" className="h-10 shrink-0" onClick={() => setWithdrawing(x)}>{t.consentWithdraw}</Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t.consentRecordTitle}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>{c.actions.cancel}</Button>
            <Button pending={record.pending} disabled={v.guardianName.trim().length < 2} onClick={submit}>{t.consentSave}</Button>
          </>
        }
      >
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <p className="text-ink-2">{t.consentRecordIntro}</p>
          <Field label={t.consentGuardianName}>
            <Input required autoComplete="off" maxLength={120} value={v.guardianName} onChange={(e) => setV((s) => ({ ...s, guardianName: e.target.value }))} />
          </Field>
          <Field label={t.consentRelation}>
            <Select value={v.guardianRelation} onChange={(e) => setV((s) => ({ ...s, guardianRelation: e.target.value }))}>
              {relations.map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </Field>
          <Field label={t.consentSignedOn}>
            <Input type="date" required max={today} value={v.signedOn} onChange={(e) => setV((s) => ({ ...s, signedOn: e.target.value }))} />
          </Field>
          <FormError>{record.error}</FormError>
          <button type="submit" hidden />
        </form>
      </Dialog>
      <ConfirmDialog
        open={!!withdrawing}
        onClose={() => setWithdrawing(null)}
        title={t.consentWithdrawTitle}
        confirmLabel={t.consentWithdraw}
        pending={withdraw.pending}
        error={withdraw.error}
        onConfirm={() => withdrawing && withdraw.run({ id: withdrawing.id })}
      >
        <p>{t.consentWithdrawBody}</p>
      </ConfirmDialog>
    </Card>
  );
}
