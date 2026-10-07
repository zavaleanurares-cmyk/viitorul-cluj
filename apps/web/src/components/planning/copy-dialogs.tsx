"use client";
import { useMemo, useState } from "react";
import { useT } from "@/messages";
import { useAction } from "@/lib/use-action";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";
import { Notice } from "@/components/ui/card";
import { Dialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { copyPlan } from "@/app/(app)/planuri/actions";
import { DayPicker } from "./day-picker";
import { PlayerChecklist } from "./player-checklist";
import type { GroupOption, PlayerOption } from "./types";

type Common = {
  open: boolean;
  onClose: () => void;
  planId: string;
  playerId: string;
  date: string;
  today: string;
  /** lunea primei săptămâni din mini-calendar */
  calendarStart: string;
  /** zilele în care fiecare jucător are deja plan (în intervalul mini-calendarului) */
  planDates: Record<string, string[]>;
};

function Summary({ plans, replaced }: { plans: number; replaced: number }) {
  const t = useT().planning.copy;
  if (!plans) return null;
  return (
    <Notice tone={replaced ? "yellow" : "blue"}>
      <p className="font-semibold text-ink" aria-live="polite">{t.summary(plans)} {replaced ? t.replaceCount(replaced) : ""}</p>
      {replaced ? <p className="mt-1 text-sm">{t.warning}</p> : null}
    </Notice>
  );
}

/** „Copiază pe alte zile": aceleași exerciții, același jucător. */
export function CopyToDaysDialog({ open, onClose, planId, playerId, date, today, calendarStart, planDates }: Common) {
  const all = useT();
  const t = all.planning.copy;
  const [days, setDays] = useState<string[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const existing = useMemo(() => new Set((planDates[playerId] ?? []).filter((d) => d !== date)), [planDates, playerId, date]);
  const toast = useToast();
  const copy = useAction(copyPlan, {
    successMessage: false,
    onSuccess: (data) => { toast(t.done(data.copied)); setDays([]); onClose(); },
  });
  const submit = () => {
    setProblem(null);
    if (!days.length) return setProblem(t.errors.noDays);
    void copy.run({ planId, dates: days, playerIds: null });
  };
  const replaced = days.filter((d) => existing.has(d)).length;

  return (
    <Dialog open={open} onClose={onClose} title={t.daysTitle}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{all.common.actions.cancel}</Button>
          <Button pending={copy.pending} onClick={submit}>{days.length ? t.confirmCount(days.length) : t.confirm}</Button>
        </>
      }>
      <div className="space-y-3">
        <DayPicker label={t.days} start={calendarStart} value={days} onChange={setDays} today={today}
          disabledDay={date} disabledLabel={t.sourceDay} marks={existing} markLabel={t.hasPlan} />
        <p className="text-sm text-ink-3">{t.legendHasPlan}</p>
        <Summary plans={days.length} replaced={replaced} />
        <FormError>{problem ?? copy.error}</FormError>
      </div>
    </Dialog>
  );
}

/** „Copiază la alți jucători": aceeași zi (implicit) sau mai multe zile. */
export function CopyToPlayersDialog({ open, onClose, planId, playerId, date, today, calendarStart, planDates, players, groups }: Common & {
  players: PlayerOption[];
  groups: GroupOption[];
}) {
  const all = useT();
  const t = all.planning.copy;
  const [ids, setIds] = useState<string[]>([]);
  const [days, setDays] = useState<string[]>([date]);
  const [problem, setProblem] = useState<string | null>(null);
  const others = useMemo(() => players.filter((p) => p.id !== playerId), [players, playerId]);
  const toast = useToast();
  const copy = useAction(copyPlan, {
    successMessage: false,
    onSuccess: (data) => { toast(t.done(data.copied)); setIds([]); setDays([date]); onClose(); },
  });
  const withPlan = useMemo(
    () => new Set(others.filter((p) => (planDates[p.id] ?? []).some((d) => days.includes(d))).map((p) => p.id)),
    [others, planDates, days],
  );
  const replaced = ids.reduce((n, id) => n + (planDates[id] ?? []).filter((d) => days.includes(d)).length, 0);
  const submit = () => {
    setProblem(null);
    if (!ids.length) return setProblem(t.errors.noPlayers);
    if (!days.length) return setProblem(t.errors.noDays);
    void copy.run({ planId, dates: days, playerIds: ids });
  };

  return (
    <Dialog open={open} onClose={onClose} title={t.playersTitle} wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{all.common.actions.cancel}</Button>
          <Button pending={copy.pending} onClick={submit}>{ids.length && days.length ? t.confirmCount(ids.length * days.length) : t.confirm}</Button>
        </>
      }>
      <div className="grid gap-4 md:grid-cols-2">
        <fieldset>
          <legend className="mb-1 text-sm font-semibold text-ink-2">{t.players}</legend>
          <PlayerChecklist players={others} groups={groups} value={ids} onChange={setIds} marks={withPlan} markLabel={t.hasPlan} />
        </fieldset>
        <div className="space-y-3">
          <fieldset>
            <legend className="mb-1 text-sm font-semibold text-ink-2">{t.days}</legend>
            <DayPicker label={t.days} start={calendarStart} value={days} onChange={setDays} today={today} />
          </fieldset>
          <Summary plans={ids.length * days.length} replaced={replaced} />
          <FormError>{problem ?? copy.error}</FormError>
        </div>
      </div>
    </Dialog>
  );
}
