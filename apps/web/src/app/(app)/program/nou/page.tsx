import { redirect } from "next/navigation";
import { can, type EventKind } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { PageHeader } from "@/components/ui/card";
import { EventForm } from "@/components/schedule/event-form";
import { listCompetitions, listOpponents, listVenues } from "@/components/schedule/queries";
import { getT } from "@/messages";

export const metadata = { title: "Eveniment nou" };

export default async function NewEventPage({ searchParams }: { searchParams: Promise<{ zi?: string; tip?: string; echipa?: string }> }) {
  const { db, ctx } = await requireCapability("runEvents");
  const sp = await searchParams;
  const t = getT().schedule;
  const office = can(ctx.role, "manageSchedule");
  if (!office && !ctx.staffGroupIds.length) redirect("/program");
  const kinds: EventKind[] = office ? ["training", "match", "booking", "meeting", "other"] : ["training", "match", "meeting"];
  const teams = ctx.groups.filter((g) => g.is_active && (office || ctx.staffGroupIds.includes(g.id))).map((g) => ({ id: g.id, name: g.name }));
  const [venues, competitions, opponents] = await Promise.all([listVenues(db), listCompetitions(db), listOpponents(db)]);
  const date = typeof sp.zi === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.zi) ? sp.zi : ctx.today;
  const kind = kinds.includes(sp.tip as EventKind) ? (sp.tip as EventKind) : "training";
  const preset = typeof sp.echipa === "string" && teams.some((g) => g.id === sp.echipa) ? [sp.echipa] : teams.length === 1 ? [teams[0].id] : [];
  return (
    <>
      <PageHeader title={t.form.newTitle} />
      <EventForm kinds={kinds} teams={teams} venues={venues.filter((v) => v.is_active).map((v) => ({ id: v.id, name: v.name }))}
        competitions={(office ? competitions : []).filter((c) => c.is_active).map((c) => ({ id: c.id, name: c.name, groupId: c.group_id }))}
        opponents={opponents.map((o) => o.name)}
        initial={{ kind, title: "", date, start: "17:30", end: "19:00", venueId: "", groupIds: preset, notes: "", repeat: null, match: null }} />
    </>
  );
}
