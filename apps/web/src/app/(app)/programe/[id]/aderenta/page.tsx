import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { MessageSquare } from "lucide-react";
import { formatDate, formatDateShort } from "@club/shared";
import { requireRole } from "@/lib/auth";
import { getT } from "@/messages";
import { EmptyState, Notice, PageHeader, Stat } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/status";
import { assignmentAdherence, assignmentState, type AdherenceNote, type PlayerAdherence } from "@/components/planning/adherence";
import { scheduleLabels, targetLabel } from "@/components/planning/assignment-view";
import { BackLink } from "@/components/planning/back-link";
import { DayStateMark, DayStrip, PainFlag } from "@/components/planning/day-strip";
import { NavSelect } from "@/components/planning/nav-select";
import { getProgram, listAssignmentCompletions, listAssignments, listPlayersWithNames } from "@/components/planning/queries";

export const metadata = { title: "Aderență" };

type Search = { alocare?: string; ordine?: string };
type Order = "crescator" | "descrescator" | "nume";
const NOTES_SHOWN = 4;

/** Aderența jucătorilor la o alocare a programului. */
export default async function AdherencePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { db, ctx } = await requireRole("physio");
  if (!z.uuid().safeParse(id).success) notFound();
  const program = await getProgram(db, id);
  if (!program) notFound();
  const all = getT().planning;
  const t = all.adherence;

  const [assignments, players] = await Promise.all([listAssignments(db, id), listPlayersWithNames(db)]);
  const header = (
    <PageHeader title={`${t.title}: ${program.name}`} back={<BackLink href={`/programe/${id}`}>{t.back}</BackLink>} />
  );
  if (!assignments.length) {
    return (
      <>
        {header}
        <EmptyState title={t.none} description={all.assignments.emptyHint} action={<LinkButton href={`/programe/${id}#alocari`}>{t.back}</LinkButton>} />
      </>
    );
  }

  const groupNames = new Map(ctx.groups.map((g) => [g.id, g.name]));
  const assignment = assignments.find((a) => a.id === sp.alocare) ?? assignments.find((a) => assignmentState(a, ctx.today) === "active") ?? assignments[0];
  const order: Order = sp.ordine === "descrescator" || sp.ordine === "nume" ? sp.ordine : "crescator";
  const href = (alocare: string, ordine: Order = order) => {
    const q = new URLSearchParams({ alocare });
    if (ordine !== "crescator") q.set("ordine", ordine);
    return `/programe/${id}/aderenta?${q}`;
  };

  const exerciseIds = program.items.map((i) => i.id);
  const exerciseNames = new Map<string, string>();
  if (program.items.length) {
    const { data } = await db.from("exercises").select("id, name").in("id", [...new Set(program.items.map((i) => i.exercise_id))]);
    const byId = new Map((data ?? []).map((e) => [e.id, e.name]));
    for (const i of program.items) exerciseNames.set(i.id, byId.get(i.exercise_id) ?? all.items.missingExercise);
  }
  const completions = await listAssignmentCompletions(db, assignment.id);
  const result = assignmentAdherence(assignment, exerciseIds, completions, ctx.today);
  const state = assignmentState(assignment, ctx.today);
  const labels = scheduleLabels(assignment, all.assignments);

  const name = (playerId: string) => players.names.get(playerId) ?? all.assignments.target.unknownPlayer;
  const rows = assignment.playerIds
    .map((playerId) => ({ playerId, name: name(playerId), a: result.byPlayer.get(playerId) as PlayerAdherence }))
    .sort((x, y) => {
      const byName = x.name.localeCompare(y.name, "ro");
      if (order === "nume") return byName;
      const dx = x.a.percent ?? -1;
      const dy = y.a.percent ?? -1;
      return (order === "crescator" ? dx - dy : dy - dx) || byName;
    });
  const missed = rows.filter((r) => r.a.last === "none").sort((x, y) => x.name.localeCompare(y.name, "ro"));
  const partial = rows.filter((r) => r.a.last === "partial").sort((x, y) => x.name.localeCompare(y.name, "ro"));
  const fullCount = rows.filter((r) => r.a.last === "full").length;

  return (
    <>
      {header}
      <div className="mb-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_16rem]">
        <NavSelect
          label={t.pick}
          value={assignment.id}
          options={assignments.map((a) => {
            const l = scheduleLabels(a, all.assignments);
            return {
              value: a.id,
              href: href(a.id),
              label: `${targetLabel(a, players.names, groupNames, all.assignments)} · ${l.days} · ${l.period} · ${all.assignments.states[assignmentState(a, ctx.today)]}`,
            };
          })}
        />
        <NavSelect
          label={t.sort}
          value={order}
          options={[
            { value: "crescator", label: t.sortLow, href: href(assignment.id, "crescator") },
            { value: "descrescator", label: t.sortHigh, href: href(assignment.id, "descrescator") },
            { value: "nume", label: t.sortName, href: href(assignment.id, "nume") },
          ]}
        />
      </div>

      {!exerciseIds.length ? (
        <Notice tone="yellow">{t.noExercises}</Notice>
      ) : !result.days ? (
        <Notice tone="blue" title={t.notStarted}>
          {labels.days} · {labels.period} · {all.assignments.players(assignment.playerIds.length)}
        </Notice>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label={t.average} value={result.percent === null ? "—" : `${result.percent}%`} hint={`${labels.days} · ${labels.period}`} />
            <Stat label={t.stateLabel} value={all.assignments.states[state]} hint={`${all.assignments.players(rows.length)} · ${t.scheduledDays(result.days)}`} />
            <Stat label={t.lastDayShort} value={result.lastDate ? formatDateShort(result.lastDate, false) : "—"}
              hint={result.lastDate ? t.lastDayCounts(fullCount, partial.length, missed.length) : undefined}
              tone={missed.length ? "red" : partial.length ? "yellow" : "green"} />
            <Stat label={t.exercisesLabel} value={exerciseIds.length} hint={t.perDay} />
          </div>

          <Notice tone={missed.length ? "red" : "green"} className="mb-4"
            title={result.lastDate ? `${missed.length ? t.missedTitle : t.missedNone} (${formatDate(result.lastDate, { weekday: true, year: false })})` : undefined}>
            {missed.length ? <PlayerLinks rows={missed} /> : null}
            {partial.length ? (
              <p className={missed.length ? "mt-2" : undefined}>
                <span className="font-semibold text-ink">{t.partialTitle}: </span>
                <PlayerLinks rows={partial} inline />
              </p>
            ) : null}
          </Notice>

          <ul className="overflow-hidden rounded-[var(--radius-card)] border border-line/70 bg-surface shadow-[var(--shadow-card)]">
            <li className="hidden grid-cols-[minmax(0,12rem)_10rem_18rem_minmax(0,1fr)] gap-4 border-b border-line bg-canvas px-4 py-2 text-sm font-semibold text-ink-3 md:grid" aria-hidden>
              <span>{t.player}</span><span>{t.percent}</span><span>{t.lastDays}</span><span>{t.notes}</span>
            </li>
            {rows.map((r) => (
              <li key={r.playerId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,12rem)_10rem_18rem_minmax(0,1fr)] md:items-start">
                <Link href={`/lot/jucatori/${r.playerId}/plan`} className="inline-flex min-h-10 items-center truncate font-bold underline-offset-2 hover:underline md:min-h-0">{r.name}</Link>
                <div>
                  <p className="flex items-baseline justify-end gap-2 md:justify-start">
                    <span className="text-xl font-bold leading-none">{r.a.percent === null ? "—" : `${r.a.percent}%`}</span>
                    <span className="text-sm text-ink-3">{r.a.expected ? t.done(Math.min(r.a.done, r.a.expected), r.a.expected) : t.noData}</span>
                  </p>
                  {r.a.expected ? <ProgressBar className="mt-1.5 hidden max-w-40 md:block" value={Math.min(r.a.done, r.a.expected)} max={r.a.expected} label={`${t.percent}: ${r.name}`} /> : null}
                </div>
                <div className="col-span-2 md:col-span-1">
                  <DayStrip days={r.a.days} total={exerciseIds.length} labels={t.dayStates} empty={t.noData} />
                </div>
                <NotesList notes={r.a.notes} exerciseNames={exerciseNames} />
              </li>
            ))}
          </ul>

          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
            <span className="font-semibold">{t.legend}:</span>
            {(["full", "partial", "none"] as const).map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5"><DayStateMark state={s} title={t.dayStates[s]} />{t.dayStates[s]}</span>
            ))}
          </p>
        </>
      )}
    </>
  );
}

