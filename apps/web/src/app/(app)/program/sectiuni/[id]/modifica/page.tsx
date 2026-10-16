import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { can } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { PageHeader } from "@/components/ui/card";
import { DrillForm } from "@/components/drills/drill-form";
import { getDrill } from "@/components/drills/queries";
import { getT } from "@/messages";

export const metadata = { title: "Modifică secțiunea" };

export default async function EditDrillPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, ctx } = await requireCapability("runEvents");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const drill = await getDrill(db, id);
  if (!drill || (drill.created_by !== ctx.userId && !can(ctx.role, "manageSchedule"))) notFound();
  const t = getT().drills.form;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t.editTitle}
        back={<Link href={`/program/sectiuni/${id}`} className="inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink"><ChevronLeft className="size-5" aria-hidden />{drill.name}</Link>} />
      <DrillForm drill={drill} clubId={ctx.club.id} />
    </div>
  );
}
