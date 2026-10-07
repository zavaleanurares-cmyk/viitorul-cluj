import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { POSITIONS, ageOn, can, describeZone, getPlayer, label } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { signedUrl } from "@/lib/storage";
import { Avatar } from "@/components/ui/misc";
import { ReviewBadge, StatusChip } from "@/components/ui/status";
import { PlayerTabs } from "./tabs";

/**
 * Fișa jucătorului: antet comun + file. Fiecare filă este o pagină din acest director.
 * RLS decide dacă jucătorul este vizibil; dacă nu, pagina nu există pentru utilizator.
 */
export default async function PlayerLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, ctx } = await requireCapability("viewPlayerList");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const player = await getPlayer(db, id);
  if (!player) notFound();

  const status = ctx.statuses.find((s) => s.id === player.status_id);
  const group = ctx.groups.find((g) => g.id === player.group_id);
  const photo = await signedUrl(db, "avatars", player.photo_path);
  const age = ageOn(player.birth_date, ctx.today);
  const zone = describeZone({ zone: player.status_zone, side: player.status_side, detail: player.status_zone_detail, uncertain: player.status_zone_uncertain });

  const tabs = [
    { key: "sumar", href: `/jucatori/${id}`, label: "Sumar", show: true },
    { key: "medical", href: `/jucatori/${id}/medical`, label: "Medical", show: can(ctx.role, "viewMedicalFile") },
    { key: "wellness", href: `/jucatori/${id}/wellness`, label: "Chestionare", show: can(ctx.role, "viewWellnessGrid") },
    { key: "fizic", href: `/jucatori/${id}/fizic`, label: "Date fizice", show: can(ctx.role, "viewPhysicalData") },
    { key: "plan", href: `/jucatori/${id}/plan`, label: "Plan și programe", show: can(ctx.role, "manage") },
    { key: "documente", href: `/jucatori/${id}/documente`, label: "Documente", show: can(ctx.role, "viewMedicalFile") },
  ].filter((t) => t.show);

  return (
    <>
      <Link href="/jucatori" className="mb-2 inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink">
        <ChevronLeft className="size-5" aria-hidden /> Jucători
      </Link>
      <header className="mb-3 flex items-center gap-3">
        <Avatar name={player.display_name} src={photo} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl md:text-3xl">{player.display_name}</h1>
          <p className="truncate text-ink-3">
            {[
              player.full_name !== player.display_name ? player.full_name : null,
              group?.name,
              label(POSITIONS, player.position, ""),
              player.shirt_number ? `nr. ${player.shirt_number}` : null,
              age !== null ? `${age} ani` : null,
            ].filter(Boolean).join(", ")}
          </p>
        </div>
      </header>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <StatusChip status={status} size="lg" />
        {zone ? <span className="font-semibold">{zone}</span> : null}
        {player.needs_review ? <ReviewBadge note={player.review_note} /> : null}
        {!player.is_active ? <span className="rounded-md bg-sunken px-2 py-1 text-sm font-bold text-ink-3">Inactiv</span> : null}
      </div>
      <PlayerTabs tabs={tabs.map(({ key, href, label }) => ({ key, href, label }))} />
      <div className="pt-4">{children}</div>
    </>
  );
}
