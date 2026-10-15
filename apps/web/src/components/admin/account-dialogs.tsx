"use client";
import { useState } from "react";
import { KeyRound, Link2Off, Send, Trash2, UserCheck, UserX } from "lucide-react";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type AppRole, type Group } from "@club/shared";
import {
  createPlayerAccount, createStaffAccount, deleteAccount, linkPlayer, sendAccessLink, setAccountActive, unlinkPlayer, updateAccount,
} from "@/app/(app)/administrare/conturi/actions";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Checkbox, Field, FormError, Input, Select } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { Confirm } from "./confirm";
import { InviteLink, type IssuedLink } from "./invite-link";
import type { AccountRow, PlayerOption } from "./queries";

type StaffRole = Exclude<AppRole, "player" | "guardian">;
export const STAFF_ROLES: StaffRole[] = ["coach", "secretary", "admin", "physio", "sporting_director", "accountant", "owner", "medical_partner"];

function GroupChecks({ groups, value, onChange, legend }: { groups: Group[]; value: string[]; onChange: (v: string[]) => void; legend: string }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-semibold text-ink-2">{legend}</legend>
      <div className="grid grid-cols-2 gap-x-4">
        {groups.map((g) => (
          <Checkbox
            key={g.id} label={g.name} checked={value.includes(g.id)}
            onChange={(e) => onChange(e.target.checked ? [...value, g.id] : value.filter((x) => x !== g.id))}
          />
        ))}
      </div>
    </fieldset>
  );
}

/** Cont de staff nou. După creare, dialogul arată linkul de invitație. */
export function NewStaffDialog({ open, onClose, groups }: { open: boolean; onClose: () => void; groups: Group[] }) {
  const t = useT().admin.accounts;
  const c = useT().common;
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("coach");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [issued, setIssued] = useState<IssuedLink | null>(null);
  const create = useAction(createStaffAccount, { onSuccess: setIssued });
  const close = () => {
    setFullName(""); setEmail(""); setRole("coach"); setGroupIds([]); setIssued(null);
    create.clearError();
    onClose();
  };
  return (
    <Dialog
      open={open} onClose={close} title={issued ? t.createdTitle : t.newStaffTitle}
      footer={issued ? <Button onClick={close}>{t.done}</Button> : (
        <>
          <Button variant="secondary" onClick={close}>{c.actions.cancel}</Button>
          <Button pending={create.pending} onClick={() => create.run({ fullName, email, role, groupIds })}>{t.createAndInvite}</Button>
        </>
      )}
    >
      {issued ? <InviteLink issued={issued} /> : (
        <div className="space-y-4">
          <Field label={c.fields.fullName}>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="off" />
          </Field>
          <Field label={c.fields.email} hint={t.emailHint}>
            <Input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" autoCapitalize="off" />
          </Field>
          <Field label={t.role} hint={ROLE_DESCRIPTIONS[role]}>
            <Select value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
              {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </Select>
          </Field>
          {role === "coach" ? <GroupChecks groups={groups} value={groupIds} onChange={setGroupIds} legend={t.coachGroups} /> : null}
          <FormError>{create.error}</FormError>
        </div>
      )}
    </Dialog>
  );
}

/** Cont pentru un jucător care nu are încă unul. */
export function PlayerAccountDialog({ open, onClose, players, groups, initialPlayerId }: {
  open: boolean; onClose: () => void; players: PlayerOption[]; groups: Group[]; initialPlayerId?: string;
}) {
  const t = useT().admin.accounts;
  const c = useT().common;
  const first = players.find((p) => p.id === initialPlayerId) ?? null;
  const [playerId, setPlayerId] = useState(first?.id ?? "");
  const [email, setEmail] = useState(first?.suggestedEmail ?? "");
  const [issued, setIssued] = useState<IssuedLink | null>(null);
  const create = useAction(createPlayerAccount, { onSuccess: setIssued });
  const player = players.find((p) => p.id === playerId) ?? null;
  const groupName = (id: string | null) => groups.find((g) => g.id === id)?.name;
  const close = () => {
    setPlayerId(""); setEmail(""); setIssued(null);
    create.clearError();
    onClose();
  };
  return (
    <Dialog
      open={open} onClose={close} title={issued ? t.createdTitle : t.newPlayerTitle}
      footer={issued ? <Button onClick={close}>{t.done}</Button> : (
        <>
          <Button variant="secondary" onClick={close}>{c.actions.cancel}</Button>
          <Button pending={create.pending} disabled={!playerId} onClick={() => create.run({ playerId, email })}>{t.createAndInvite}</Button>
        </>
      )}
    >
      {issued ? <InviteLink issued={issued} /> : (
        <div className="space-y-4">
          <Field label={t.player}>
            <Select
              value={playerId}
              onChange={(e) => {
                setPlayerId(e.target.value);
                setEmail(players.find((p) => p.id === e.target.value)?.suggestedEmail ?? "");
              }}
            >
              <option value="">{t.pickPlayer}</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>{[p.displayName, groupName(p.groupId)].filter(Boolean).join(" · ")}</option>
              ))}
            </Select>
          </Field>
          <Field label={c.fields.email} hint={player?.minor === false ? t.playerEmailAdult : t.playerEmailHint}>
            <Input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" autoCapitalize="off" />
          </Field>
          {player?.minor ? <Notice tone="yellow">{t.minorNotice}</Notice> : null}
          {player?.minor === null ? <Notice tone="gray">{t.unknownAgeNotice}</Notice> : null}
          <FormError>{create.error}</FormError>
        </div>
      )}
    </Dialog>
  );
}

