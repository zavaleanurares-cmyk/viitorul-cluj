import { notFound, redirect } from "next/navigation";
import { can, formatEventWhen, localDate } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { Notice } from "@/components/ui/card";
import { AttendanceSheet } from "@/components/schedule/attendance-sheet";
import { eventRoster, getEvent } from "@/components/schedule/queries";
import { getT } from "@/messages";
import { requestTime } from "@/lib/request-time";

export const metadata = { title: "Prezența" };

/**
 * Ecranul de prezență al antrenorului. Pagina se poate deschide și fără semnal (service worker-ul o păstrează
 * după prima deschidere), iar salvarea trece prin coada offline. Arată doar starea (fără diagnostic).
 */
export default async function AttendancePage({ params }: { params: Promise<{ id: string }> }) {
  const { db, ctx } = await requireCapability("runEvents");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const e = await getEvent(db, id);
  if (!e) notFound();
  const t = getT().schedule;
  const runs = can(ctx.role, "manageSchedule") || e.groupIds.some((g) => ctx.staffGroupIds.includes(g));
  if (!runs) redirect(`/program/${id}`);
  const tz = ctx.settings.timezone;
  if (localDate(e.starts_at, tz) > ctx.today) {
    return <Notice tone="blue" title={t.attendance.title}>{t.attendance.future}</Notice>;
  }
  const roster = await eventRoster(db, id, e.groupIds);
  const out = new Set(ctx.statuses.filter((s) => s.availability === "out").map((s) => s.id));
  const teams = ctx.groups.filter((g) => e.groupIds.includes(g.id)).map((g) => g.name).join(", ");

  return (
    <AttendanceSheet
      eventId={id}
      title={`${t.attendance.title} · ${teams || e.title}`}
      subtitle={`${formatEventWhen(e.starts_at, e.ends_at, tz)}${e.venue ? ` · ${e.venue.name}` : ""}`}
      savedAt={e.attendance_saved_at}
      loadedAt={new Date(requestTime()).toISOString()}
      players={roster.map((p) => ({
        id: p.id,
        name: p.full_name,
        number: p.shirt_number,
        injured: !!p.status_id && out.has(p.status_id),
        status: p.attendance?.status ?? null,
        reason: p.attendance?.reason ?? null,
      }))}
    />
  );
}