function PlayerLinks({ rows, inline }: { rows: Array<{ playerId: string; name: string }>; inline?: boolean }) {
  const links = rows.map((r, i) => (
    <span key={r.playerId}>
      <Link href={`/lot/jucatori/${r.playerId}/plan`} className="font-semibold text-ink underline underline-offset-2">{r.name}</Link>
      {i < rows.length - 1 ? ", " : ""}
    </span>
  ));
  return inline ? <>{links}</> : <p>{links}</p>;
}

function NotesList({ notes, exerciseNames }: { notes: AdherenceNote[]; exerciseNames: Map<string, string> }) {
  const t = getT().planning.adherence;
  if (!notes.length) return <p className="hidden text-ink-3 md:block">{t.noNotes}</p>;

  const shown = notes.slice(0, NOTES_SHOWN);
  const rest = notes.slice(NOTES_SHOWN);
  const item = (n: AdherenceNote, i: number) => (
    <li key={i} className="text-sm">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge tone="outline">{formatDateShort(n.date, false)}</Badge>
        <span className="font-semibold">{(n.program_exercise_id && exerciseNames.get(n.program_exercise_id)) || getT().planning.items.missingExercise}</span>
        {n.pain ? <PainFlag text={t.pain(n.pain_intensity)} /> : null}
      </span>
      {n.comment ? (
        <span className="mt-0.5 flex gap-1.5 text-ink-2"><MessageSquare className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden /><span>„{n.comment}”</span></span>
      ) : null}
    </li>
  );
  return (
    <div className="col-span-2 md:col-span-1">
      <ul className="space-y-2">{shown.map(item)}</ul>
      {rest.length ? (
        <details className="mt-1">
          <summary className="inline-flex h-10 cursor-pointer items-center text-sm font-semibold text-ink-2 underline underline-offset-2">{t.moreNotes(rest.length)}</summary>
          <ul className="mt-1 space-y-2">{rest.map(item)}</ul>
        </details>
      ) : null}
    </div>
  );
}
