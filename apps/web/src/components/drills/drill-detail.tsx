import { ExternalLink } from "lucide-react";
import { DataList } from "@/components/ui/misc";
import { getT } from "@/messages";
import { diagramCounts } from "./diagram-schema";
import { PitchSvg } from "./pitch-svg";
import { drillMinutes, type DrillRow } from "./queries";

/** Conținutul unei secțiuni: schema, detaliile tehnice, organizarea, imaginile. Folosit în pagina ei și în planul tipărit. */
export function DrillDetail({ drill, compact = false }: { drill: DrillRow; compact?: boolean }) {
  const t = getT().drills;
  const f = t.form;
  const minutes = drillMinutes(drill);
  const facts = [
    drill.age_group ? { label: f.ageGroup, value: drill.age_group } : null,
    drill.kind ? { label: f.kind, value: drill.kind } : null,
    drill.category ? { label: f.category, value: t.categories[drill.category as keyof typeof t.categories] ?? drill.category } : null,
    drill.players != null || drill.goalkeepers != null ? { label: `${f.players} / ${f.goalkeepers.toLowerCase()}`, value: t.playersGk(drill.players, drill.goalkeepers) } : null,
    drill.intensity ? { label: f.intensity, value: `${drill.intensity} · ${t.intensity[drill.intensity]}` } : null,
    drill.reps && drill.work_min ? { label: f.reps, value: t.reps(drill.reps, drill.work_min, drill.rest_sec ?? 0) } : null,
    minutes ? { label: f.total, value: t.minutes(minutes) } : null,
    drill.area ? { label: f.area, value: drill.area } : null,
    drill.equipment ? { label: f.equipment, value: drill.equipment } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;
  const c = drill.diagram ? diagramCounts(drill.diagram) : null;

  return (
    <div className={compact ? "grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] print:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]" : "space-y-4"}>
      {drill.diagram?.items.length && c ? (
        <PitchSvg diagram={drill.diagram} uid={`v${drill.id.slice(0, 8)}`} label={t.editor.summary(c.players, c.others, c.arrows)}
          className="block w-full rounded-[var(--radius-control)] print:break-inside-avoid" />
      ) : null}
      <div className="min-w-0 space-y-4">
        {facts.length ? <DataList items={facts} /> : null}
        {drill.organization ? (
          <div>
            <h3 className="mb-1 text-sm font-semibold text-ink-2">{f.organization}</h3>
            <p className="whitespace-pre-line">{drill.organization}</p>
          </div>
        ) : null}
        {drill.criteria ? (
          <div>
            <h3 className="mb-1 text-sm font-semibold text-ink-2">{f.criteria}</h3>
            <p className="whitespace-pre-line">{drill.criteria}</p>
          </div>
        ) : null}
      </div>
      {drill.image_paths.length ? (
        <div className={compact ? "md:col-span-2 print:col-span-2" : ""}>
          <h3 className="mb-2 text-sm font-semibold text-ink-2">{t.view.images}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {drill.image_paths.map((p) => (
              <a key={p} href={`/api/files/drills/${p}`} target="_blank" rel="noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/files/drills/${p}`} alt="" loading="lazy" className="w-full rounded-[var(--radius-control)] bg-sunken object-contain print:break-inside-avoid" />
              </a>
            ))}
          </div>
        </div>
      ) : null}
      {drill.video_url ? (
        <a href={drill.video_url} target="_blank" rel="noreferrer" className="no-print inline-flex items-center gap-1 font-semibold text-st-blue hover:underline">
          {t.view.openVideo}<ExternalLink className="size-4" aria-hidden />
        </a>
      ) : null}
    </div>
  );
}
