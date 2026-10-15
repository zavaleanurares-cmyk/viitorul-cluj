import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, Phone } from "lucide-react";
import { ABSENCE_REASON_LABELS, ATTENDANCE_LABELS, ageOn, can, formatDate, formatDateShort, seasonStart, type AbsenceReason, type AttendanceStatus } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Notice, Stat } from "@/components/ui/card";
import { DataList } from "@/components/ui/misc";
import { AttendanceMeter } from "@/components/squad/bits";
import { getSquadPlayer, playerAttendance, playerGuardians, playerSeasonStats, visaState } from "@/components/squad/queries";
import { getT } from "@/messages";
import { VisaDecision, VisaUploadButton } from "@/components/performance/visa";

export const metadata = { title: "Fișa jucătorului" };

export default async function SquadPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, ctx } = await requireCapability("viewSquad");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const player = await getSquadPlayer(db, id);
  if (!player) notFound();
  const t = getT().squad;
  const p = t.player;

  const [guardians, attendance, stats] = await Promise.all([
    playerGuardians(db, id),
    playerAttendance(db, id, ctx.today),
    playerSeasonStats(db, id, seasonStart(ctx.today, ctx.settings.season_start)),
  ]);
  const team = ctx.groups.find((g) => g.id === player.group_id);
  const visa = visaState(player.medical_visa_expires_on, ctx.today, ctx.settings.alerts.visa_days_before);
  const age = ageOn(player.birth_date, ctx.today);
  const manageVisas = can(ctx.role, "manageVisas");
  const pendingVisa = manageVisas
    ? (await db.from("visa_documents").select("id, issued_on, storage_path").eq("player_id", id).eq("status", "pending").order("uploaded_at", { ascending: false }).limit(1)).data?.[0] ?? null
    : null;
  const canManage = can(ctx.role, "manageSquad");

  return (
    <div className="space-y-4">

      {stats.suspensions.map((s, i) => (
        <Notice key={i} tone="red" title={p.suspended}>{p.suspendedText(s.reason, s.matches_remaining)}</Notice>
      ))}
      {pendingVisa && manageVisas ? (
        <Notice tone="yellow" title={getT().performance.visas.pending}>
          <VisaDecision doc={{ id: pendingVisa.id, issued_on: pendingVisa.issued_on, path: pendingVisa.storage_path }} playerName={player.display_name}
            today={ctx.today} validityMonths={ctx.settings.medical_visa_validity_months ?? 12} />
        </Notice>
      ) : visa.state === "expired" || visa.state === "missing" ? (
        <Notice tone="red" title={t.visa[visa.state]}>
          <p>{p.blockedVisa}</p>
          {manageVisas ? <div className="mt-2"><VisaUploadButton playerId={player.id} playerName={player.display_name} today={ctx.today} size="sm" variant="secondary" /></div> : null}
        </Notice>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title={p.identity} />
          <CardBody>
            <DataList items={[
              { label: p.fields.team, value: team?.name ?? "—" },
              { label: p.fields.birthDate, value: player.birth_date ? `${formatDate(player.birth_date)}${age !== null ? ` · ${p.years(age)}` : ""}` : "—" },
              { label: p.fields.position, value: player.position ? `${p.positions[player.position] ?? player.position}${player.position_detail ? ` · ${player.position_detail}` : ""}` : "—" },
              { label: p.fields.foot, value: player.dominant_foot ? p.foot[player.dominant_foot] : "—" },
              { label: p.fields.nationality, value: player.nationality ?? "—" },
              { label: p.fields.registration, value: player.registration_number ?? "—" },
              { label: p.fields.fifaId, value: player.fifa_id ?? "—" },
              { label: p.fields.enrolledOn, value: player.enrolled_on ? formatDate(player.enrolled_on) : "—" },
              { label: p.fields.visa, value: player.medical_visa_expires_on ? formatDate(player.medical_visa_expires_on) : t.visa.missing },
              { label: p.fields.photoConsent, value: player.photo_consent ? getT().common.actions.yes : getT().common.actions.no },
            ]} />
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title={p.guardians} action={canManage ? <LinkButton href={`/lot/parinti?copil=${id}`} size="sm">{p.addGuardian}</LinkButton> : null} />
            <CardBody>
              {guardians.length === 0 ? <p className="text-ink-3">{p.noGuardians}</p> : (
                <ul className="divide-y divide-line">
                  {guardians.map((g) => (
                    <li key={g.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="font-semibold">{g.full_name}</p>
                        <p className="text-sm text-ink-3">{t.guardians.relations[g.relation] ?? g.relation}{g.isBilling ? ` · ${t.guardians.fields.billing.toLowerCase()}` : ""}{g.email ? ` · ${g.email}` : ""}</p>
                      </div>
                      {g.phone ? (
                        <a href={`tel:${g.phone.replace(/\s+/g, "")}`} aria-label={p.call(g.full_name)}
                          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-[var(--radius-control)] border border-border-control px-3 font-semibold hover:bg-canvas">
                          <Phone className="size-4" aria-hidden /> {g.phone}
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={p.attendance} action={attendance.total ? <AttendanceMeter present={attendance.present} total={attendance.total} /> : null} />
            <CardBody>
              {attendance.total === 0 ? <p className="text-ink-3">{p.noSessions}</p> : attendance.absences.length === 0 ? <p className="text-ink-3">{p.noAbsences}</p> : (
                <ul className="divide-y divide-line">
                  {attendance.absences.map((a) => (
                    <li key={a.event.id} className="flex justify-between gap-3 py-2">
                      <Link href={`/program/${a.event.id}`} className="font-semibold hover:underline">{formatDateShort(a.event.starts_at.slice(0, 10), false)} · {a.event.title}</Link>
                      <span className="text-ink-2">{a.reason ? ABSENCE_REASON_LABELS[a.reason as AbsenceReason] : ATTENDANCE_LABELS[a.status as AttendanceStatus]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <section aria-labelledby="t-season">
        <h2 id="t-season" className="mb-2 text-xl">{p.season}</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label={p.apps} value={stats.apps} />
          <Stat label={p.minutes} value={stats.minutes} />
          <Stat label={p.goals} value={stats.goals} />
          <Stat label={p.yellows} value={stats.yellows} tone={stats.suspensions.length ? "red" : undefined} hint={stats.suspensions.length ? <span className="inline-flex items-center gap-1"><Ban className="size-4" aria-hidden />{p.suspended}</span> : undefined} />
        </div>
      </section>
    </div>
  );
}
