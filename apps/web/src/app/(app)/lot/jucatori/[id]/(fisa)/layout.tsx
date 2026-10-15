import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, CircleAlert, CircleCheck, Pencil } from "lucide-react";
import { can, describeZone, formatLei } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { fileUrl } from "@/lib/storage";
import { LinkButton } from "@/components/ui/button";
import { Avatar } from "@/components/ui/misc";
import { Badge, ReviewBadge, StatusChip } from "@/components/ui/status";
import { VisaChip } from "@/components/squad/bits";
import { getSquadPlayer, visaState } from "@/components/squad/queries";
import { PlayerFileTabs } from "@/components/squad/player-file-tabs";
import { getT } from "@/messages";

/**
 * Fișa jucătorului (una singură pentru tot clubul): antet comun + file.
 * Biroul vede datele de lot; personalul medical și sportiv vede în plus filele de performanță.
 * Coloanele medicale de pe rândul jucătorului nici nu ajung la cei fără drept (rolul Postgres `authenticated`).
 */
export default async function PlayerFileLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { db, ctx } = await requireCapability("viewSquad");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const player = await getSquadPlayer(db, id);
  if (!player) notFound();
  const t = getT().squad;
  const p = t.player;
  const tabsT = getT().players.tabs;

  const status = ctx.statuses.find((s) => s.id === player.status_id) ?? null;
  const team = ctx.groups.find((g) => g.id === player.group_id);
  const visa = visaState(player.medical_visa_expires_on, ctx.today, ctx.settings.alerts.visa_days_before);
  const health = can(ctx.role, "readHealth");
  const zone = health
    ? describeZone({ zone: player.status_zone ?? null, side: player.status_side ?? null, detail: player.status_zone_detail ?? null, uncertain: player.status_zone_uncertain ?? false })
    : null;
  const finance = can(ctx.role, "manageMoney");
  const fees = finance ? (await db.from("charge_balances").select("balance, due_on").eq("player_id", id).eq("status", "open").gt("balance", 0)).data ?? [] : null;
  const overdue = (fees ?? []).filter((c) => c.due_on < ctx.today).reduce((s, c) => s + c.balance, 0);

  const base = `/lot/jucatori/${id}`;
  const tabs = [
    { key: "fisa", href: base, label: tabsT.fisa, show: true },
    { key: "stare", href: `${base}/stare`, label: tabsT.stare, show: can(ctx.role, "viewPlayerList") },
    { key: "medical", href: `${base}/medical`, label: tabsT.medical, show: can(ctx.role, "viewMedicalFile") },
    { key: "wellness", href: `${base}/wellness`, label: tabsT.wellness, show: can(ctx.role, "viewWellnessGrid") },
    { key: "fizic", href: `${base}/fizic`, label: tabsT.fizic, show: can(ctx.role, "viewPhysicalData") },
    { key: "plan", href: `${base}/plan`, label: tabsT.plan, show: can(ctx.role, "manage") },
    { key: "documente", href: `${base}/documente`, label: tabsT.documente, show: can(ctx.role, "viewMedicalFile") },
    { key: "evaluari", href: `${base}/evaluari`, label: getT().performance.evaluations.playerTab, show: can(ctx.role, "viewAnalysis") },
  ].filter((x) => x.show).map(({ key, href, label }) => ({ key, href, label }));

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Link href={team ? `/lot?echipa=${team.id}` : "/lot"} className="no-print mb-1 inline-flex h-10 items-center gap-1 text-sm font-semibold text-ink-2 hover:text-ink">
            <ChevronLeft className="size-4" aria-hidden /> {team?.name ?? p.back}
          </Link>
          <div className="flex items-center gap-3">
            <Avatar name={player.display_name} src={fileUrl("avatars", player.photo_path)} size={56} />
            <h1 className="flex min-w-0 flex-wrap items-center gap-x-3 text-2xl md:text-3xl">
              {player.shirt_number ? <span className="text-ink-3">#{player.shirt_number}</span> : null}
              <span className="min-w-0 break-words">{player.full_name}</span>
            </h1>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {status ? <StatusChip status={status} full /> : null}
            {zone ? <span className="font-semibold">{zone}</span> : null}
            <VisaChip {...visa} expires={player.medical_visa_expires_on} size="md" />
            {fees ? (
              <Link href="/bani/taxe?vedere=grila" className={overdue ? "inline-flex h-8 items-center gap-1 rounded-md bg-st-red px-2.5 text-sm font-semibold text-white" : "inline-flex h-8 items-center gap-1 rounded-md bg-st-green-soft px-2.5 text-sm font-semibold text-ink"}>
                {overdue ? <CircleAlert className="size-4" aria-hidden /> : <CircleCheck className="size-4" aria-hidden />}
                {overdue ? p.feesOverdue(formatLei(overdue)) : p.feesOk}
              </Link>
            ) : null}
            {player.needs_review && health ? <ReviewBadge note={player.review_note ?? null} /> : null}
            {!player.is_active ? <Badge tone="outline">{p.inactive}</Badge> : null}
          </div>
        </div>
        {can(ctx.role, "manageSquad") ? (
          <LinkButton href={`${base}/modifica`} variant="primary" icon={<Pencil className="size-5" aria-hidden />} className="no-print">{p.edit}</LinkButton>
        ) : null}
      </header>
      <PlayerFileTabs tabs={tabs} />
      <div>{children}</div>
    </div>
  );
}
