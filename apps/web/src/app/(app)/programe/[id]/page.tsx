import { notFound } from "next/navigation";
import { z } from "zod";
import { PROGRAM_KINDS, label } from "@club/shared";
import { requireRole, visibleGroups } from "@/lib/auth";
import { getT } from "@/messages";
import { PageHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/status";
import { assignmentAdherence, assignmentState } from "@/components/planning/adherence";
import { scheduleLabels, targetLabel } from "@/components/planning/assignment-view";
import { BackLink } from "@/components/planning/back-link";
import { stamp } from "@/components/planning/format";
import { ProgramAssignments, type AssignmentView } from "@/components/planning/program-assignments";
import { ProgramEditor } from "@/components/planning/program-editor";
import { ProgramManage } from "@/components/planning/program-manage";
import {
  getProgram, listAssignments, listCompletionsForAssignments, listExerciseOptions, listPlayersWithNames,
} from "@/components/planning/queries";

export const metadata = { title: "Program" };

/** Pagina unui program: editorul de exerciții, alocările și administrarea. */
export default async function ProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, ctx } = await requireRole("physio");
  if (!z.uuid().safeParse(id).success) notFound();
  const program = await getProgram(db, id);
  if (!program) notFound();
  const all = getT().planning;
  const t = all.programs;

  const [exercises, assignments, players] = await Promise.all([listExerciseOptions(db), listAssignments(db, id), listPlayersWithNames(db)]);
  const completions = await listCompletionsForAssignments(db, assignments.map((a) => a.id));
  const groups = visibleGroups(ctx).map((g) => ({ id: g.id, name: g.name }));
  const groupNames = new Map(ctx.groups.map((g) => [g.id, g.name]));
  const exerciseIds = program.items.map((i) => i.id);

  const order = { active: 0, upcoming: 1, ended: 2, stopped: 3 } as const;
  const views: AssignmentView[] = assignments.map((a) => ({
    id: a.id,
    target: targetLabel(a, players.names, groupNames, all.assignments),
    ...scheduleLabels(a, all.assignments),
    players: a.playerIds.length,
    state: assignmentState(a, ctx.today),
    notes: a.notes,
    percent: assignmentAdherence(a, exerciseIds, completions, ctx.today).percent,
  })).sort((x, y) => order[x.state] - order[y.state]);

  const { items, ...details } = program;
  return (
    <>
      <PageHeader
        title={program.name}
        back={<BackLink href="/programe">{t.back}</BackLink>}
        description={
          <span className="flex flex-wrap gap-1.5">
            <Badge tone="outline">{label(PROGRAM_KINDS, program.kind)}</Badge>
            {program.is_template ? <Badge tone="gray">{t.template}</Badge> : null}
            {!program.is_active ? <Badge tone="gray">{t.archived}</Badge> : null}
          </span>
        }
        action={<LinkButton href="#alocari" className="lg:hidden">{all.assignments.title} ({assignments.length})</LinkButton>}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
        <ProgramEditor key={stamp(program)} program={details} items={items} exercises={exercises} />
        <div className="space-y-4">
          <ProgramAssignments
            program={{ id: program.id, name: program.name, kind: program.kind, is_template: program.is_template }}
            canAssign={items.length > 0}
            assignments={views}
            players={players.options}
            groups={groups}
            today={ctx.today}
          />
          <ProgramManage id={program.id} isActive={program.is_active} hasAssignments={assignments.length > 0} />
        </div>
      </div>
    </>
  );
}
