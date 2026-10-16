import { Plus } from "lucide-react";
import { can } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { DrillLibrary } from "@/components/drills/drill-library";
import { listDrills } from "@/components/drills/queries";
import { getT } from "@/messages";

export const metadata = { title: "Secțiuni de antrenament" };

/** Biblioteca de secțiuni (exerciții de teren) a clubului. */
export default async function DrillsPage() {
  const { db, ctx } = await requireCapability("viewSchedule");
  const t = getT().drills;
  const drills = await listDrills(db);
  return (
    <>
      <PageHeader title={t.title} description={t.description}
        action={can(ctx.role, "runEvents") ? <LinkButton href="/program/sectiuni/nou" variant="primary" icon={<Plus className="size-5" aria-hidden />}>{t.add}</LinkButton> : null} />
      <DrillLibrary drills={drills} userId={ctx.userId} />
    </>
  );
}
