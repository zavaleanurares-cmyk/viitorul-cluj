"use client";
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { ADJUSTMENT_REASON_LABELS, CHARGE_KIND_LABELS, norm } from "@club/shared";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Checkbox, Field, FormError, Input, Segmented, Select, Textarea } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { useToast } from "@/components/ui/toast";
import { useT } from "@/messages";
import { deleteChargeRequest, endAdjustment, endPlayerFee, saveAdjustment, saveChargeRequest, savePlayerFee, saveTeamFee } from "@/app/(app)/bani/taxe/actions";
import { MoneyInput } from "./money-input";

export type PickPlayer = { id: string; name: string; groupId: string | null };
export type PickTeam = { id: string; name: string };

const toPeriod = (month: string) => (month ? `${month}-01` : "");
const toMonth = (period: string | null | undefined) => (period ? period.slice(0, 7) : "");

/** Alegerea jucătorilor pe echipe (echipă întreagă sau jucători anume). */
function PlayerPicker({ players, teams, value, onChange, locked }: { players: PickPlayer[]; teams: PickTeam[]; value: Set<string>; onChange: (v: Set<string>) => void; locked: Set<string> }) {
  const mm = useT().money;
  const t = mm.requests.fields;
  const [q, setQ] = useState("");
  const byTeam = useMemo(() => {
    const m = new Map<string, PickPlayer[]>();
    for (const p of players) m.set(p.groupId ?? "none", [...(m.get(p.groupId ?? "none") ?? []), p]);
    return m;
  }, [players]);
  const n = norm(q);
  return (
    <div className="space-y-2">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={mm.common.search} aria-label={mm.common.search} />
      <div className="max-h-72 space-y-3 overflow-y-auto rounded-[var(--radius-control)] border border-line p-3">
        {teams.concat(byTeam.has("none") ? [{ id: "none", name: mm.common.none }] : []).map((team) => {
          const list = (byTeam.get(team.id) ?? []).filter((p) => !n || norm(p.name).includes(n));
          if (!list.length) return null;
          const all = list.every((p) => value.has(p.id) || locked.has(p.id));
          return (
            <fieldset key={team.id}>
              <legend className="sr-only">{team.name}</legend>
              <Checkbox label={t.selectTeam(team.name, list.length)} checked={all} onChange={(e) => {
                const next = new Set(value);
                for (const p of list) if (!locked.has(p.id)) { if (e.target.checked) next.add(p.id); else next.delete(p.id); }
                onChange(next);
              }} />
              <div className="grid gap-x-4 pl-9 sm:grid-cols-2">
                {list.map((p) => (
                  <Checkbox key={p.id} className="min-h-10 py-1" label={p.name} description={locked.has(p.id) ? t.already : undefined}
                    checked={value.has(p.id) || locked.has(p.id)} disabled={locked.has(p.id)}
                    onChange={(e) => { const next = new Set(value); if (e.target.checked) next.add(p.id); else next.delete(p.id); onChange(next); }} />
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>
      <p className="text-sm text-ink-3" role="status">{t.selected(value.size)}</p>
    </div>
  );
}

export type RequestValue = { id: string; title: string; description: string | null; kind: string; amount: number; due_on: string; playerIds: string[] };

export function ChargeRequestButton({ players, teams, today, request }: { players: PickPlayer[]; teams: PickTeam[]; today: string; request?: RequestValue }) {
  const m = useT().money;
  const t = m.requests;
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(request?.title ?? "");
  const [description, setDescription] = useState(request?.description ?? "");
  const [kind, setKind] = useState(request?.kind ?? "one_off");
  const [amount, setAmount] = useState<number | null>(request?.amount ?? null);
  const [due, setDue] = useState(request?.due_on ?? today);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const locked = useMemo(() => new Set(request?.playerIds ?? []), [request]);
  const save = useAction(saveChargeRequest, { successMessage: false, onSuccess: (r) => { toast(t.saved(r.created)); setOpen(false); } });
  const del = useAction(deleteChargeRequest, { onSuccess: () => setOpen(false) });
  return (
    <>
      {request
        ? <IconButton label={t.edit} onClick={() => setOpen(true)}><Pencil className="size-5" aria-hidden /></IconButton>
        : <Button icon={<Plus className="size-5" aria-hidden />} onClick={() => setOpen(true)}>{t.add}</Button>}
      <Dialog open={open} onClose={() => setOpen(false)} title={request ? t.edit : t.add} wide
        footer={<>
          {request ? <Button variant="ghost" icon={<Trash2 className="size-5" aria-hidden />} pending={del.pending} onClick={() => del.run({ id: request.id })}>{m.common.delete}</Button> : null}
          <Button variant="ghost" onClick={() => setOpen(false)}>{m.common.cancel}</Button>
          <Button pending={save.pending} disabled={!title.trim() || !amount || (!request && picked.size === 0)}
            onClick={() => amount && save.run({ id: request?.id ?? null, title, description: description || undefined, kind: kind as "one_off", amount, due_on: due, player_ids: [...picked] })}>{m.common.save}</Button>
        </>}>
        <div className="space-y-4">
          <Field label={t.fields.title} hint={t.fields.titleHint}><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t.fields.kind}>
              <Select value={kind} onChange={(e) => setKind(e.target.value)}>
                {(["one_off", "camp", "equipment", "insurance", "other"] as const).map((k) => <option key={k} value={k}>{CHARGE_KIND_LABELS[k]}</option>)}
              </Select>
            </Field>
            <Field label={t.fields.amount}><MoneyInput value={amount} onChange={setAmount} /></Field>
            <Field label={t.fields.due}><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
          </div>
          <Field label={t.fields.description} optional><Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} /></Field>
          <div>
            <p className="mb-1 text-sm font-semibold text-ink-2">{t.fields.players}</p>
            <p className="mb-2 text-sm text-ink-3">{t.fields.playersHint}</p>
            <PlayerPicker players={players} teams={teams} value={picked} onChange={setPicked} locked={locked} />
          </div>
          <FormError>{save.error ?? del.error}</FormError>
        </div>
      </Dialog>
    </>
  );
}

export function TeamFeeButton({ team, current, period }: { team: PickTeam; current: number | null; period: string }) {
  const m = useT().money;
  const t = m.plans;
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number | null>(current);
  const [from, setFrom] = useState(toMonth(period));
  const save = useAction(saveTeamFee, { onSuccess: () => setOpen(false) });
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>{current === null ? t.setTeam : m.common.edit}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`${t.teamCols.amount} · ${team.name}`}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>{m.common.cancel}</Button>
          <Button pending={save.pending} disabled={amount === null || !from} onClick={() => save.run({ groupId: team.id, amount: amount ?? 0, from: toPeriod(from) })}>{m.common.save}</Button></>}>
        <div className="space-y-4">
          <p className="text-ink-3">{t.teamsDescription}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.fields.amount}><MoneyInput value={amount} onChange={setAmount} /></Field>
            <Field label={t.fields.from}><Input type="month" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          </div>
          <FormError>{save.error}</FormError>
        </div>
      </Dialog>
    </>
  );
}

export function PlayerFeeButton({ players, period }: { players: PickPlayer[]; period: string }) {
  const m = useT().money;
  const t = m.plans;
  const [open, setOpen] = useState(false);
  const [player, setPlayer] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [from, setFrom] = useState(toMonth(period));
  const [reason, setReason] = useState("");
  const save = useAction(savePlayerFee, { onSuccess: () => setOpen(false) });
  return (
    <>
      <Button variant="secondary" size="sm" icon={<Plus className="size-4" aria-hidden />} onClick={() => setOpen(true)}>{t.addPlayerPlan}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t.addPlayerPlan}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>{m.common.cancel}</Button>
          <Button pending={save.pending} disabled={!player || amount === null} onClick={() => save.run({ playerId: player, amount: amount ?? 0, from: toPeriod(from), reason: reason || undefined })}>{m.common.save}</Button></>}>
        <div className="space-y-4">
          <p className="text-ink-3">{t.playerPlansDescription}</p>
          <Field label={t.fields.player}>
            <Select value={player} onChange={(e) => setPlayer(e.target.value)}>
              <option value="" />
              {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.fields.amount}><MoneyInput value={amount} onChange={setAmount} /></Field>
            <Field label={t.fields.from}><Input type="month" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          </div>
          <Field label={t.fields.note} optional><Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} /></Field>
          <FormError>{save.error}</FormError>
        </div>
      </Dialog>
    </>
  );
}

