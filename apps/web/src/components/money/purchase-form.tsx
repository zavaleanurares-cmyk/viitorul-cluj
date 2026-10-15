"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, Send, Trash2, Upload } from "lucide-react";
import { formatLei, vatLine } from "@club/shared";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { useToast } from "@/components/ui/toast";
import { uploadFile } from "@/lib/upload";
import { useT } from "@/messages";
import { savePurchaseRequest } from "@/app/(app)/bani/referate/actions";
import { Money } from "./bits";
import { MoneyInput } from "./money-input";
import type { Opt } from "./departments";

export type PRItem = { name: string; details: string; unit: string; quantity: number; unit_price: number | null; vat_rate: number; price_includes_vat: boolean };
export type PRValue = { id: string | null; department_id: string | null; group_id: string | null; justification: string; needed_by: string | null; spec_path: string | null; items: PRItem[] };

const blank = (vat: number): PRItem => ({ name: "", details: "", unit: "buc", quantity: 1, unit_price: null, vat_rate: vat, price_includes_vat: true });
const safeName = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-.]+/, "").slice(-80) || "specificatie";

/** Referatul: de ce, articolele cu preț și TVA (totaluri calculate la fel ca pe server), apoi trimiterea spre aprobare. */
export function PurchaseForm({ initial, departments, teams, vatRates, clubId, userId, budgetNote }: {
  initial: PRValue; departments: Opt[]; teams: Opt[]; vatRates: number[]; clubId: string; userId: string; budgetNote?: string | null;
}) {
  const m = useT().money;
  const t = m.purchases.form;
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState(initial);
  const [uploading, setUploading] = useState(false);
  const save = useAction(savePurchaseRequest, {
    successMessage: false,
    onSuccess: (r) => { toast(submitting ? t.submitted(r.number) : t.draftSaved); router.push(`/bani/referate/${r.id}`); },
  });
  const [submitting, setSubmitting] = useState(true);
  const setItem = (i: number, patch: Partial<PRItem>) => setV({ ...v, items: v.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  const lines = v.items.map((it) => vatLine(it.quantity || 0, it.unit_price ?? 0, it.vat_rate, it.price_includes_vat));
  const net = lines.reduce((s, l) => s + l.net, 0);
  const vat = lines.reduce((s, l) => s + l.vat, 0);
  const valid = v.justification.trim() && v.items.length > 0 && v.items.every((it) => it.name.trim() && it.quantity > 0 && it.unit_price !== null);
  const send = (submit: boolean) => {
    setSubmitting(submit);
    save.run({
      id: v.id, department_id: v.department_id, group_id: v.group_id, justification: v.justification, needed_by: v.needed_by, spec_path: v.spec_path, submit,
      items: v.items.map((it) => ({ name: it.name, details: it.details || undefined, unit: it.unit || undefined, quantity: it.quantity, unit_price: it.unit_price ?? 0, vat_rate: it.vat_rate, price_includes_vat: it.price_includes_vat })),
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="space-y-4">
          <Field label={t.justification} hint={t.justificationHint}><Textarea rows={3} value={v.justification} onChange={(e) => setV({ ...v, justification: e.target.value })} maxLength={2000} /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t.department}>
              <Select value={v.department_id ?? ""} onChange={(e) => setV({ ...v, department_id: e.target.value || null })}>
                <option value="">{m.expenses.fields.noDepartment}</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </Select>
            </Field>
            <Field label={t.team}>
              <Select value={v.group_id ?? ""} onChange={(e) => setV({ ...v, group_id: e.target.value || null })}>
                <option value="">—</option>
                {teams.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
              </Select>
            </Field>
            <Field label={t.neededBy}><Input type="date" value={v.needed_by ?? ""} onChange={(e) => setV({ ...v, needed_by: e.target.value || null })} /></Field>
          </div>
          {budgetNote ? <p className="text-sm text-ink-3">{budgetNote}</p> : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t.items} />
        <CardBody className="space-y-3">
          {v.items.map((it, i) => (
            <fieldset key={i} className="grid gap-3 rounded-[var(--radius-control)] border border-line p-3 sm:grid-cols-12">
              <legend className="sr-only">{t.item.name} {i + 1}</legend>
              <Field label={t.item.name} className="sm:col-span-5"><Input value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} maxLength={200} /></Field>
              <Field label={t.item.qty} className="sm:col-span-2"><Input type="number" inputMode="decimal" min={0} step="any" value={it.quantity} onChange={(e) => setItem(i, { quantity: Number(e.target.value) })} /></Field>
              <Field label={t.item.unit} className="sm:col-span-1"><Input value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })} maxLength={20} /></Field>
              <Field label={t.item.price} className="sm:col-span-3"><MoneyInput value={it.unit_price} onChange={(x) => setItem(i, { unit_price: x })} /></Field>
              <div className="flex items-end justify-end sm:col-span-1">
                <IconButton label={t.removeItem} disabled={v.items.length === 1} onClick={() => setV({ ...v, items: v.items.filter((_, j) => j !== i) })}><Trash2 className="size-5" aria-hidden /></IconButton>
              </div>
              <Field label={t.item.details} optional className="sm:col-span-6"><Input value={it.details} onChange={(e) => setItem(i, { details: e.target.value })} maxLength={500} /></Field>
              <Field label={t.item.vat} className="sm:col-span-2">
                <Select value={it.vat_rate} onChange={(e) => setItem(i, { vat_rate: Number(e.target.value) })}>
                  {vatRates.map((r) => <option key={r} value={r}>{r}%</option>)}
                </Select>
              </Field>
              <label className="flex min-h-12 items-center gap-2 sm:col-span-2 sm:self-end">
                <input type="checkbox" className="size-5 accent-[var(--color-brand)]" checked={it.price_includes_vat} onChange={(e) => setItem(i, { price_includes_vat: e.target.checked })} />
                <span className="text-sm font-semibold">{t.item.includes}</span>
              </label>
              <p className="self-end text-right font-bold sm:col-span-2"><Money value={lines[i].gross} /></p>
            </fieldset>
          ))}
          <Button variant="secondary" icon={<Plus className="size-5" aria-hidden />} onClick={() => setV({ ...v, items: [...v.items, blank(vatRates[0] ?? 21)] })}>{t.addItem}</Button>
          <dl className="ml-auto grid max-w-xs grid-cols-2 gap-x-4 gap-y-1 text-right">
            <dt className="text-ink-3">{t.totals.net}</dt><dd className="tabular-nums">{formatLei(net, { decimals: "always" })}</dd>
            <dt className="text-ink-3">{t.totals.vat}</dt><dd className="tabular-nums">{formatLei(vat, { decimals: "always" })}</dd>
            <dt className="font-bold">{t.totals.total}</dt><dd className="text-lg font-bold tabular-nums">{formatLei(net + vat, { decimals: "always" })}</dd>
          </dl>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full px-4 font-medium hover:bg-line bg-sunken transition-colors">
          <Upload className="size-5" aria-hidden /> {m.expenses.fields.document}
          <input type="file" accept="application/pdf,image/*" className="sr-only" onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setUploading(true);
            const res = await uploadFile("finance", `${clubId}/${userId}/${crypto.randomUUID()}-${safeName(f.name)}`, f);
            setUploading(false);
            if (!res.ok) { toast(res.error, "error"); return; }
            setV({ ...v, spec_path: res.path });
          }} />
        </label>
        {v.spec_path ? <span className="inline-flex items-center gap-1 text-sm"><FileText className="size-4" aria-hidden />{v.spec_path.split("/").pop()}</span> : null}
      </div>
      <FormError>{save.error}</FormError>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" disabled={!valid || uploading} pending={save.pending && !submitting} onClick={() => send(false)}>{t.saveDraft}</Button>
        <Button disabled={!valid || uploading} pending={save.pending && submitting} icon={<Send className="size-5" aria-hidden />} onClick={() => send(true)}>{t.submit}</Button>
      </div>
    </div>
  );
}

