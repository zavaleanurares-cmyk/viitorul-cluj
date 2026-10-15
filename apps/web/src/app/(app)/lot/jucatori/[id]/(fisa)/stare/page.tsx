import { notFound } from "next/navigation";
import {
  FEET, POSITIONS, ageOn, can, describeZone, formatDate, formatDateShort, formatDateTime, label, listPlayers,
} from "@club/shared";
import { requireCapability, visibleGroups } from "@/lib/auth";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Notice } from "@/components/ui/card";
import { DataList } from "@/components/ui/misc";
import { StatusChip } from "@/components/ui/status";
import { getT } from "@/messages";
import { dayOf } from "@/components/players/domain";
import {
  getContacts, getPlayerForRequest, listAnthropometrics, listConsents, listGroupHistory, listStatusHistory, profileNames,
} from "@/components/players/queries";
import {
  ActiveToggle, AnthroCard, ConsentCard, ContactsCard, EditPlayerButton, StatusCard, VisaCard, type ConsentItem,
} from "@/components/players/summary-cards";

const HISTORY_LIMIT = 40;

/**
 * Sumarul fișei jucătorului. Fiecare rol primește din baza de date doar ce are voie să vadă (RLS);
 * aici doar nu afișăm secțiunile care nu i se aplică.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, ctx } = await requireCapability("viewPlayerList");
  const player = await getPlayerForRequest(id);
  if (!player) notFound();
  await db.rpc("log_medical_access", { p_player: id, p_section: "fisa" });

  const t = getT().players.summary;
  const canManage = can(ctx.role, "manage");
  const medical = can(ctx.role, "viewMedicalFile");
  const tz = ctx.settings.timezone;

  const [history, groupHistory, contacts, anthro, consents, known] = await Promise.all([
    listStatusHistory(db, id, HISTORY_LIMIT),
    medical ? listGroupHistory(db, id) : Promise.resolve([]),
    canManage ? getContacts(db, id) : Promise.resolve(null),
    medical ? listAnthropometrics(db, id) : Promise.resolve([]),
    canManage ? listConsents(db, id, player.user_id) : Promise.resolve([]),
    canManage ? listPlayers(db, { includeInactive: true }) : Promise.resolve([]),
  ]);
  const names = await profileNames(db, [...history.map((h) => h.changed_by), ...consents.map((c) => c.recorded_by)]);

  const group = ctx.groups.find((g) => g.id === player.group_id);
  const groupName = (gid: string | null) => (gid ? ctx.groups.find((g) => g.id === gid)?.name ?? t.groupRemoved : t.noGroup);
  const age = ageOn(player.birth_date, ctx.today);
  const minor = age !== null && age < 18;
  const statusById = new Map(ctx.statuses.map((s) => [s.id, s]));

  const profile = [
    { label: t.fullName, value: player.full_name },
    { label: t.displayName, value: player.display_name },
    { label: t.group, value: group?.name ?? t.noGroup },
    {
      label: t.birthDate,
      value: player.birth_date
        ? `${formatDate(player.birth_date)}${age !== null ? ` ${t.ageSuffix(age)}` : ""}${minor ? `, ${t.minor}` : ""}`
        : "—",
    },
    { label: t.position, value: [label(POSITIONS, player.position, ""), player.position_detail].filter(Boolean).join(" — ") || "—" },
    { label: t.foot, value: label(FEET, player.dominant_foot) },
    { label: t.shirtNumber, value: player.shirt_number ?? "—" },
  ];

  const guardianConsent = consents.some((c) => (c.kind === "guardian_paper" || c.kind === "guardian_digital") && !c.withdrawn_at);
  const consentItems: ConsentItem[] = consents.map((c) => ({
    id: c.id,
    kind: c.kind,
    guardianName: c.guardian_name,
    guardianRelation: c.guardian_relation,
    date: formatDateShort(dayOf(c.accepted_at, tz)),
    version: c.text_version,
    recordedBy: c.recorded_by ? names[c.recorded_by] ?? null : null,
    withdrawnOn: c.withdrawn_at ? formatDateShort(dayOf(c.withdrawn_at, tz)) : null,
  }));

  return (
    <div className="space-y-4">
      {!player.is_active ? <Notice tone="gray">{t.inactiveNotice}</Notice> : null}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="space-y-4">
          <StatusCard
            player={{
              id: player.id, display_name: player.display_name, status_id: player.status_id, status_note: player.status_note,
              status_zone: player.status_zone, status_side: player.status_side, status_zone_detail: player.status_zone_detail,
              status_zone_uncertain: player.status_zone_uncertain, status_return_on: player.status_return_on,
              training_restrictions: player.training_restrictions, needs_review: player.needs_review, review_note: player.review_note,
            }}
            statuses={ctx.statuses}
            canManage={canManage}
            today={ctx.today}
            since={player.status_updated_at ? formatDate(dayOf(player.status_updated_at, tz)) : null}
          />

          <Card>
            <CardHeader title={t.historyTitle} />
            <CardBody>
              {!history.length ? (
                <p className="text-ink-3">{t.historyEmpty}</p>
              ) : (
                <>
                  <ol className="relative ml-1.5 space-y-4 border-l-2 border-line pl-5">
                    {history.map((h) => {
                      const zone = describeZone({ zone: h.zone, side: h.side, detail: h.zone_detail, uncertain: h.zone_uncertain }, true);
                      const by = h.changed_by ? names[h.changed_by] : null;
                      return (
                        <li key={h.id} className="relative">
                          <span className="absolute -left-[1.6875rem] top-2 size-3 rounded-full border-2 border-surface bg-ink-3" aria-hidden />
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <StatusChip status={h.status_id ? statusById.get(h.status_id) : null} size="sm" />
                            <span className="text-sm text-ink-3">
                              {formatDateTime(h.created_at, tz)}{by ? ` · ${t.historyBy(by)}` : ""}
                            </span>
                          </p>
                          {zone || h.return_on ? (
                            <p className="mt-0.5 text-[0.9375rem]">
                              {zone ? <span className="font-semibold">{zone}</span> : null}
                              {zone && h.return_on ? " · " : null}
                              {h.return_on ? t.historyReturn(formatDateShort(h.return_on)) : null}
                            </p>
                          ) : null}
                          {h.note ? <p className="text-[0.9375rem] text-ink-2">{h.note}</p> : null}
                        </li>
                      );
                    })}
                  </ol>
                  {history.length >= HISTORY_LIMIT ? <p className="mt-3 text-sm text-ink-3">{t.historyMore(HISTORY_LIMIT)}</p> : null}
                </>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title={t.profileTitle}
              action={canManage ? (
                <EditPlayerButton
                  playerId={id}
                  groups={visibleGroups(ctx)}
                  known={known.map((k) => ({ id: k.id, full_name: k.full_name, display_name: k.display_name, group_id: k.group_id }))}
                  today={ctx.today}
                  initial={{
                    fullName: player.full_name,
                    displayName: player.display_name,
                    groupId: player.group_id ?? "",
                    birthDate: player.birth_date ?? "",
                    position: player.position ?? "",
                    positionDetail: player.position_detail ?? "",
                    foot: player.dominant_foot ?? "",
                    shirtNumber: player.shirt_number != null ? String(player.shirt_number) : "",
                    visaExpiresOn: player.medical_visa_expires_on ?? "",
                  }}
                />
              ) : undefined}
            />
            <CardBody className="space-y-4">
              <DataList items={profile} />
              {groupHistory.length > 1 ? (
                <div>
                  <h3 className="mb-1 text-sm font-semibold text-ink-3">{t.groupHistoryTitle}</h3>
                  <ul className="text-[0.9375rem]">
                    {groupHistory.map((g) => (
                      <li key={g.id} className="flex justify-between gap-3 border-t border-line py-1.5">
                        <span className="font-semibold">{groupName(g.group_id)}</span>
                        <span className="text-ink-3">{t.groupHistoryRange(formatDateShort(g.from_date), g.to_date ? formatDateShort(g.to_date) : null)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {canManage ? <ActiveToggle playerId={id} active={player.is_active} name={player.display_name} /> : null}
            </CardBody>
          </Card>

          {medical ? (
            <VisaCard
              playerId={id}
              expiresOn={player.medical_visa_expires_on}
              canManage={canManage}
              today={ctx.today}
              warnDays={ctx.settings.alerts.visa_days_before}
              validityMonths={ctx.settings.medical_visa_validity_months}
            />
          ) : null}

          {canManage ? <ContactsCard playerId={id} contacts={contacts} minor={minor} /> : null}
        </div>
      </div>

      {medical ? <AnthroCard playerId={id} rows={anthro} canManage={canManage} today={ctx.today} /> : null}

      {canManage ? (
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <ConsentCard
            playerId={id}
            consents={consentItems}
            minor={age === null || minor}
            guardianMissing={minor && !guardianConsent}
            defaultGuardian={contacts?.guardian_name ?? ""}
            today={ctx.today}
          />
          <Card>
            <CardHeader title={t.accountTitle} />
            <CardBody className="space-y-3">
              <p>{player.user_id ? t.accountLinked : t.accountMissing}</p>
              <LinkButton href={`/administrare/conturi?jucator=${id}`}>{player.user_id ? t.accountManage : t.accountCreate}</LinkButton>
            </CardBody>
          </Card>
        </div>
      ) : null}

      {ctx.role === "sporting_director" ? <p className="text-sm text-ink-3">{t.directorNote}</p> : null}
    </div>
  );
}
