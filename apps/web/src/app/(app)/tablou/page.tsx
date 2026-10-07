import { HeartPulse, Users } from "lucide-react";
import { can, formatDate } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { Notice, PageHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { getT } from "@/messages";
import { OverviewView } from "@/components/dashboard/overview-view";
import { TodayView } from "@/components/dashboard/today-view";
import { getOverview, getPhysioDay } from "@/components/dashboard/queries";

/**
 * Tabloul de bord.
 *  - patron și director sportiv: doar cifrele de ansamblu din `club_overview()` (fără nume, fără diagnostice);
 *  - preparator: întâi ce are de făcut azi, apoi aceleași cifre;
 *  - antrenorul și celelalte roluri sunt trimise la pagina lor de start de `requireCapability`.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ alerte?: string }> }) {
  const { db, ctx } = await requireCapability("viewOverview");
  const sp = await searchParams;
  const t = getT().dashboard;
  const isPhysio = can(ctx.role, "manage");

  if (isPhysio) {
    // alertele zilnice (chestionare lipsă de N zile, vize) se recalculează la deschiderea tabloului
    const { error } = await db.rpc("refresh_daily_alerts", {});
    if (error) console.error("[tablou] refresh_daily_alerts:", error.message);
  }

  const [overview, day] = await Promise.all([getOverview(db), isPhysio ? getPhysioDay(db, ctx) : null]);

  // directorul sportiv: scurtături către ecranele unde vede jucătorii (sus pe ecran mare, jos pe telefon)
  const directorLinks = ctx.role === "sporting_director" ? (
    <>
      <LinkButton href="/disponibilitate" icon={<HeartPulse className="size-5" aria-hidden />}>{t.links.availability}</LinkButton>
      <LinkButton href="/jucatori" icon={<Users className="size-5" aria-hidden />}>{t.links.players}</LinkButton>
    </>
  ) : null;

  return (
    <>
      <PageHeader
        title={t.title}
        description={`${ctx.club.name} · ${t.subtitle(formatDate(ctx.today, { weekday: true }))}`}
        action={directorLinks ? <div className="hidden gap-2 md:flex">{directorLinks}</div> : undefined}
      />

      {day ? (
        <>
          <h2 className="mb-3 text-xl">{t.today.heading}</h2>
          <TodayView day={day} ctx={ctx} showAllAlerts={sp.alerte === "toate"} />
          <h2 className="mb-3 mt-8 text-xl">{t.overview.heading}</h2>
        </>
      ) : null}

      {overview ? (
        <OverviewView overview={overview} groupLinks={can(ctx.role, "viewAvailabilityBoard")} />
      ) : (
        <Notice tone="red">{t.loadError}</Notice>
      )}

      {directorLinks ? <nav className="mt-4 grid gap-2 md:hidden">{directorLinks}</nav> : null}
    </>
  );
}
