import { CalendarDays } from "lucide-react";
import { addDays, formatDate, formatEventWhen, type AppContext, type Db } from "@club/shared";
import { Card, CardBody, CardHeader, Notice } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/status";
import { AttendanceMeter, VisaChip } from "@/components/squad/bits";
import { playerAttendance, visaState } from "@/components/squad/queries";
import { KIND_ICONS } from "@/components/schedule/calendar";
import { listEvents } from "@/components/schedule/queries";
import { getT } from "@/messages";
import { FamilyDueCard } from "@/components/money/today-cards";
import { VisaFamilyNotice } from "@/components/performance/visa-family";
import { FamilyEvaluationsCard } from "@/components/performance/family-evaluations";
import { FamilyClipsCard } from "@/components/performance/family-clips";
import { FamilyContractsCard } from "@/components/club/family-contracts";
import { FamilyCampsCard } from "@/components/club/family-camps";
import { FamilyNewsCard } from "@/components/club/family-news";
import { FamilyOnboardingCard } from "@/components/club/family-onboarding";

const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase("ro") + s.slice(1);

/** Azi pentru părinte: fiecare copil cu programul din următoarele 7 zile, prezența și viza. */
export async function GuardianToday({ db, ctx }: { db: Db; ctx: AppContext }) {
  const t = getT().today;
  const tz = ctx.settings.timezone;
  // RLS: părintele vede doar copiii lui
  const { data: kids } = await db.from("players").select("id, full_name, group_id, status_id, medical_visa_expires_on, enrolled_on, kit_size").eq("is_active", true).order("full_name");
  const children = kids ?? [];
  const groupIds = [...new Set(children.map((c) => c.group_id).filter(Boolean) as string[])];
  const events = groupIds.length ? await listEvents(db, { from: ctx.today, to: addDays(ctx.today, 7), timezone: tz, groupIds }) : [];
  const attendance = await Promise.all(children.map((c) => playerAttendance(db, c.id, ctx.today)));
  const { data: docs } = children.length
    ? await db.from("visa_documents").select("player_id, status, reject_reason, uploaded_at").in("player_id", children.map((c) => c.id)).order("uploaded_at", { ascending: false })
    : { data: [] };
  const lastDoc = new Map<string, { status: string; reject_reason: string | null }>();
  for (const d of docs ?? []) if (!lastDoc.has(d.player_id)) lastDoc.set(d.player_id, d);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-[1.75rem] leading-tight md:text-[2.125rem]">{capitalize(formatDate(ctx.today, { weekday: true, year: false }))}</h1>
      <FamilyOnboardingCard db={db} kids={children} today={ctx.today} visaPending={new Set([...lastDoc].filter(([, d]) => d.status === "pending").map(([id]) => id))} />
      <FamilyDueCard db={db} ctx={ctx} />
      <FamilyContractsCard db={db} />
      {children.length === 0 ? <Notice tone="blue" title={t.children}>{t.noChildren}</Notice> : null}
      <FamilyEvaluationsCard db={db} />
      <FamilyClipsCard db={db} />
      <FamilyCampsCard db={db} today={ctx.today} />
      <FamilyNewsCard db={db} today={ctx.today} />
      {children.map((c, i) => {
        const status = ctx.statuses.find((s) => s.id === c.status_id) ?? null;
        const team = ctx.groups.find((g) => g.id === c.group_id);
        const next = events.filter((e) => c.group_id && e.groupIds.includes(c.group_id) && e.status !== "cancelled").slice(0, 5);
        const visa = visaState(c.medical_visa_expires_on, ctx.today, ctx.settings.alerts.visa_days_before);
        const a = attendance[i];
        return (
          <Card key={c.id} id={`copil-${c.id}`} className="scroll-mt-20">
            <CardHeader title={c.full_name} description={team?.name} action={status ? <StatusChip status={status} size="sm" /> : null} />
            <CardBody className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <VisaChip {...visa} expires={c.medical_visa_expires_on} />
                {a.total ? <span className="inline-flex items-center gap-2 text-ink-2">{t.childAttendance(a.present, a.total)} <AttendanceMeter present={a.present} total={a.total} /></span> : null}
              </div>
              <VisaFamilyNotice playerId={c.id} playerName={c.full_name} state={visa.state} today={ctx.today} last={lastDoc.get(c.id) ?? null} />
              <h3 className="text-base">{t.childNext}</h3>
              {next.length === 0 ? <p className="text-ink-3">{t.childNoEvents}</p> : (
                <ul className="divide-y divide-line border-y border-line">
                  {next.map((e) => {
                    const Icon = KIND_ICONS[e.kind] ?? CalendarDays;
                    return (
                      <li key={e.id} className="flex items-start gap-3 py-2.5">
                        <Icon className="mt-0.5 size-5 shrink-0 text-ink-3" aria-hidden />
                        <span>
                          <span className="block font-semibold">{e.match ? `${e.match.is_home ? "" : "@ "}${e.match.opponent}` : e.title}</span>
                          <span className="block text-sm text-ink-3">{formatEventWhen(e.starts_at, e.ends_at, tz)}{e.venue ? ` · ${e.venue.name}` : ""}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
