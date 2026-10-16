import { can } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { ScheduleTabs } from "@/components/schedule/schedule-tabs";

/** Spațiul Program: staff-ul clubului (antrenorii văd tot calendarul, conduc doar evenimentele echipelor lor). */
export default async function ScheduleLayout({ children }: { children: React.ReactNode }) {
  const { ctx } = await requireCapability("viewSchedule");
  return (
    <>
      <ScheduleTabs coaching={can(ctx.role, "runEvents")} />
      {children}
    </>
  );
}
