import Link from "next/link";
import { Dumbbell, Plus } from "lucide-react";
import { BODY_ZONES, EQUIPMENT, EXERCISE_CATEGORIES, EXERCISE_LEVELS, label, norm, zoneLabel } from "@club/shared";
import { requireRole } from "@/lib/auth";
import { getT } from "@/messages";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/status";
import { ExerciseThumb } from "@/components/planning/exercise-thumb";
import { exerciseMeta } from "@/components/planning/exercise-picker";
import { LibraryFilters } from "@/components/planning/library-filters";
import { listExerciseOptions } from "@/components/planning/queries";

type Search = { q?: string; zona?: string; categorie?: string; echipament?: string; dezactivate?: string };

/** Biblioteca de exerciții a clubului (doar preparatorul). */
export default async function LibraryPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const { db } = await requireRole("physio");
  const t = getT().library;

  const all = await listExerciseOptions(db);
  const values = {
    q: (sp.q ?? "").slice(0, 100),
    zona: sp.zona ?? "",
    categorie: sp.categorie ?? "",
    echipament: sp.echipament ?? "",
    dezactivate: sp.dezactivate === "1",
  };
  const needle = norm(values.q);
  const pool = values.dezactivate ? all : all.filter((e) => e.is_active);
  const shown = pool.filter((e) =>
    (!needle || norm(e.name).includes(needle)) &&
    (!values.zona || e.zones.includes(values.zona)) &&
    (!values.categorie || e.category === values.categorie) &&
    (!values.echipament || e.equipment.includes(values.echipament)));
  const filtered = !!(needle || values.zona || values.categorie || values.echipament);

  return (
    <>
      <PageHeader
        title={t.title}
        description={filtered ? t.countOf(shown.length, pool.length) : t.count(pool.length)}
        action={<LinkButton href="/biblioteca/nou" variant="primary" icon={<Plus className="size-5" aria-hidden />}>{t.add}</LinkButton>}
      />
      {all.length ? (
        <div className="mb-4">
          <LibraryFilters
            values={values}
            zones={BODY_ZONES.map((z) => ({ value: z.code, label: zoneLabel(z.code, null, true) }))}
            categories={Object.entries(EXERCISE_CATEGORIES).map(([value, l]) => ({ value, label: l }))}
            equipment={Object.entries(EQUIPMENT).map(([value, l]) => ({ value, label: l }))}
          />
        </div>
      ) : null}

      {shown.length ? (
        <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((e) => (
            <li key={e.id}>
              <Link href={`/biblioteca/${e.id}`} className="flex h-full gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-3 hover:border-line-strong hover:bg-canvas">
                <ExerciseThumb imageUrl={e.image_url} hasVideo={e.has_video} className="w-24 self-start" />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold leading-snug">{e.name}</span>
                  <span className="mt-0.5 block text-sm text-ink-2">{exerciseMeta(e)}</span>
                  <span className="block truncate text-sm text-ink-3">
                    {e.equipment.length ? e.equipment.map((c) => label(EQUIPMENT, c)).join(", ") : EQUIPMENT.none}
                  </span>
                  <span className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge tone="outline">{label(EXERCISE_LEVELS, e.level)}</Badge>
                    {!e.has_video ? <Badge tone="gray">{t.noClip}</Badge> : null}
                    {!e.is_active ? <Badge tone="outline" className="border-ink">{t.inactive}</Badge> : null}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : all.length ? (
        <EmptyState
          title={t.empty.filteredTitle}
          description={t.empty.filteredDescription}
          action={<LinkButton href="/biblioteca">{t.filters.reset}</LinkButton>}
        />
      ) : (
        <EmptyState
          icon={<Dumbbell className="size-8" aria-hidden />}
          title={t.empty.title}
          description={t.empty.description}
          action={<LinkButton href="/biblioteca/nou" variant="primary">{t.add}</LinkButton>}
        />
      )}
    </>
  );
}
