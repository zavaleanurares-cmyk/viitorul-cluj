import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ListChecks } from "lucide-react";
import {
  addDays, describeZone, formatDate, formatDateShort, getPlayer, isScheduledOn, relativeDay, weekStart,
} from "@club/shared";
import { requireRole, visibleGroups } from "@/lib/auth";
import { getT } from "@/messages";
import { PageHeader } from "@/components/ui/card";
import { PrevNext } from "@/components/ui/misc";
import { Badge, StatusChip } from "@/components/ui/status";
import { BackLink } from "@/components/planning/back-link";
import { stamp } from "@/components/planning/format";
import { PlanEditor, type InjuryChoice } from "@/components/planning/plan-editor";
import {
  getPlanForEdit, listExerciseOptions, listInjuryOptions, listPlanDates, listPlayerAssignments, listPlayerOptions, listProgramTemplates,
} from "@/components/planning/queries";

export const metadata = { title: "Planul zilei" };

const CALENDAR_WEEKS = 3;

/** Editorul planului unei zile pentru un jucător. */
export default async function PlanEditorPage({ params }: { params: Promise<{ jucator: string; zi: string }> }) {
  const { jucator, zi } = await params;
  const { db, ctx } = await requireRole("physio");
  if (!z.uuid().safeParse(jucator).success || !z.iso.date().safeParse(zi).success) notFound();
  const player = await getPlayer(db, jucator);
  if (!player) notFound();
  const all = getT().planning;
  const t = all.editor;

  const calendarStart = weekStart(zi);
  const calendarEnd = addDays(calendarStart, CALENDAR_WEEKS * 7 - 1);
  const [plan, exercises, templates, players, planDates, yesterday, assignments] = await Promise.all([
    getPlanForEdit(db, jucator, zi),
    listExerciseOptions(db),
    listProgramTemplates(db),
    listPlayerOptions(db),
    listPlanDates(db, calendarStart, calendarEnd),
    db.from("daily_plans").select("id", { count: "exact", head: true }).eq("player_id", jucator).eq("plan_date", addDays(zi, -1)),
    listPlayerAssignments(db, jucator),
  ]);
  const injuryRows = await listInjuryOptions(db, jucator, plan?.injury_id);
  if (injuryRows.length) await db.rpc("log_medical_access", { p_player: jucator, p_section: "medical" });
  const injuries: InjuryChoice[] = injuryRows.map((i) => ({
    id: i.id,
    rtp_stage: i.rtp_stage,
    label: [
      describeZone({ zone: i.zone, side: i.side, detail: i.zone_detail, uncertain: i.zone_uncertain }) || i.diagnosis || "—",
      t.injuryFrom(formatDateShort(i.occurred_on)),
      i.actual_return_on ? t.injuryClosed : null,
    ].filter(Boolean).join(", "),
  }));

  const status = ctx.statuses.find((s) => s.id === player.status_id);
  const group = ctx.groups.find((g) => g.id === player.group_id);
  const scheduled = assignments.filter((a) => a.is_active && isScheduledOn(a, zi));
  const week = weekStart(zi);
  const backHref = `/planuri?${new URLSearchParams({ ...(player.group_id ? { grupa: player.group_id } : {}), saptamana: week })}`;
  const dayHref = (d: string) => `/planuri/${jucator}/${d}`;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t.title(player.display_name)}
        back={<BackLink href={backHref}>{t.back}</BackLink>}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusChip status={status} size="sm" />
            {group ? <span>{group.name}</span> : null}
            {!player.is_active ? <Badge tone="outline">{t.playerInactive}</Badge> : null}
            <Link href={`/jucatori/${jucator}/plan`} className="font-semibold underline underline-offset-2">{t.playerFile}</Link>
          </span>
        }
      />
      <div className="mb-4">
        <PrevNext
          prevHref={dayHref(addDays(zi, -1))}
          nextHref={dayHref(addDays(zi, 1))}
          todayHref={zi === ctx.today ? undefined : dayHref(ctx.today)}
          label={
            <span className="flex flex-col items-center leading-tight">
              <span className="first-letter:uppercase">{formatDate(zi, { weekday: true, year: false })}</span>
              <span className="text-sm font-normal text-ink-3">
                {relativeDay(zi, ctx.today)}{!plan ? ` · ${t.newBadge.toLowerCase()}` : ""}
              </span>
            </span>
          }
        />
      </div>

      {scheduled.length ? (
        <p className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2 text-sm">
          <ListChecks className="size-4 shrink-0 text-ink-3" aria-hidden />
          <span className="font-semibold">{t.alsoScheduled}</span>
          {scheduled.map((a, i) => (
            <span key={a.id}>
              <Link href={`/programe/${a.program.id}`} className="underline underline-offset-2">{a.program.name}</Link>
              {i < scheduled.length - 1 ? "," : ""}
            </span>
          ))}
        </p>
      ) : null}

      <PlanEditor
        key={`${zi}:${stamp(plan)}`}
        playerId={jucator}
        date={zi}
        today={ctx.today}
        backHref={backHref}
        plan={plan ? { id: plan.id, title: plan.title, notes: plan.notes, injury_id: plan.injury_id, rtp_stage: plan.rtp_stage, items: plan.items, completions: plan.completions } : null}
        exercises={exercises}
        templates={templates}
        injuries={injuries}
        hasYesterday={(yesterday.count ?? 0) > 0}
        players={players}
        groups={visibleGroups(ctx).map((g) => ({ id: g.id, name: g.name }))}
        calendarStart={calendarStart}
        planDates={planDates}
      />
    </div>
  );
}