export function EndPlanButton({ id, period, kind }: { id: string; period: string; kind: "plan" | "adjustment" }) {
  const m = useT().money;
  const t = m.plans;
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(toMonth(period));
  const endPlan = useAction(endPlayerFee, { onSuccess: () => setOpen(false) });
  const endAdj = useAction(endAdjustment, { onSuccess: () => setOpen(false) });
  const a = kind === "plan" ? endPlan : endAdj;
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>{t.remove}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t.remove}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>{m.common.cancel}</Button>
          <Button pending={a.pending} onClick={() => kind === "plan" ? endPlan.run({ planId: id, from: toPeriod(from) }) : endAdj.run({ id, from: toPeriod(from) })}>{t.remove}</Button></>}>
        <div className="space-y-3">
          <p className="text-ink-3">{t.removeHint}</p>
          <Field label={t.fields.from}><Input type="month" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <FormError>{a.error}</FormError>
        </div>
      </Dialog>
    </>
  );
}

export function AdjustmentButton({ players, period }: { players: PickPlayer[]; period: string }) {
  const m = useT().money;
  const t = m.plans;
  const [open, setOpen] = useState(false);
  const [player, setPlayer] = useState("");
  const [kind, setKind] = useState<"percent" | "amount" | "waiver">("percent");
  const [pct, setPct] = useState("50");
  const [amount, setAmount] = useState<number | null>(null);
  const [reason, setReason] = useState<keyof typeof ADJUSTMENT_REASON_LABELS>("sibling");
  const [note, setNote] = useState("");
  const [from, setFrom] = useState(toMonth(period));
  const [to, setTo] = useState("");
  const save = useAction(saveAdjustment, { onSuccess: () => setOpen(false) });
  const value = kind === "percent" ? Number(pct) || 0 : kind === "amount" ? amount ?? 0 : 0;
  return (
    <>
      <Button variant="secondary" size="sm" icon={<Plus className="size-4" aria-hidden />} onClick={() => setOpen(true)}>{t.addAdjustment}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t.addAdjustment}
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>{m.common.cancel}</Button>
          <Button pending={save.pending} disabled={!player || !from} onClick={() => save.run({
            player_id: player, kind, value, reason: reason as "sibling", note: note || undefined, from_month: toPeriod(from), to_month: to ? toPeriod(to) : null,
          })}>{m.common.save}</Button></>}>
        <div className="space-y-4">
          <Field label={t.fields.player}>
            <Select value={player} onChange={(e) => setPlayer(e.target.value)}>
              <option value="" />
              {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <div>
            <p className="mb-1 text-sm font-semibold text-ink-2">{t.fields.kind}</p>
            <Segmented label={t.fields.kind} value={kind} onChange={setKind} options={(["percent", "amount", "waiver"] as const).map((k) => ({ value: k, label: t.fields.kinds[k] }))} />
          </div>
          {kind === "percent" ? (
            <Field label={`${t.fields.value} (%)`}><Input type="number" inputMode="numeric" min={1} max={100} value={pct} onChange={(e) => setPct(e.target.value)} /></Field>
          ) : kind === "amount" ? (
            <Field label={t.fields.value}><MoneyInput value={amount} onChange={setAmount} /></Field>
          ) : null}
          <Field label={t.fields.reason}>
            <Select value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
              {Object.entries(ADJUSTMENT_REASON_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.fields.from}><Input type="month" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label={t.fields.to} optional><Input type="month" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          </div>
          <Field label={t.fields.note} optional><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} /></Field>
          <FormError>{save.error}</FormError>
        </div>
      </Dialog>
    </>
  );
}
