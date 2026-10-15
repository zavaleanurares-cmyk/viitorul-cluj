"use client";
import { useState } from "react";
import { Ban, Calculator, Check, CircleCheck, Hourglass, Plus, Trash2 } from "lucide-react";
import { BONUS_TRIGGER_LABELS, formatDateShort, formatLei } from "@club/shared";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Field, FormError, Input, Segmented, Select } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { useToast } from "@/components/ui/toast";
import { useT } from "@/messages";
import { cn } from "@/lib/cn";
import { computeBonuses, decideBonuses, deleteBonusRule, saveBonusRule } from "@/app/(app)/bani/prime/actions";
import { Money } from "./bits";
import { MoneyInput } from "./money-input";
import type { Opt } from "./departments";

export function BonusRuleButton({ teams, competitions }: { teams: Opt[]; competitions: Opt[] }) {
  const m = useT().money;
  const t = m.bonuses;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState<"player" | "staff">("player");
  const [trigger, setTrigger] = useState<keyof typeof BONUS_TRIGGER_LABELS>("win");
  const [amount, setAmount] = useState<number | null>(null);
  const [team, setTeam] = useState("");
  const [comp, setComp] = useState("");
  const a = useAction(saveBonusRule, { onSuccess: () => setOpen(false) });
  const triggers = target === "staff" ? (["win", "draw", "clean_sheet"] as const) : (Object.keys(BONUS_TRIGGER_LABELS) as Array<keyof typeof BONUS_TRIGGER_LABELS>);
  return (
    <>
      <Button variant="secondary" size="sm" icon={<Plus className="size-4" aria-hidden />} onClick={() => setOpen(true)}>{t.addRule}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t.addRule}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>{m.common.cancel}</Button>
          <Button pending={a.pending} disabled={!name.trim() || !amount} onClick={() => amount && a.run({ name, target, trigger: trigger as "win", amount, group_id: team || null, competition_id: comp || null })}>{m.common.save}</Button></>}>
        <div className="space-y-4">
          <Field label={t.fields.name}><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></Field>
          <div><p className="mb-1 text-sm font-semibold text-ink-2">{t.fields.target}</p>
            <Segmented label={t.fields.target} value={target} onChange={(v) => { setTarget(v); if (v === "staff" && !["win", "draw", "clean_sheet"].includes(trigger)) setTrigger("win"); }} options={[{ value: "player", label: t.fields.targets.player }, { value: "staff", label: t.fields.targets.staff }]} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.fields.trigger}>
              <Select value={trigger} onChange={(e) => setTrigger(e.target.value as typeof trigger)}>
                {triggers.map((k) => <option key={k} value={k}>{BONUS_TRIGGER_LABELS[k]}</option>)}
              </Select>
            </Field>
            <Field label={t.fields.amount}><MoneyInput value={amount} onChange={setAmount} /></Field>
            <Field label={t.fields.team}>
              <Select value={team} onChange={(e) => setTeam(e.target.value)}><option value="">{t.fields.allTeams}</option>{teams.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</Select>
            </Field>
            <Field label={t.fields.competition}>
              <Select value={comp} onChange={(e) => setComp(e.target.value)}><option value="">{t.fields.allCompetitions}</option>{competitions.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</Select>
            </Field>
          </div>
          <FormError>{a.error}</FormError>
        </div>
      </Dialog>
    </>
  );
}

export function DeleteRuleButton({ id, label }: { id: string; label: string }) {
  const a = useAction(deleteBonusRule);
  return <IconButton label={label} onClick={() => a.run({ id })}><Trash2 className="size-4" aria-hidden /></IconButton>;
}

export function ComputeButton({ from, to }: { from: string; to: string }) {
  const t = useT().money.bonuses;
  const toast = useToast();
  const [f, setF] = useState(from);
  const [tt, setT] = useState(to);
  const a = useAction(computeBonuses, { successMessage: false, onSuccess: (n) => toast(t.computed(n)) });
  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field label={t.fields.from}><Input type="date" value={f} onChange={(e) => setF(e.target.value)} /></Field>
      <Field label={t.fields.to}><Input type="date" value={tt} onChange={(e) => setT(e.target.value)} /></Field>
      <Button icon={<Calculator className="size-5" aria-hidden />} pending={a.pending} onClick={() => a.run({ from: f, to: tt })}>{t.compute}</Button>
    </div>
  );
}

export type BonusEntry = { id: string; who: string; match: string; date: string; rule: string; quantity: number; amount: number; status: string };

const STATUS_ICON = { pending: Hourglass, approved: Check, paid: CircleCheck, cancelled: Ban } as const;
const STATUS_CLS: Record<string, string> = {
  pending: "bg-st-yellow text-ink", approved: "bg-st-blue-soft text-ink", paid: "bg-st-green text-white", cancelled: "bg-sunken text-ink-3",
};

export function BonusEntries({ entries }: { entries: BonusEntry[] }) {
  const t = useT().money.bonuses;
  const [sel, setSel] = useState<Set<string>>(new Set());
  const a = useAction(decideBonuses, { onSuccess: () => setSel(new Set()) });
  const total = entries.filter((e) => sel.has(e.id)).reduce((s, e) => s + e.amount, 0);
  return (
    <div className="space-y-3">
      {sel.size ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] bg-canvas p-2">
          <span className="font-semibold">{t.selected(sel.size)} · {formatLei(total)}</span>
          <Button size="sm" variant="secondary" pending={a.pending} onClick={() => a.run({ ids: [...sel], status: "approved" })}>{t.approve}</Button>
          <Button size="sm" variant="secondary" pending={a.pending} onClick={() => a.run({ ids: [...sel], status: "paid" })}>{t.markPaid}</Button>
          <Button size="sm" variant="ghost" pending={a.pending} onClick={() => a.run({ ids: [...sel], status: "cancelled" })}>{t.cancelEntries}</Button>
        </div>
      ) : null}
      <ul className="divide-y divide-line rounded-[var(--radius-control)] border border-line">
        {entries.map((e) => (
          <li key={e.id}>
            <label className="flex min-h-14 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <input type="checkbox" className="size-5 accent-[var(--color-brand)]" checked={sel.has(e.id)} onChange={(ev) => { const n = new Set(sel); if (ev.target.checked) n.add(e.id); else n.delete(e.id); setSel(n); }} />
              <span className="min-w-0 flex-1 basis-48">
                <span className="block font-semibold">{e.who}</span>
                <span className="block text-sm text-ink-3">{formatDateShort(e.date)} · {e.match} · {e.rule}{e.quantity > 1 ? ` × ${e.quantity}` : ""}</span>
              </span>
              <span className={cn("inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs font-semibold", STATUS_CLS[e.status])}>
                {(() => { const I = STATUS_ICON[e.status as keyof typeof STATUS_ICON] ?? Hourglass; return <I className="size-3.5" aria-hidden />; })()}
                {t.status[e.status as keyof typeof t.status]}
              </span>
              <Money value={e.amount} className="ml-auto shrink-0 text-right font-bold sm:w-24" />
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
