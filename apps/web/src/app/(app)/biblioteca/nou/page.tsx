import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { getT } from "@/messages";
import { PageHeader } from "@/components/ui/card";
import { ExerciseForm } from "@/components/planning/exercise-form";

export default async function NewExercisePage() {
  const { ctx } = await requireRole("physio");
  const t = getT().library.form;
  return (
    <>
      <PageHeader
        title={t.newTitle}
        back={<Link href="/biblioteca" className="inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink"><ChevronLeft className="size-5" aria-hidden />{t.back}</Link>}
      />
      <ExerciseForm exercise={null} clipUrl={null} clubName={ctx.club.name} />
    </>
  );
}
