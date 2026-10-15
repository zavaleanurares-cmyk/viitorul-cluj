import { redirect } from "next/navigation";
import { can, homePath } from "@club/shared";
import { requireSession } from "@/lib/auth";
import { PlayerToday } from "@/components/player/player-today";
import { GuardianToday } from "@/components/today/guardian-today";
import { StaffToday } from "@/components/today/staff-today";

export const metadata = { title: "Azi" };

/** Azi, după rol: jucătorul (planul zilei), părintele (copiii), staff-ul (program, prezență, de rezolvat). */
export default async function TodayPage() {
  const { db, ctx } = await requireSession();
  if (ctx.role === "player") return <PlayerToday db={db} ctx={ctx} />;
  if (ctx.role === "guardian") return <GuardianToday db={db} ctx={ctx} />;
  if (can(ctx.role, "viewSchedule")) return <StaffToday db={db} ctx={ctx} />;
  redirect(homePath(ctx.role) === "/azi" ? "/profil" : homePath(ctx.role));
}
