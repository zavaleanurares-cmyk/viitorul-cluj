import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Lock } from "lucide-react";
import { can, formatDateShort } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { Card, CardBody, Notice, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/status";
import { DrillActions } from "@/components/drills/drill-actions";
import { DrillDetail } from "@/components/drills/drill-detail";
import { drillUsage, getDrill } from "@/components/drills/queries";
import { getT } from "@/messages";

export const metadata = { title: "Secțiune de antrenament" };

export default async function DrillPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, ctx } = await requireCapability("viewSchedule");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const drill = await getDrill(db, id);
  if (!drill) notFound();
  const t = getT().drills;
  const used = await drillUsage(db, id);
  const canEdit = drill.created_by === ctx.userId || can(ctx.role, "manageSchedule");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title={drill.name}
        description={[drill.author ? t.by(drill.author) : null, formatDateShort(drill.updated_at.slice(0, 10))].filter(Boolean).join(" · ")}
        back={<Link href="/program/sectiuni" className="inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink"><ChevronLeft className="size-5" aria-hidden />{t.form.back}</Link>}
      />
      <div className="flex flex-wrap gap-2">
        {drill.visibility === "private" ? <Badge tone="outline"><Lock className="size-3.5" aria-hidden />{t.private}</Badge> : null}
        {!drill.is_active ? <Badge tone="gray">{t.archived}</Badge> : null}
      </div>
      {!drill.is_active ? <Notice tone="gray">{t.view.archivedNotice}</Notice> : null}
      <Card>
        <CardBody><DrillDetail drill={drill} /></CardBody>
      </Card>
      <p className="text-sm text-ink-3">{t.view.usedIn(used)}</p>
      <DrillActions id={drill.id} name={drill.name} canEdit={canEdit} canCopy={can(ctx.role, "runEvents")} archived={!drill.is_active} />
    </div>
  );
}
