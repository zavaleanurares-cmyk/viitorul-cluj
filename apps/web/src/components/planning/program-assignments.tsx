"use client";
import { useState } from "react";
import Link from "next/link";
import { BarChart3, CalendarDays, Plus, Users } from "lucide-react";
import { useT } from "@/messages";
import { useAction } from "@/lib/use-action";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/status";
import { Dialog } from "@/components/ui/overlay";
import { deleteAssignment, stopAssignment } from "@/app/(app)/programe/actions";
import { AssignDialog, type ProgramChoice } from "./assign-dialog";
import type { GroupOption, PlayerOption } from "./types";

export type AssignmentView = {
  id: string;
  target: string;
  period: string;
  days: string;
  players: number;
  state: "active" | "upcoming" | "ended" | "stopped";
  notes: string | null;
  /** aderența medie, dacă există zile programate până azi */
  percent: number | null;
};

const STATE_TONE = { active: "green", upcoming: "blue", ended: "gray", stopped: "gray" } as const;

/** Alocările unui program: listă, alocare nouă, oprire, ștergere. */
export function ProgramAssignments({ program, canAssign, assignments, players, groups, today }: {
  program: ProgramChoice;
  /** programul are cel puțin un exercițiu salvat */
  canAssign: boolean;
  assignments: AssignmentView[];
  players: PlayerOption[];
  groups: GroupOption[];
  today: string;
}) {
  const all = useT();
  const t = all.planning.assignments;
  const [assigning, setAssigning] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "stop" | "delete"; id: string } | null>(null);
  const stop = useAction(stopAssignment, { successMessage: t.stopped, onSuccess: () => setConfirm(null) });
  const remove = useAction(deleteAssignment, { successMessage: t.deleted, onSuccess: () => setConfirm(null) });

  return (
    <Card id="alocari" className="scroll-mt-4">
      <CardHeader
        title={<>{t.title} <span className="font-normal text-ink-3">({assignments.length})</span></>}
        action={
          <Button size="sm" variant="secondary" disabled={!canAssign} icon={<Plus className="size-4" aria-hidden />} onClick={() => setAssigning(true)}>
            {all.planning.assign.open}
          </Button>
        }
      />
      <CardBody>
        {assignments.length ? (
          <ul className="-my-3 divide-y divide-line">
            {assignments.map((a) => (
              <li key={a.id} className="py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 font-bold leading-snug">{a.target}</p>
                  <Badge tone={STATE_TONE[a.state]}>{t.states[a.state]}</Badge>
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
                  <span className="inline-flex items-center gap-1"><CalendarDays className="size-4 text-ink-3" aria-hidden />{a.days} · {a.period}</span>
                  <span className="inline-flex items-center gap-1"><Users className="size-4 text-ink-3" aria-hidden />{t.players(a.players)}</span>
                </p>
                {a.notes ? <p className="mt-1 text-sm text-ink-3">„{a.notes}”</p> : null}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Link href={`/programe/${program.id}/aderenta?alocare=${a.id}`} className={buttonClass("secondary", "md")}>
                    <BarChart3 className="size-4" aria-hidden />
                    {t.adherence}{a.percent !== null ? `: ${a.percent}%` : ""}
                  </Link>
                  {a.state === "active" || a.state === "upcoming" ? (
                    <Button variant="ghost" onClick={() => setConfirm({ kind: "stop", id: a.id })}>{t.stop}</Button>
                  ) : null}
                  <Button variant="ghost" onClick={() => setConfirm({ kind: "delete", id: a.id })}>{t.delete}</Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-ink-3">
            <p>{t.empty}</p>
            <p className="mt-1 text-sm">{canAssign ? t.emptyHint : t.emptyNoExercises}</p>
          </div>
        )}
      </CardBody>

      <AssignDialog open={assigning} onClose={() => setAssigning(false)} programs={[program]} players={players} groups={groups} today={today} />

      <Dialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm?.kind === "delete" ? t.deleteTitle : t.stopTitle}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(null)}>{all.common.actions.cancel}</Button>
            {confirm?.kind === "delete" ? (
              <Button variant="danger" pending={remove.pending} onClick={() => remove.run({ id: confirm.id })}>{t.delete}</Button>
            ) : (
              <Button pending={stop.pending} onClick={() => confirm && stop.run({ id: confirm.id })}>{t.stop}</Button>
            )}
          </>
        }>
        <p>{confirm?.kind === "delete" ? `${t.deleteConfirm} ${all.common.confirmDelete}` : t.stopConfirm}</p>
      </Dialog>
    </Card>
  );
}
