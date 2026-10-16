import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { can, formatEventWhen, localDate } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { Notice, PageHeader } from "@/components/ui/card";
import { TrainingRatings } from "@/components/schedule/training-ratings";
import { eventRoster, getEvent } from "@/components/schedule/queries";
import { getT } from "@/messages";

export const metadata = { title: "Notele antrenamentului" };

/** Notele jucătorilor la un antrenament: le dă cine conduce antrenamentul, după ce a început. */
export default async function TrainingRatingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, ctx } = await requireCapability("runEvents");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const e = await getEvent(db, id);
  if (!e || e.kind !== "training") notFound();
  const runs = can(ctx.role, "manageSchedule") || e.groupIds.some((g) => ctx.staffGroupIds.includes(g));
  if (!runs) redirect(`/program/${id}`);
  const t = getT().activity.ratings;
  const tz = ctx.settings.timezone;
  const teams = ctx.groups.filter((g) => e.groupIds.includes(g.id)).map((g) => g.name).join(", ");
  const back = (
    <Link href={`/program/${id}`} className="inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink">
      <ChevronLeft className="size-5" aria-hidden />{teams || e.title}
    </Link>
  );
  const header = <PageHeader title={t.title} description={`${teams} · ${formatEventWhen(e.starts_at, e.ends_at, tz)}`} back={back} />;
  if (localDate(e.starts_at, tz) > ctx.today) return <div className="mx-auto max-w-xl">{header}<Notice tone="blue">{t.future}</Notice></div>;

  const [roster, existing] = await Promise.all([
    eventRoster(db, id, e.groupIds),
    db.from("training_ratings").select("player_id, rating").eq("event_id", id),
  ]);
  const taken = roster.some((p) => p.attendance);
  const players = (taken ? roster.filter((p) => p.attendance && (p.attendance.status === "present" || p.attendance.status === "late")) : roster)
    .map((p) => ({ id: p.id, name: p.display_name || p.full_name, number: p.shirt_number }));

  return (
    <div className="mx-auto max-w-xl">
      {header}
      <TrainingRatings
        eventId={id}
        players={players}
        initial={Object.fromEntries((existing.data ?? []).map((r) => [r.player_id, r.rating]))}
        note={taken ? t.onlyPresent : t.noAttendance}
      />
    </div>
  );
}
