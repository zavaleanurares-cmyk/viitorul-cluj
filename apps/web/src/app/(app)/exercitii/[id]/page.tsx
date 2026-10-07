import { notFound } from "next/navigation";
import { z } from "zod";
import { EQUIPMENT, EXERCISE_CATEGORIES, EXERCISE_LEVELS, homePath, label, zoneLabel } from "@club/shared";
import { requireSession } from "@/lib/auth";
import { fileUrl } from "@/lib/storage";
import { Card, CardBody, Notice } from "@/components/ui/card";
import { Badge } from "@/components/ui/status";
import { ExerciseMedia } from "@/components/ui/video";
import { BackButton } from "@/components/player/back-button";
import { getT } from "@/messages";

export const metadata = { title: "Exercițiu" };

/** Doar căi interne: „/plan?zi=…", nu „//alt-site" și nu adrese absolute. */
function safeBack(value: string | string[] | undefined): string | null {
  return typeof value === "string" && /^\/(?![/\\])[^\s]*$/.test(value) ? value : null;
}

export default async function ExercisePage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ inapoi?: string | string[] }>;
}) {
  // orice rol care poate citi exercițiul (RLS decide); cine nu are drept primește „pagină negăsită"
  const { db, ctx } = await requireSession();
  const t = getT().player.exercise;
  const [{ id }, { inapoi }] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();

  const { data: ex } = await db.from("exercises").select("*").eq("id", id).maybeSingle();
  if (!ex) notFound();

  const clipUrl = fileUrl("exercise-media", ex.video_path);
  const credit = [ex.attribution, ex.source && ex.source !== ex.attribution ? ex.source : null, ex.license].filter(Boolean).join(" · ");

  return (
    <article className="mx-auto max-w-2xl space-y-4">
      <BackButton href={safeBack(inapoi)} fallback={homePath(ctx.role)} label={t.back} />
      <header>
        <h1 className="text-2xl md:text-3xl">{ex.name}</h1>
        <p className="mt-2 flex flex-wrap gap-1.5">
          <Badge tone="outline">{label(EXERCISE_CATEGORIES, ex.category)}</Badge>
          <Badge tone="outline">{t.level}: {label(EXERCISE_LEVELS, ex.level)}</Badge>
          {!ex.is_active ? <Badge tone="gray">{t.inactive}</Badge> : null}
        </p>
      </header>

      <ExerciseMedia title={ex.name} fileUrl={clipUrl} url={ex.video_url} imageUrl={ex.image_url} />

      {ex.description ? <p className="text-lg text-ink-2">{ex.description}</p> : null}

      {ex.steps.length ? (
        <Card>
          <CardBody>
            <h2 className="mb-3 text-lg">{t.steps}</h2>
            <ol className="space-y-3">
              {ex.steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span aria-hidden className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken font-bold">{i + 1}</span>
                  <span className="pt-0.5 text-lg leading-snug">
                    <span className="sr-only">{t.step(i + 1)} </span>
                    {s}
                  </span>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      ) : null}

      {ex.contraindications ? <Notice tone="yellow" title={t.contraindications}>{ex.contraindications}</Notice> : null}

      <Card>
        <CardBody>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm text-ink-3">{t.zones}</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {ex.zones.length ? ex.zones.map((z) => <Badge key={z}>{zoneLabel(z)}</Badge>) : <span className="font-semibold">{t.zonesNone}</span>}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-3">{t.equipment}</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {ex.equipment.length
                  ? ex.equipment.map((e) => <Badge key={e}>{label(EQUIPMENT, e)}</Badge>)
                  : <span className="font-semibold">{EQUIPMENT.none}</span>}
              </dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      {credit ? <p className="text-sm text-ink-3">{t.credit}: {credit}</p> : null}
    </article>
  );
}
