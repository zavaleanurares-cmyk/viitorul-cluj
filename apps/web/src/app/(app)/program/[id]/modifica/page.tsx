import { notFound, redirect } from "next/navigation";
import { can, localDate, localTime, type EventKind } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { PageHeader } from "@/components/ui/card";
import { EventForm } from "@/components/schedule/event-form";
import { coachManages, getEvent, listCompetitions, listOpponents, listVenues } from "@/components/schedule/queries";
import { getT } from "@/messages";

export const metadata = { title: "Modifică evenimentul" };

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, ctx } = await requireCapability("runEvents");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const e = await getEvent(db, id);
  if (!e) notFound();
  const office = can(ctx.role, "manageSchedule");
  if (!office && (!coachManages(e) || !e.groupIds.every((g) => ctx.staffGroupIds.includes(g)))) redirect(`/program/${id}`);
  const t = getT().schedule;
  const tz = ctx.settings.timezone;
  const teams = ctx.groups.filter((g) => (g.is_active || e.groupIds.includes(g.id)) && (office || ctx.staffGroupIds.includes(g.id))).map((g) => ({ id: g.id, name: g.name }));
  const [venues, competitions, opponents] = await Promise.all([listVenues(db), listCompetitions(db), listOpponents(db)]);
  return (
    <>
      <PageHeader title={t.form.editTitle} />
      <EventForm kinds={[e.kind as EventKind]} teams={teams} venues={venues.map((v) => ({ id: v.id, name: v.name }))}
        competitions={(office ? competitions : []).map((c) => ({ id: c.id, name: c.name, groupId: c.group_id }))}
        opponents={opponents.map((o) => o.name)}
        initial={{
          id: e.id, kind: e.kind as EventKind, title: e.match ? "" : e.title, date: localDate(e.starts_at, tz), start: localTime(e.starts_at, tz),
          end: localTime(e.ends_at, tz), venueId: e.venue?.id ?? "", groupIds: e.groupIds, notes: e.notes ?? "", repeat: null,
          match: e.match ? { opponentName: e.match.opponent ?? e.title, competitionId: e.match.competition_id ?? "", round: e.match.round ?? "", isHome: e.match.is_home } : null,
        }} />
    </>
  );
}
