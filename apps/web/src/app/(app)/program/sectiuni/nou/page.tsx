import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireCapability } from "@/lib/auth";
import { PageHeader } from "@/components/ui/card";
import { DrillForm } from "@/components/drills/drill-form";
import { getT } from "@/messages";

export const metadata = { title: "Secțiune nouă" };

export default async function NewDrillPage() {
  const { ctx } = await requireCapability("runEvents");
  const t = getT().drills.form;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t.newTitle}
        back={<Link href="/program/sectiuni" className="inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink"><ChevronLeft className="size-5" aria-hidden />{t.back}</Link>} />
      <DrillForm drill={null} clubId={ctx.club.id} />
    </div>
  );
}
