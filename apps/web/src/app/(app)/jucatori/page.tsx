import { can, listPlayers } from "@club/shared";
import { requireCapability, visibleGroups } from "@/lib/auth";
import { signedUrls } from "@/lib/storage";
import { PageHeader } from "@/components/ui/card";
import { getT } from "@/messages";
import { PlayersList } from "@/components/players/players-list";

/** Lista jucătorilor pe care utilizatorul îi poate vedea (RLS: antrenorul primește doar grupele lui). */
export default async function Page({ searchParams }: {
  searchParams: Promise<{ q?: string; grupa?: string; stare?: string; inactivi?: string }>;
}) {
  const { db, ctx } = await requireCapability("viewPlayerList");
  const sp = await searchParams;
  const t = getT().players.list;
  const canManage = can(ctx.role, "manage");

  const players = await listPlayers(db, { includeInactive: canManage });
  const photos = await signedUrls(db, "avatars", players.map((p) => p.photo_path));
  const groups = visibleGroups(ctx);

  return (
    <>
      <PageHeader title={t.title} />
      <PlayersList
        players={players}
        groups={groups}
        statuses={ctx.statuses}
        photos={photos}
        canManage={canManage}
        today={ctx.today}
        visaWarnDays={ctx.settings.alerts.visa_days_before}
        initial={{
          q: typeof sp.q === "string" ? sp.q : "",
          grupa: typeof sp.grupa === "string" ? sp.grupa : "",
          stare: typeof sp.stare === "string" ? sp.stare : "",
          inactivi: canManage && sp.inactivi === "1",
        }}
      />
    </>
  );
}
