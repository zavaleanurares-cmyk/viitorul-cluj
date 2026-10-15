import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarClock, ChevronLeft, Mail, Phone } from "lucide-react";
import { addDays, can, formatDate, formatDateTime, formatEventWhen } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/status";
import { listEvents } from "@/components/schedule/queries";
import { BookTrialButton, CloseButtons, EnrolButton, NextSteps, NoteForm, RecordTrialButton, ReopenButton, RequestFormButton } from "@/components/club/enrolment-admin";
import { getT } from "@/messages";
import { requestTime } from "@/lib/request-time";

export const metadata = { title: "Cerere de înscriere" };

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return v ? <div className="grid grid-cols-[9rem_1fr] gap-2 py-1.5"><dt className="text-ink-3">{k}</dt><dd>{v}</dd></div> : null;
}

const TONE = { new: "blue", trial: "yellow", trial_done: "yellow", enrolled: "green", declined: "gray", withdrawn: "gray" } as const;

export default async function EnrolmentRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, ctx } = await requireCapability("manageEnrolment");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const t = getT().club.enrolment;
  const { data: r } = await db.from("enrolment_requests").select("*").eq("id", id).maybeSingle();
  if (!r) notFound();
  const tz = ctx.settings.timezone;
  const groups = ctx.groups.filter((g) => g.is_active).map((g) => ({ id: g.id, name: g.name }));
  const team = (gid: string | null) => ctx.groups.find((g) => g.id === gid)?.name ?? t.noTeam;
  const open = ["new", "trial", "trial_done"].includes(r.status);

  const [{ data: history }, events, extra] = await Promise.all([
    db.from("enrolment_events").select("id, at, action, note, actor_id, profiles(full_name)").eq("request_id", id).order("at", { ascending: false }),
    open ? listEvents(db, { from: ctx.today, to: addDays(ctx.today, 21), timezone: tz, groupIds: r.group_id ? [r.group_id] : null, kind: "training" }) : Promise.resolve([]),
    r.status === "enrolled" && r.player_id ? Promise.all([
      r.guardian_id ? db.from("guardians").select("id, email, user_id").eq("id", r.guardian_id).maybeSingle() : Promise.resolve({ data: null }),
      can(ctx.role, "manageContracts") ? db.from("contract_templates").select("id, name").eq("is_active", true).order("name") : Promise.resolve({ data: [] }),
      can(ctx.role, "manageContracts") ? db.from("contracts").select("id", { count: "exact", head: true }).eq("player_id", r.player_id).in("status", ["sent", "signed"]) : Promise.resolve({ count: 0 }),
      db.from("charges").select("id", { count: "exact", head: true }).eq("player_id", r.player_id),
    ]) : Promise.resolve(null),
  ]);
  const now = requestTime();
  const trialEvents = events.filter((e) => e.status !== "cancelled" && Date.parse(e.starts_at) > now).map((e) => ({
    id: e.id, when: formatEventWhen(e.starts_at, e.ends_at, tz), title: e.title, team: e.groupIds.map(team).join(", "),
  }));
  const age = Math.floor((Date.parse(ctx.today) - Date.parse(r.birth_date)) / (365.25 * 86400e3));
  const request = {
    id: r.id, childName: r.child_name, birthDate: r.birth_date, groupId: r.group_id ?? "", previousClub: r.previous_club ?? "",
    position: (r.position ?? "") as "" | "GK" | "DEF" | "MID" | "FWD", notes: r.notes ?? "", parentName: r.parent_name,
    relation: r.relation as "parent", email: r.parent_email ?? "", phone: r.parent_phone ?? "",
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader
        back={<Link href="/club/inscrieri" className="inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink"><ChevronLeft className="size-5" aria-hidden />{t.title}</Link>}
        title={r.child_name}
        description={<span className="inline-flex flex-wrap items-center gap-2"><Badge tone={TONE[r.status as keyof typeof TONE]}>{t.status[r.status as keyof typeof t.status]}</Badge>{t.ageYears(age)} · {team(r.group_id)} · {r.source === "public" ? t.fromSite : t.fromOffice}</span>}
        action={open ? <RequestFormButton groups={groups} request={request} /> : undefined}
      />

      {open ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-line bg-surface p-3">
          {r.status === "new" ? <BookTrialButton id={r.id} events={trialEvents} /> : null}
          {r.status === "trial" ? <><RecordTrialButton id={r.id} /><BookTrialButton id={r.id} events={trialEvents} again /></> : null}
          {r.status === "trial_done" ? <><EnrolButton id={r.id} groupId={r.group_id} groups={groups} /><RecordTrialButton id={r.id} rating={r.trial_rating} note={r.trial_note} /></> : null}
          {r.status !== "trial_done" ? <EnrolButton id={r.id} groupId={r.group_id} groups={groups} /> : null}
          <span className="flex-1" />
          <CloseButtons id={r.id} />
        </div>
      ) : r.status !== "enrolled" ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3">
          <p className="flex-1 text-ink-2">{t.status[r.status as "declined"]}{r.decline_reason ? `: ${r.decline_reason}` : ""}</p>
          <ReopenButton id={r.id} />
        </div>
      ) : null}

      {r.status === "enrolled" && r.player_id && extra ? (
        <Card>
          <CardHeader title={t.sections.next} />
          <CardBody>
            <NextSteps playerId={r.player_id}
              guardian={extra[0].data ? { id: extra[0].data.id, email: extra[0].data.email, hasAccount: !!extra[0].data.user_id } : null}
              templates={(extra[1].data ?? []) as Array<{ id: string; name: string }>} canContracts={can(ctx.role, "manageContracts")}
              contractSent={(extra[2].count ?? 0) > 0} charges={extra[3].count ?? 0} />
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title={t.sections.child} />
          <CardBody>
            <dl className="divide-y divide-line">
              <Row k={t.fields.birthDate} v={formatDate(r.birth_date)} />
              <Row k={t.fields.team} v={team(r.group_id)} />
              <Row k={t.fields.position} v={r.position ? t.positions[r.position as keyof typeof t.positions] : null} />
              <Row k={t.fields.previousClub} v={r.previous_club} />
              <Row k={t.fields.notes} v={r.notes ? <span className="whitespace-pre-line">{r.notes}</span> : null} />
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t.sections.parent} />
          <CardBody>
            <dl className="divide-y divide-line">
              <Row k={t.fields.parentName} v={`${r.parent_name} · ${t.relations[r.relation as keyof typeof t.relations]}`} />
              <Row k={t.fields.email} v={r.parent_email ? <a className="inline-flex items-center gap-1 font-semibold underline underline-offset-4" href={`mailto:${r.parent_email}`}><Mail className="size-4" aria-hidden />{r.parent_email}</a> : null} />
              <Row k={t.fields.phone} v={r.parent_phone ? <a className="inline-flex items-center gap-1 font-semibold underline underline-offset-4" href={`tel:${r.parent_phone}`}><Phone className="size-4" aria-hidden />{r.parent_phone}</a> : null} />
            </dl>
          </CardBody>
        </Card>
      </div>

      {r.trial_at ? (
        <Card>
          <CardHeader title={t.sections.trial} />
          <CardBody className="space-y-1">
            <p className="inline-flex items-center gap-2"><CalendarClock className="size-5 text-ink-3" aria-hidden />
              {r.trial_event_id ? <Link className="font-semibold underline underline-offset-4" href={`/program/${r.trial_event_id}`}>{formatDateTime(r.trial_at, tz)}</Link> : formatDateTime(r.trial_at, tz)}
            </p>
            {r.trial_rating ? <p><span className="font-semibold">{t.rating(r.trial_rating)}</span> · {t.ratings[r.trial_rating as 1]}</p> : null}
            {r.trial_note ? <p className="whitespace-pre-line text-ink-2">{r.trial_note}</p> : null}
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title={t.sections.history} />
        <CardBody className="space-y-3">
          <NoteForm id={r.id} />
          <ol className="divide-y divide-line">
            {(history ?? []).map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 py-2">
                <span className="w-36 shrink-0 text-sm tabular-nums text-ink-3">{formatDateTime(e.at, tz)}</span>
                <span className="font-semibold">{t.events[e.action as keyof typeof t.events]}</span>
                <span className="text-sm text-ink-3">{(e.profiles as { full_name: string } | null)?.full_name ?? (e.actor_id ? "" : t.fromSite)}</span>
                {e.note ? <span className="basis-full text-ink-2">{e.note}</span> : null}
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>
    </div>
  );
}