/** Un cont existent: date, rol, grupe, acces, dezactivare, ștergere. */
export function AccountDialog({ account, onClose, groups, freePlayers }: {
  account: AccountRow; onClose: () => void; groups: Group[]; freePlayers: PlayerOption[];
}) {
  const t = useT().admin.accounts;
  const c = useT().common;
  const [fullName, setFullName] = useState(account.fullName);
  const [email, setEmail] = useState(account.email);
  const [role, setRole] = useState<AppRole>(account.role);
  const [groupIds, setGroupIds] = useState<string[]>(account.groupIds);
  const [issued, setIssued] = useState<IssuedLink | null>(null);
  const [confirm, setConfirm] = useState<"delete" | "disable" | "unlink" | null>(null);
  const [linkTo, setLinkTo] = useState("");

  const save = useAction(updateAccount, { onSuccess: onClose });
  const access = useAction(sendAccessLink, { onSuccess: setIssued, successMessage: false });
  const active = useAction(setAccountActive, { onSuccess: onClose });
  const unlink = useAction(unlinkPlayer, { onSuccess: onClose });
  const link = useAction(linkPlayer, { onSuccess: onClose });
  const remove = useAction(deleteAccount, { onSuccess: onClose });

  const isPlayer = account.role === "player";
  const anonymized = account.state === "anonymized";
  const disabled = account.state === "disabled" || anonymized;
  const dirty = fullName !== account.fullName || email !== account.email || role !== account.role
    || [...groupIds].sort().join() !== [...account.groupIds].sort().join();

  return (
    <Dialog
      open onClose={onClose} title={account.fullName}
      footer={anonymized ? <Button variant="secondary" onClick={onClose}>{c.actions.close}</Button> : (
        <>
          <Button variant="secondary" onClick={onClose}>{c.actions.cancel}</Button>
          <Button pending={save.pending} disabled={!dirty} onClick={() => save.run({ userId: account.id, fullName, email, role: role as Exclude<AppRole, "guardian">, groupIds })}>{t.save}</Button>
        </>
      )}
    >
      <div className="space-y-5">
        {account.isSelf ? <Notice tone="blue">{t.selfNotice}</Notice> : null}
        {anonymized ? <Notice tone="gray">{t.anonymizedNotice}</Notice> : (
          <div className="space-y-4">
            <Field label={c.fields.fullName}>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="off" />
            </Field>
            <Field label={c.fields.email} hint={isPlayer ? t.playerEmailHint : undefined}>
              <Input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" autoCapitalize="off" />
            </Field>
            {isPlayer ? (
              <Field label={t.role} hint={t.playerRoleLocked}>
                <Input value={ROLE_LABELS.player} disabled readOnly />
              </Field>
            ) : (
              <Field label={t.role} hint={ROLE_DESCRIPTIONS[role]}>
                <Select value={role} onChange={(e) => setRole(e.target.value as AppRole)}>
                  {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </Select>
              </Field>
            )}
            {role !== account.role ? (
              <Notice tone="yellow" title={t.roleChangeTitle}>
                {account.isSelf ? t.roleChangeSelf : t.roleChange(ROLE_LABELS[account.role], ROLE_LABELS[role])}
              </Notice>
            ) : null}
            {role === "coach" ? <GroupChecks groups={groups} value={groupIds} onChange={setGroupIds} legend={t.coachGroups} /> : null}
            <FormError>{save.error}</FormError>
          </div>
        )}

        {isPlayer && !anonymized ? (
          <section className="space-y-2 border-t border-line pt-4">
            <h3 className="font-bold">{t.linkedPlayer}</h3>
            {account.player ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <a href={`/jucatori/${account.player.id}`} className="font-semibold underline underline-offset-4">{account.player.displayName}</a>
                <Button variant="secondary" size="sm" icon={<Link2Off className="size-4" aria-hidden />} onClick={() => setConfirm("unlink")}>{t.unlink}</Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-ink-3">{t.noLinkedPlayer}</p>
                <div className="flex gap-2">
                  <Select aria-label={t.player} value={linkTo} onChange={(e) => setLinkTo(e.target.value)} className="min-w-0">
                    <option value="">{t.pickPlayer}</option>
                    {freePlayers.map((p) => <option key={p.id} value={p.id}>{p.displayName}</option>)}
                  </Select>
                  <Button variant="secondary" pending={link.pending} disabled={!linkTo} onClick={() => link.run({ userId: account.id, playerId: linkTo })}>{t.link}</Button>
                </div>
                <FormError>{link.error}</FormError>
              </>
            )}
          </section>
        ) : null}

        {!disabled ? (
          <section className="space-y-3 border-t border-line pt-4">
            <h3 className="font-bold">{t.accessTitle}</h3>
            <p className="text-sm text-ink-3">
              {account.state === "invited" ? t.accessInvited : t.accessActive}
              {account.inviteExpires ? ` ${t.linkValidUntil(account.inviteExpires)}` : ""}
            </p>
            {issued ? <InviteLink issued={issued} /> : (
              <Button
                variant="secondary" className="w-full whitespace-normal" pending={access.pending}
                icon={account.state === "invited" ? <Send className="size-5" aria-hidden /> : <KeyRound className="size-5" aria-hidden />}
                onClick={() => access.run({ userId: account.id })}
              >
                {account.state === "invited" ? t.resendInvite : t.sendReset}
              </Button>
            )}
            <FormError>{access.error}</FormError>
          </section>
        ) : null}

        {!account.isSelf ? (
          <section className="space-y-3 border-t border-line pt-4">
            <h3 className="font-bold">{t.dangerTitle}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {anonymized ? null : disabled ? (
                <Button variant="secondary" pending={active.pending} icon={<UserCheck className="size-5" aria-hidden />} onClick={() => active.run({ userId: account.id, active: true })}>
                  {t.enable}
                </Button>
              ) : (
                <Button variant="secondary" icon={<UserX className="size-5" aria-hidden />} onClick={() => setConfirm("disable")}>{t.disable}</Button>
              )}
              <Button variant="secondary" className="text-st-red" icon={<Trash2 className="size-5" aria-hidden />} onClick={() => setConfirm("delete")}>{t.delete}</Button>
            </div>
            <p className="text-sm text-ink-3">{t.disableVsDelete}</p>
            <FormError>{active.error}</FormError>
          </section>
        ) : null}
      </div>

      <Confirm
        open={confirm === "disable"} onClose={() => setConfirm(null)} title={t.disableTitle(account.fullName)} confirmLabel={t.disable}
        pending={active.pending} error={active.error} onConfirm={() => active.run({ userId: account.id, active: false })}
      >
        <p>{t.disableExplain}</p>
      </Confirm>
      <Confirm
        open={confirm === "unlink"} onClose={() => setConfirm(null)} title={t.unlinkTitle} confirmLabel={t.unlink}
        pending={unlink.pending} error={unlink.error} onConfirm={() => unlink.run({ userId: account.id })}
      >
        <p>{t.unlinkExplain}</p>
      </Confirm>
      <Confirm
        open={confirm === "delete"} onClose={() => setConfirm(null)} title={t.deleteTitle(account.fullName)} confirmLabel={t.delete}
        pending={remove.pending} error={remove.error} onConfirm={() => remove.run({ userId: account.id })}
      >
        <p>{t.deleteExplain}</p>
        {account.role === "medical_partner" ? <p className="font-semibold">{t.deletePartnerWarning}</p> : null}
        {isPlayer ? <p>{t.deletePlayerNote}</p> : null}
      </Confirm>
    </Dialog>
  );
}
