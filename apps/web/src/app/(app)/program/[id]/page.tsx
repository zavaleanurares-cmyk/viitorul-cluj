import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ClipboardCheck, Trophy } from "lucide-react";
import {
  ABSENCE_REASON_LABELS, ATTENDANCE_LABELS, EVENT_KIND_LABELS, WEEKDAYS_RO, can, formatDateShort, formatEventWhen, localDate,
  type AbsenceReason, type AttendanceStatus, type EventKind,
} from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/status";
import { DataList } from "@/components/ui/misc";
import { KIND_ICONS } from "@/components/schedule/calendar";
import { EventActions } from "@/components/schedule/event-actions";
import { eventRoster, getEvent, coachManages } from "@/components/schedule/queries";
import { getT } from "@/messages";

export const metadata = { title: "Eveniment" };

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, ctx } = await requireCapability("viewSchedule");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const e = await getEvent(db, id);
  if (!e) notFound();
  const t = getT().schedule;
  const tz = ctx.settings.timezone;
  const office = can(ctx.role, "manageSchedule");
  const runs = office || (ctx.role === "coach" && e.groupIds.some((g) => ctx.staffGroupIds.includes(g)));
  const teams = ctx.groups.filter((g) => e.groupIds.includes(g.id));
  const Icon = KIND_ICONS[e.kind];
  const cancelled = e.status === "cancelled";
  const started = localDate(e.starts_at, tz) <= ctx.today;
  const roster = e.kind === "training" || e.kind === "match" ? await eventRoster(db, id, e.groupIds) : [];
  const recorded = roster.filter((p) => p.attendance);
  const present = recorded.filter((p) => p.attendance!.status === "present" || p.attendance!.status === "late").length;
  const absent = recorded.filter((p) => p.attendance!.status === "absent" || p.attendance!.status === "injured");
  let seriesText: string | null = null;
  if (e.series_id) {
    const { data: s } = await db.from("event_series").select("weekdays, until").eq("id", e.series_id).maybeSingle();
    if (s) seriesText = t.event.seriesText(s.weekdays.map((d) => WEEKDAYS_RO[d - 1]).join(", "), formatDateShort(s.until));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <Link href={`/program?zi=${localDate(e.starts_at, tz)}`} className="mb-1 inline-flex h-10 items-center gap-1 text-sm font-semibold text-ink-2 hover:text-ink">
          <ChevronLeft className="size-4" aria-hidden /> {t.event.back}
        </Link>
        <p className="flex items-center gap-2 font-semibold text-ink-2">
          {Icon ? <Icon className="size-5" aria-hidden /> : null}
          {EVENT_KIND_LABELS[e.kind as EventKind]}
          {e.match?.competition ? <span className="text-ink-3">· {e.match.competition}{e.match.round ? ` · ${t.event.round(e.match.round)}` : ""}</span> : null}
        </p>
        <h1 className={cancelled ? "text-2xl text-ink-3 line-through md:text-3xl" : "text-2xl md:text-3xl"}>
          {e.match ? `${e.match.is_home ? "" : "@ "}${e.match.opponent ?? e.title}` : e.title}
        </h1>
        <div className="mt-2 flex flex-wrap gap-2">
          {cancelled ? <Badge tone="gray">{t.cancelled}</Badge> : null}
          {e.match ? <Badge tone={e.match.is_home ? "blue" : "outline"}>{e.match.is_home ? t.event.home : t.event.away}</Badge> : null}
        </div>
      </header>

      {e.match && e.match.status !== "scheduled" ? (
        <Card>
          <CardBody className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-ink-3">{e.match.status === "finished" ? t.event.finished : t.event.live}</p>
              <p className="text-4xl font-bold tabular-nums">{t.event.score(e.match.goals_for, e.match.goals_against)}</p>
            </div>
            <LinkButton href={`/program/${id}/meci`} variant={runs && e.match.status === "live" ? "primary" : "secondary"} icon={<Trophy className="size-5" aria-hidden />}>{t.event.openMatch}</LinkButton>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardBody>
          <DataList items={[
            { label: t.event.when, value: formatEventWhen(e.starts_at, e.ends_at, tz) },
            { label: t.event.where, value: e.venue?.name ?? e.notes?.split("\n")[0] ?? "—" },
            { label: t.event.teams, value: teams.map((g) => g.name).join(", ") || "—" },
            ...(seriesText ? [{ label: t.event.series, value: seriesText }] : []),
            ...(e.notes && e.venue ? [{ label: t.event.notes, value: e.notes }] : []),
          ]} />
        </CardBody>
      </Card>

      {runs && !cancelled ? (
        <div className="flex flex-wrap gap-2">
          {e.kind === "training" && started ? (
            <LinkButton href={`/program/${id}/prezenta`} variant="primary" size="lg" icon={<ClipboardCheck className="size-5" aria-hidden />}>
              {e.attendance_saved_at ? t.event.editAttendance : t.event.takeAttendance}
            </LinkButton>
          ) : null}
          {e.kind === "match" && (!e.match || e.match.status === "scheduled") ? (
            <LinkButton href={`/program/${id}/meci`} variant="primary" size="lg" icon={<Trophy className="size-5" aria-hidden />}>{t.event.openMatch}</LinkButton>
          ) : null}
        </div>
      ) : null}

      {e.kind === "training" && recorded.length ? (
        <Card>
          <CardHeader title={t.event.attendance} description={t.event.attendanceSummary(present, roster.length)} />
          <CardBody>
            {absent.length === 0 ? <p className="text-ink-3">{t.attendance.noAbsentees}</p> : (
              <ul className="divide-y divide-line">
                {absent.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3 py-2">
                    <Link href={`/lot/jucatori/${p.id}`} className="font-semibold hover:underline">{p.full_name}</Link>
                    <span className="text-ink-2">{p.attendance!.reason ? ABSENCE_REASON_LABELS[p.attendance!.reason as AbsenceReason] : ATTENDANCE_LABELS[p.attendance!.status as AttendanceStatus]}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      ) : null}

      {office || (runs && coachManages(e)) ? <EventActions id={id} cancelled={cancelled} inSeries={!!e.series_id} canEdit /> : null}
    </div>
  );
}
