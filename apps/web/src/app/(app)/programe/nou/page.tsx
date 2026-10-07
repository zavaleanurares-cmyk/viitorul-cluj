import { requireRole } from "@/lib/auth";
import { getT } from "@/messages";
import { PageHeader } from "@/components/ui/card";
import { BackLink } from "@/components/planning/back-link";
import { ProgramEditor } from "@/components/planning/program-editor";
import { listExerciseOptions } from "@/components/planning/queries";

export const metadata = { title: "Program nou" };

export default async function NewProgramPage() {
  const { db } = await requireRole("physio");
  const t = getT().planning.programs;
  const exercises = await listExerciseOptions(db);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t.form.newTitle} back={<BackLink href="/programe">{t.back}</BackLink>} />
      <ProgramEditor program={null} items={[]} exercises={exercises} />
    </div>
  );
}
