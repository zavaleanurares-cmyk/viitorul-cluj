import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BarChart3, ChevronRight, Plus } from "lucide-react";
import {
  PROGRAM_KINDS, WEEKDAYS_RO, addDays, formatDate, formatDateShort, getPlayer, isScheduledOn, label, weekDates, weekStart,
} from "@club/shared";
import { requireRole, visibleGroups } from "@/lib/auth";
import { getT } from "@/messages";
import { cn } from "@/lib/cn";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PrevNext, ProgressBar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/status";
import { assignmentState, dayState, playerAdherence } from "@/components/planning/adherence";
import { scheduleLabels } from "@/components/planning/assignment-view";
import { AssignProgramButton } from "@/components/planning/assign-button";
import { DayStateMark, DayStrip, PainFlag } from "@/components/planning/day-strip";
import {
  getPlanCells, listPlayerAssignments, listPlayerProgramCompletions, listProgramSummaries,
} from "@/components/planning/queries";

const STATE_TONE = { active: "green", upcoming: "blue", ended: "gray", stopped: "gray" } as const;

/** Fila „Plan și programe" din fișa jucătorului (doar preparatorul). */
export default async function PlayerPlanPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ saptamana?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { db, ctx } = await requireRole("physio");
  if (!z.uuid().safeParse(id).success) notFound();
  const player = await getPlayer(db, id);
  if (!player) notFound();
  const all = getT().planning;
  const t = all.playerTab;

  const monday = weekStart(sp.saptamana && z.iso.date().safeParse(sp.saptamana).success ? sp.saptamana : ctx.today);
  const days = weekDates(monday);
  const [cells, assignments, completions, programs] = await Promise.all([
    getPlanCells(db, [id], days[0], days[6]),
    listPlayerAssignments(db, id),
    listPlayerProgramCompletions(db, id),
    listProgramSummaries(db, ctx.today),
  ]);

  const base = `/lot/jucatori/${id}/plan`;
  const weekHref = (m: string) => (m === weekStart(ctx.today) ? base : `${base}?saptamana=${m}`);
  const order = { active: 0, upcoming: 1, ended: 2, stopped: 3 } as const;
  const rows = assignments
    .map((a) => ({
      a,
      state: assignmentState(a, ctx.today),
      adherence: playerAdherence(a, a.program.exerciseIds, completions.filter((c) => c.assignment_id === a.id), ctx.today, 8),
      labels: scheduleLabels({ ...a, playerIds: [] }, all.assignments),
    }))
    .sort((x, y) => order[x.state] - order[y.state] || (x.a.start_date < y.a.start_date ? 1 : -1));

  /** câte exerciții ale alocării a bifat jucătorul într-o zi */
  const doneOn = (assignmentId: string, exerciseIds: string[], day: string) =>
    new Set(completions.filter((c) => c.assignment_id === assignmentId && c.done_on === day && c.done && c.program_exercise_id && exerciseIds.includes(c.program_exercise_id))
      .map((c) => c.program_exercise_id)).size;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title={t.week} />
        <CardBody className="space-y-3">
          <PrevNext
            prevHref={weekHref(addDays(monday, -7))}
            nextHref={weekHref(addDays(monday, 7))}
            todayHref={days.includes(ctx.today) ? undefined : weekHref(weekStart(ctx.today))}
            label={all.plans.weekLabel(formatDateShort(days[0], false), formatDateShort(days[6]))}
          />
          <ul className="divide-y divide-line border-y border-line">
            {days.map((d, i) => {
              const cell = cells.get(`${id}:${d}`);
              const scheduled = rows.filter((r) => r.a.is_active && isScheduledOn(r.a, d));
              const isToday = d === ctx.today;
              return (
                <li key={d} className={cn("grid gap-x-3 gap-y-1 py-2 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:items-start", isToday && "-mx-4 bg-canvas px-4")}>
                  <p className="flex items-baseline gap-2 sm:flex-col sm:gap-0 sm:pt-3">
                    <span className="font-bold first-letter:uppercase">{WEEKDAYS_RO[i]}</span>
                    <span className="text-sm text-ink-3">{formatDate(d, { year: false })}{isToday ? ` · ${t.today}` : ""}</span>
                  </p>
                  <div className="min-w-0 space-y-1">
                    <Link href={`/planuri/${id}/${d}`}
                      className={cn(
                        "flex min-h-12 items-center gap-2 rounded-[var(--radius-control)] border px-3 py-1.5",
                        cell ? "border-transparent bg-sunken hover:bg-line" : "border-dashed border-line-strong text-ink-2 hover:bg-sunken",
                      )}>
                      {cell ? (
                        <>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{t.plan}{cell.title ? `: ${cell.title}` : ""}</span>
                            {cell.pain ? <PainFlag text={all.plans.pain} className="mt-0.5" /> : null}
                          </span>
                          {cell.total ? (
                            <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-bold" title={t.doneTitle(cell.done, cell.total)}>
                              {d <= ctx.today ? <DayStateMark state={dayState(cell.done, cell.total)} title={all.adherence.dayStates[dayState(cell.done, cell.total)]} /> : null}
                              {t.done(cell.done, cell.total)}
                            </span>
                          ) : <span className="shrink-0 text-sm text-ink-3">{all.plans.noItems}</span>}
                          <ChevronRight className="size-5 shrink-0 text-ink-3" aria-hidden />
                        </>
                      ) : (
                        <><Plus className="size-5 shrink-0" aria-hidden /><span className="font-semibold">{t.addPlan}</span></>
                      )}
                    </Link>
                    {scheduled.map((r) => {
                      const total = r.a.program.exerciseIds.length;
                      const n = doneOn(r.a.id, r.a.program.exerciseIds, d);
                      return (
                        <p key={r.a.id} className="flex min-h-9 items-center gap-2 px-3 text-sm">
                          <span className="min-w-0 flex-1 truncate"><span className="text-ink-3">{t.program}: </span>{r.a.program.name}</span>
                          {total ? (
                            <span className="inline-flex shrink-0 items-center gap-1.5 font-bold" title={t.doneTitle(n, total)}>
                              {d <= ctx.today ? <DayStateMark state={dayState(n, total)} title={all.adherence.dayStates[dayState(n, total)]} /> : null}
                              {t.done(n, total)}
                            </span>
                          ) : null}
                        </p>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t.programsTitle}
          action={
            <AssignProgramButton
              player={{ id, name: player.display_name, group_id: player.group_id, position: player.position }}
              programs={programs.filter((p) => p.is_active && p.exerciseCount > 0).map((p) => ({ id: p.id, name: p.name, kind: p.kind, is_template: p.is_template }))}
              groups={visibleGroups(ctx).map((g) => ({ id: g.id, name: g.name }))}
              today={ctx.today}
            />
          }
        />
        <CardBody>
          {rows.length ? (
            <ul className="-my-3 divide-y divide-line">
              {rows.map(({ a, state, adherence, labels }) => (
                <li key={a.id} className="grid gap-x-4 gap-y-2 py-3 md:grid-cols-[minmax(0,1fr)_9rem_18rem] md:items-center">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Link href={`/programe/${a.program.id}`} className="font-bold underline-offset-2 hover:underline">{a.program.name}</Link>
                      <Badge tone={STATE_TONE[state]}>{all.assignments.states[state]}</Badge>
                    </p>
                    <p className="mt-0.5 text-sm text-ink-3">
                      {label(PROGRAM_KINDS, a.program.kind)} · {labels.days} · {labels.period} · {all.assignments.via[a.target_type as keyof typeof all.assignments.via] ?? ""}
                    </p>
                    {a.notes ? <p className="mt-0.5 text-sm text-ink-2">„{a.notes}”</p> : null}
                  </div>
                  <div>
                    <p className="flex items-baseline gap-2">
                      <span className="text-xl font-bold leading-none">{adherence.percent === null ? "—" : `${adherence.percent}%`}</span>
                      <span className="text-sm text-ink-3">{adherence.expected ? all.adherence.done(Math.min(adherence.done, adherence.expected), adherence.expected) : t.noDays}</span>
                    </p>
                    {adherence.expected ? <ProgressBar className="mt-1.5 max-w-36" value={Math.min(adherence.done, adherence.expected)} max={adherence.expected} label={`${t.adherence}: ${a.program.name}`} /> : null}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <DayStrip days={adherence.days} total={a.program.exerciseIds.length} labels={all.adherence.dayStates} empty="" />
                    <Link href={`/programe/${a.program.id}/aderenta?alocare=${a.id}`} aria-label={`${t.adherence}: ${a.program.name}`} title={t.adherence}
                      className="inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-line bg-sunken transition-colors">
                      <BarChart3 className="size-5" aria-hidden />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-3">{t.noPrograms}</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
