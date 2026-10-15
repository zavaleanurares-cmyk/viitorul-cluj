import { notFound, redirect } from "next/navigation";
import { can, formatDate, seasonStart, zoneLabel } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { BarsChart } from "@/components/charts";
import { BodyMap, type BodyHighlight } from "@/components/ui/body-map";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { TONE_HEX } from "@/components/ui/status";
import { getT } from "@/messages";
import { availabilityOf, daysUnavailable, injuryIsActive, injuryZoneText } from "@/components/players/domain";
import { InjuriesPanel } from "@/components/players/injuries-panel";
import { createServiceDb } from "@club/db";
import { getPlayerForRequest, listInjuries, listPartners, listReferrals, profileNames } from "@/components/players/queries";
import { ReferralsPanel } from "@/components/players/referrals-panel";

/** Fișa medicală: harta accidentărilor, statistici, accidentări cu tratamente, trimiteri către partener. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, ctx } = await requireCapability("viewPlayerList");
  // directorul sportiv are doar fișa sumară
  if (!can(ctx.role, "viewMedicalFile")) redirect(`/lot/jucatori/${id}/stare`);
  const player = await getPlayerForRequest(id);
  if (!player) notFound();
  await db.rpc("log_medical_access", { p_player: id, p_section: "medical" });

  const t = getT().players.medical;
  const canManage = can(ctx.role, "manage");
  const [injuries, referrals, partners] = await Promise.all([
    listInjuries(db, id),
    listReferrals(db, id),
    canManage ? listPartners(db) : Promise.resolve([]),
  ]);
  // antrenorul nu poate citi profilurile altora; numele partenerului se ia cu drept de serviciu,
  // strict pentru trimiterile pe care RLS i le-a arătat deja
  const names = await profileNames(canManage ? db : createServiceDb(), referrals.map((r) => r.partner_user_id));

  const season = seasonStart(ctx.today, ctx.settings.season_start);
  const inSeason = injuries.filter((i) => i.occurred_on >= season);
  const daysOut = daysUnavailable(injuries, season, ctx.today);
  const ids = new Set(injuries.map((i) => i.id));
  const recurrences = injuries.filter((i) => i.recurrence_of && ids.has(i.recurrence_of)).length;

  const byZone = new Map<string, number>();
  for (const i of injuries) {
    const key = zoneLabel(i.zone, null, true) || t.zoneUnknown;
    byZone.set(key, (byZone.get(key) ?? 0) + 1);
  }
  const zoneRows = [...byZone.entries()].map(([x, value]) => ({ x, value })).sort((a, b) => b.value - a.value || a.x.localeCompare(b.x, "ro"));

  // activele primele: pe aceeași zonă, culoarea accidentării active are prioritate
  const highlights: BodyHighlight[] = [...injuries]
    .sort((a, b) => Number(injuryIsActive(b)) - Number(injuryIsActive(a)))
    .filter((i) => i.zone)
    .map((i) => ({
      zone: i.zone, side: i.side, tone: injuryIsActive(i) ? "red" : "gray",
      label: `${injuryZoneText(i)} — ${injuryIsActive(i) ? t.active : t.closed}, ${formatDate(i.occurred_on)}`,
    }));
  const status = ctx.statuses.find((s) => s.id === player.status_id);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <Card>
          <CardHeader title={t.mapTitle} />
          <CardBody>
            <BodyMap highlights={highlights} />
            <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
              <li className="inline-flex items-center gap-1.5">
                <span className="size-3.5 rounded-sm border border-ink" style={{ background: TONE_HEX.red }} aria-hidden />{t.legendActive}
              </li>
              <li className="inline-flex items-center gap-1.5">
                <span className="size-3.5 rounded-sm border border-ink" style={{ background: TONE_HEX.gray }} aria-hidden />{t.legendClosed}
              </li>
            </ul>
            {!highlights.length ? <p className="mt-2 text-center text-sm text-ink-3">{injuries.length ? t.mapNoZones : t.mapEmpty}</p> : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t.statsTitle} description={t.statSeasonSince(formatDate(season))} />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Stat label={t.statDaysOut} value={daysOut} />
              <Stat label={t.statSeason} value={inSeason.length} />
              <Stat label={t.statTotal} value={injuries.length} />
              <Stat label={t.statRecurrences} value={recurrences} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink-3">{t.byZoneTitle}</h3>
              <BarsChart data={zoneRows} label={t.byZoneLabel} caption={t.byZoneCaption} horizontal height={96} />
            </div>
          </CardBody>
        </Card>
      </div>

      <InjuriesPanel
        playerId={id}
        injuries={injuries}
        statuses={ctx.statuses}
        canManage={canManage}
        today={ctx.today}
        playerIsFit={availabilityOf(status) === "full"}
      />

      {canManage || referrals.length ? (
        <ReferralsPanel
          canManage={canManage}
          playerId={id}
          referrals={referrals}
          partners={partners}
          injuries={injuries}
          names={names}
          timezone={ctx.settings.timezone}
        />
      ) : null}
    </div>
  );
}
