import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { POSITIONS, ageOn, can, describeZone, label } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { fileUrl } from "@/lib/storage";
import { Avatar } from "@/components/ui/misc";
import { Badge, ReviewBadge, StatusChip } from "@/components/ui/status";
import { getT } from "@/messages";
import { getPlayerForRequest } from "@/components/players/queries";
import { PlayerTabs } from "./tabs";

/**
 * Fișa jucătorului: antet comun + file. Fiecare filă este o pagină din acest director.
 * RLS decide dacă jucătorul este vizibil; dacă nu, pagina nu există pentru utilizator.
 */
export default async function PlayerLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { ctx } = await requireCapability("viewPlayerList");
  const player = await getPlayerForRequest(id);
  if (!player) notFound();
  const t = getT().players;

  const status = ctx.statuses.find((s) => s.id === player.status_id);
  const group = ctx.groups.find((g) => g.id === player.group_id);
  const age = ageOn(player.birth_date, ctx.today);
  const zone = describeZone({ zone: player.status_zone, side: player.status_side, detail: player.status_zone_detail, uncertain: player.status_zone_uncertain });

  const tabs = [
    { key: "sumar", href: `/jucatori/${id}`, label: t.tabs.sumar, show: true },
    { key: "medical", href: `/jucatori/${id}/medical`, label: t.tabs.medical, show: can(ctx.role, "viewMedicalFile") },
    { key: "wellness", href: `/jucatori/${id}/wellness`, label: t.tabs.wellness, show: can(ctx.role, "viewWellnessGrid") },
    { key: "fizic", href: `/jucatori/${id}/fizic`, label: t.tabs.fizic, show: can(ctx.role, "viewPhysicalData") },
    { key: "plan", href: `/jucatori/${id}/plan`, label: t.tabs.plan, show: can(ctx.role, "manage") },
    { key: "documente", href: `/jucatori/${id}/documente`, label: t.tabs.documente, show: can(ctx.role, "viewMedicalFile") },
  ].filter((tab) => tab.show);

  return (
    <>
      <Link href="/jucatori" className="no-print mb-2 inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink">
        <ChevronLeft className="size-5" aria-hidden /> {t.header.back}
      </Link>
      <header className="mb-3 flex items-center gap-3">
        <Avatar name={player.display_name} src={fileUrl("avatars", player.photo_path)} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl md:text-3xl">{player.display_name}</h1>
          <p className="truncate text-ink-3">
            {[
              player.full_name !== player.display_name ? player.full_name : null,
              group?.name,
              label(POSITIONS, player.position, ""),
              player.shirt_number ? t.header.number(player.shirt_number) : null,
              age !== null ? t.header.age(age) : null,
            ].filter(Boolean).join(", ")}
          </p>
        </div>
      </header>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <StatusChip status={status} size="lg" />
        {zone ? <span className="font-semibold">{zone}</span> : null}
        {player.needs_review ? <ReviewBadge note={player.review_note} /> : null}
        {!player.is_active ? <Badge tone="outline">{t.header.inactive}</Badge> : null}
      </div>
      {tabs.length > 1 ? <PlayerTabs tabs={tabs.map(({ key, href, label }) => ({ key, href, label }))} /> : <div className="border-b border-line" />}
      <div className="pt-4">{children}</div>
    </>
  );
}
