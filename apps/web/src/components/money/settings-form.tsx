"use client";
import { useState } from "react";
import { MONTHS_RO, ROLE_LABELS, formatIban, isValidIban } from "@club/shared";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Notice } from "@/components/ui/card";
import { Checkbox, Field, FormError, Input, Select } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { saveFinanceSettings } from "@/app/(app)/bani/setari/actions";

export type SettingsValue = {
  beneficiary: string; fiscal_code: string; address: string; iban: string; bank_name: string; receipt_prefix: string; ref_prefix: string;
  issue_day: number; due_day: number; reminder_days: number[]; fee_months: number[]; sibling_discount_pct: number; auto_issue: boolean;
  online_enabled: boolean; provider: string; vat_rates: number[]; approver_roles: string[];
};
const APPROVERS = ["admin", "owner", "sporting_director", "accountant", "secretary"] as const;
const list = (s: string) => s.split(/[,\s;]+/).map((x) => Number(x)).filter((n) => Number.isInteger(n));

export function FinanceSettingsForm({ initial, providers, canSetApprovers }: { initial: SettingsValue; providers: Array<{ id: string; label: string; test: boolean }>; canSetApprovers: boolean }) {
  const m = useT().money;
  const t = m.settings;
  const [v, setV] = useState(initial);
  const [reminders, setReminders] = useState(initial.reminder_days.join(", "));
  const [vat, setVat] = useState(initial.vat_rates.join(", "));
  const a = useAction(saveFinanceSettings);
  const set = <K extends keyof SettingsValue>(k: K, val: SettingsValue[K]) => setV({ ...v, [k]: val });
  const ibanBad = !!v.iban.trim() && !isValidIban(v.iban);
  const provider = providers.find((p) => p.id === v.provider);
  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); a.run({ ...v, online_enabled: providers.length ? v.online_enabled : false, reminder_days: list(reminders), vat_rates: list(vat), approver_roles: v.approver_roles as Array<"admin"> }); }}>
      <Card>
        <CardHeader title={t.sections.identity} />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label={t.fields.beneficiary}><Input value={v.beneficiary} onChange={(e) => set("beneficiary", e.target.value)} maxLength={200} /></Field>
          <Field label={t.fields.fiscalCode}><Input value={v.fiscal_code} onChange={(e) => set("fiscal_code", e.target.value)} maxLength={30} /></Field>
          <Field label={t.fields.address} className="sm:col-span-2"><Input value={v.address} onChange={(e) => set("address", e.target.value)} maxLength={300} /></Field>
          <Field label={t.fields.iban} error={ibanBad ? t.invalidIban : undefined}><Input value={v.iban} aria-invalid={ibanBad || undefined} onChange={(e) => set("iban", e.target.value)} onBlur={() => !ibanBad && v.iban && set("iban", formatIban(v.iban))} maxLength={40} /></Field>
          <Field label={t.fields.bankName}><Input value={v.bank_name} onChange={(e) => set("bank_name", e.target.value)} maxLength={80} /></Field>
          <Field label={t.fields.receiptPrefix} hint={t.fields.receiptPrefixHint}><Input value={v.receipt_prefix} onChange={(e) => set("receipt_prefix", e.target.value.toUpperCase())} maxLength={6} /></Field>
          <Field label={t.fields.refPrefix} hint={t.fields.refPrefixHint}><Input value={v.ref_prefix} onChange={(e) => set("ref_prefix", e.target.value.toUpperCase())} maxLength={6} /></Field>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t.sections.calendar} />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t.fields.issueDay}><Input type="number" min={1} max={28} value={v.issue_day} onChange={(e) => set("issue_day", Number(e.target.value))} /></Field>
            <Field label={t.fields.dueDay}><Input type="number" min={1} max={28} value={v.due_day} onChange={(e) => set("due_day", Number(e.target.value))} /></Field>
            <Field label={t.fields.sibling} hint={t.fields.siblingHint}><Input type="number" min={0} max={100} value={v.sibling_discount_pct} onChange={(e) => set("sibling_discount_pct", Number(e.target.value))} /></Field>
          </div>
          <Field label={t.fields.reminderDays} hint={t.fields.reminderDaysHint}><Input value={reminders} onChange={(e) => setReminders(e.target.value)} /></Field>
          <fieldset>
            <legend className="mb-1 text-sm font-semibold text-ink-2">{t.fields.feeMonths}</legend>
            <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-4">
              {MONTHS_RO.map((mo, i) => (
                <Checkbox key={mo} className="min-h-10 py-1" label={mo} checked={v.fee_months.includes(i + 1)}
                  onChange={(e) => set("fee_months", e.target.checked ? [...v.fee_months, i + 1].sort((a, b) => a - b) : v.fee_months.filter((x) => x !== i + 1))} />
              ))}
            </div>
          </fieldset>
          <Checkbox label={t.fields.autoIssue} checked={v.auto_issue} onChange={(e) => set("auto_issue", e.target.checked)} />
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t.sections.online} />
        <CardBody className="space-y-4">
          {providers.length === 0 ? <Notice tone="gray">{t.noProvider}</Notice> : (
            <>
              <Checkbox label={t.fields.online} checked={v.online_enabled} onChange={(e) => set("online_enabled", e.target.checked)} />
              <Field label={t.fields.provider}>
                <Select value={v.provider} onChange={(e) => set("provider", e.target.value)}>
                  {providers.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </Select>
              </Field>
              {provider?.test ? <Notice tone="yellow">{t.providerTest}</Notice> : null}
            </>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title={t.sections.purchases} />
        <CardBody className="space-y-4">
          <Field label={t.fields.vatRates} hint={t.fields.vatRatesHint}><Input value={vat} onChange={(e) => setVat(e.target.value)} /></Field>
          <fieldset>
            <legend className="mb-1 text-sm font-semibold text-ink-2">{t.fields.approvers}</legend>
            {!canSetApprovers ? <p className="mb-1 text-sm text-ink-3">{t.approversAdminOnly}</p> : null}
            {APPROVERS.map((r) => (
              <Checkbox key={r} className="min-h-10 py-1" label={ROLE_LABELS[r]} checked={v.approver_roles.includes(r)} disabled={!canSetApprovers}
                onChange={(e) => set("approver_roles", e.target.checked ? [...v.approver_roles, r] : v.approver_roles.filter((x) => x !== r))} />
            ))}
          </fieldset>
        </CardBody>
      </Card>
      <FormError>{a.error}</FormError>
      <div className="flex justify-end"><Button type="submit" pending={a.pending} disabled={ibanBad}>{m.common.save}</Button></div>
    </form>
  );
}
