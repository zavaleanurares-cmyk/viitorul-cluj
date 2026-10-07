"use client";
import { useMemo, useState } from "react";
import { POSITIONS, PROGRAM_KINDS, WEEKDAYS_RO, WEEKDAYS_SHORT_RO, label, scheduledDays } from "@club/shared";
import { useT } from "@/messages";
import { useAction } from "@/lib/use-action";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Segmented, Select } from "@/components/ui/form";
import { Notice } from "@/components/ui/card";
import { Dialog } from "@/components/ui/overlay";
import { assignProgram, type AssignInput } from "@/app/(app)/programe/actions";
import { ChipToggles } from "./chips";
import { PlayerChecklist } from "./player-checklist";
import type { GroupOption, PlayerOption } from "./types";

type Target = AssignInput["target"];
export type ProgramChoice = { id: string; name: string; kind: string; is_template: boolean };

/**
 * Alocarea unui program. Din pagina programului: programul este fix și se alege ținta.
 * Din fișa jucătorului: jucătorul este fix și se alege programul.
 */
export function AssignDialog({ open, onClose, programs, players, groups, today, fixedPlayer }: {
  open: boolean;
  onClose: () => void;
  /** un singur program = program fix */
  programs: ProgramChoice[];
  players: PlayerOption[];
  groups: GroupOption[];
  today: string;
  fixedPlayer?: PlayerOption;
}) {
  const t = useT().planning.assign;
  const cancel = useT().common.actions.cancel;
  const fixedProgram = programs.length === 1 && !fixedPlayer ? programs[0] : null;
  const [programId, setProgramId] = useState(fixedProgram?.id ?? "");
  const [target, setTarget] = useState<Target>(fixedPlayer ? "player" : "group");
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [position, setPosition] = useState("");
  const [positionGroup, setPositionGroup] = useState("");
  const [one, setOne] = useState<string[]>(fixedPlayer ? [fixedPlayer.id] : []);
  const [many, setMany] = useState<string[]>([]);
  const [weekdays, setWeekdays] = useState<number[]>([1, 3, 5]);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState("");
  const [notes, setNotes] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const assign = useAction(assignProgram, {
    successMessage: t.done,
    onSuccess: () => {
      onClose();
      setMany([]);
      if (!fixedPlayer) setOne([]);
      setNotes("");
    },
  });

  const recipients = useMemo(() => {
    if (target === "group") return players.filter((p) => groupId && p.group_id === groupId).length;
    if (target === "position") return players.filter((p) => position && p.position === position && (!positionGroup || p.group_id === positionGroup)).length;
    if (target === "player") return one.length;
    return many.length;
  }, [target, players, groupId, position, positionGroup, one, many]);

  const submit = () => {
    setProblem(null);
    assign.clearError();
    if (!programId) return setProblem(t.errors.program);
    if (target === "group" && !groupId) return setProblem(t.pickGroup);
    if (target === "position" && !position) return setProblem(t.pickPosition);
    if (!recipients) return setProblem(t.errors.noPlayers);
    if (!weekdays.length) return setProblem(t.errors.noDays);
    if (!start) return setProblem(t.errors.start);
    if (end && end < start) return setProblem(t.errors.dates);
    if (end && !scheduledDays({ start_date: start, end_date: end, weekdays }, start, end).length) return setProblem(t.errors.noScheduledDay);
    void assign.run({
      programId,
      target,
      groupId: target === "group" ? groupId : target === "position" ? positionGroup || null : null,
      position: target === "position" ? (position as AssignInput["position"]) : null,
      playerIds: target === "player" ? one : target === "manual" ? many : [],
      start,
      end: end || null,
      weekdays,
      notes,
    });
  };

  const templates = programs.filter((p) => p.is_template);
  const own = programs.filter((p) => !p.is_template);
  const option = (p: ProgramChoice) => <option key={p.id} value={p.id}>{p.name} ({label(PROGRAM_KINDS, p.kind)})</option>;

  return (
    <Dialog open={open} onClose={onClose} wide
      title={fixedPlayer ? t.titleFor(fixedPlayer.name) : t.title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{cancel}</Button>
          <Button pending={assign.pending} onClick={submit} disabled={!programs.length}>{recipients ? t.confirm(recipients) : t.open}</Button>
        </>
      }>
      <div className="space-y-4">
        {fixedProgram ? (
          <p className="font-bold">{fixedProgram.name}</p>
        ) : programs.length ? (
          <Field label={t.program}>
            <Select value={programId} onChange={(e) => setProgramId(e.target.value)}>
              <option value="">{t.pickProgram}</option>
              {templates.length ? <optgroup label={t.templates}>{templates.map(option)}</optgroup> : null}
              {own.length ? <optgroup label={t.ownPrograms}>{own.map(option)}</optgroup> : null}
            </Select>
          </Field>
        ) : (
          <Notice tone="yellow">{t.noPrograms}</Notice>
        )}

        {!fixedPlayer ? (
          <fieldset className="space-y-3">
            <legend className="mb-1 text-sm font-semibold text-ink-2">{t.target}</legend>
            <Segmented<Target>
              label={t.target}
              value={target}
              onChange={setTarget}
              options={(["group", "position", "player", "manual"] as const).map((k) => ({ value: k, label: t.targets[k] }))}
            />
            {target === "group" ? (
              <Select aria-label={t.group} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                <option value="">{t.pickGroup}</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </Select>
            ) : null}
            {target === "position" ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <Select aria-label={t.position} value={position} onChange={(e) => setPosition(e.target.value)}>
                  <option value="">{t.pickPosition}</option>
                  {Object.entries(POSITIONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </Select>
                <Select aria-label={t.positionGroup} value={positionGroup} onChange={(e) => setPositionGroup(e.target.value)}>
                  <option value="">{t.anyGroup}</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </Select>
              </div>
            ) : null}
            {target === "player" ? <PlayerChecklist single players={players} groups={groups} value={one} onChange={setOne} /> : null}
            {target === "manual" ? <PlayerChecklist players={players} groups={groups} value={many} onChange={setMany} /> : null}
          </fieldset>
        ) : null}

        <fieldset>
          <legend className="mb-1 text-sm font-semibold text-ink-2">{t.weekdays}</legend>
          <ChipToggles
            compact
            label={t.weekdays}
            value={weekdays}
            onChange={setWeekdays}
            options={WEEKDAYS_SHORT_RO.map((d, i) => ({ value: i + 1, label: d, title: WEEKDAYS_RO[i] }))}
          />
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t.start}>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
          </Field>
          <Field label={t.end} optional>
            <Input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <Field label={t.notes} optional>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder={t.notesPlaceholder} autoComplete="off" />
        </Field>

        <Notice tone={recipients ? "blue" : "gray"}>
          <p className="font-semibold text-ink" aria-live="polite">{t.summary(recipients)}</p>
        </Notice>
        <FormError>{problem ?? assign.error}</FormError>
      </div>
    </Dialog>
  );
}
