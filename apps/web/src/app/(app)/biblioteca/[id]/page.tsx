import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Eye } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { fileUrl } from "@/lib/storage";
import { getT } from "@/messages";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/status";
import { ExerciseForm } from "@/components/planning/exercise-form";
import { ExerciseState } from "@/components/planning/exercise-state";
import { getExerciseUsage } from "@/components/planning/queries";

/** Pagina unui exercițiu: modificare, unde este folosit, dezactivare / ștergere. */
export default async function ExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, ctx } = await requireRole("physio");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: exercise } = await db.from("exercises").select("*").eq("id", id).maybeSingle();
  if (!exercise) notFound();
  const t = getT().library;
  const clipUrl = fileUrl("exercise-media", exercise.video_path);
  const usage = await getExerciseUsage(db, id);

  return (
    <>
      <PageHeader
        title={exercise.name}
        back={<Link href="/biblioteca" className="inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink"><ChevronLeft className="size-5" aria-hidden />{t.form.back}</Link>}
        action={<LinkButton href={`/exercitii/${id}`} icon={<Eye className="size-5" aria-hidden />}>{t.detail.viewAsPlayer}</LinkButton>}
        description={!exercise.is_active ? <Badge tone="gray">{t.inactive}</Badge> : undefined}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <ExerciseForm key={`${exercise.id}:${exercise.video_path ?? ""}`} exercise={exercise} clipUrl={clipUrl} clubName={ctx.club.name} />
        <div className="space-y-4">
          <Card>
            <CardHeader title={t.detail.usage} />
            <CardBody className="space-y-2">
              {usage.programs.length || usage.planCount ? (
                <>
                  {usage.programs.length ? (
                    <ul className="-mx-1">
                      {usage.programs.map((p) => (
                        <li key={p.id}>
                          <Link href={`/programe/${p.id}`} className="flex min-h-12 items-center rounded-[var(--radius-control)] px-1 font-semibold underline-offset-2 hover:bg-canvas hover:underline">
                            {p.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {usage.planCount ? <p className="text-ink-2">{t.detail.usagePlans(usage.planCount)}</p> : null}
                </>
              ) : (
                <p className="text-ink-3">{t.detail.usageNone}</p>
              )}
            </CardBody>
          </Card>
          <ExerciseState id={exercise.id} isActive={exercise.is_active} inUse={usage.programs.length > 0 || usage.planCount > 0} />
        </div>
      </div>
    </>
  );
}
