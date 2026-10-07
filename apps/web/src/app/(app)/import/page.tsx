import Link from "next/link";
import { Activity, ChevronLeft, ChevronRight, ClipboardList, HeartPulse, Timer, Upload, Users } from "lucide-react";
import { IMPORT_KINDS, formatDateTime } from "@club/shared";
import { requireRole } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/status";
import { getT } from "@/messages";
import { listImports, loadImportContext } from "@/components/imports/queries";
import { KIND_BY_SLUG, KIND_SLUGS, isKindSlug, type ImportKind } from "@/components/imports/types";
import { ImportWizard } from "@/components/imports/wizard";

const ICONS: Record<ImportKind, typeof Upload> = {
  health_status: HeartPulse,
  fatigue_grid: ClipboardList,
  roster: Users,
  physical: Activity,
  tests: Timer,
};

const GRID = "md:grid-cols-[9.5rem_11rem_minmax(0,1fr)_minmax(0,0.7fr)_5.5rem_4.5rem_6.5rem_1.25rem]";

/** Importuri: alegerea tipului și istoricul; cu `?tip=…`, asistentul de import pentru acel tip. */
export default async function Page({ searchParams }: { searchParams: Promise<{ tip?: string }> }) {
  const { db, ctx } = await requireRole("physio");
  const { tip } = await searchParams;
  const t = getT().imports;

  if (isKindSlug(tip)) {
    const kind = KIND_BY_SLUG[tip];
    const context = await loadImportContext(db, ctx);
    return (
      <>
        <PageHeader
          title={t.kinds[kind].title}
          description={t.kinds[kind].description}
          back={(
            <Link href="/import" className="inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink">
              <ChevronLeft className="size-5" aria-hidden />{t.title}
            </Link>
          )}
        />
        <ImportWizard key={kind} kind={kind} context={context} />
      </>
    );
  }

  const imports = await listImports(db);
  return (
    <>
      <PageHeader title={t.title} description={t.description} />

      <h2 className="mb-2 text-lg">{t.chooseKind}</h2>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {KIND_SLUGS.map((slug) => {
          const kind = KIND_BY_SLUG[slug];
          const Icon = ICONS[kind];
          return (
            <li key={slug}>
              <Link
                href={`/import?tip=${slug}`}
                className="flex h-full min-h-24 items-start gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 hover:border-line-strong hover:bg-canvas"
              >
                <Icon className="mt-0.5 size-6 shrink-0 text-ink-3" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-semibold">{t.kinds[kind].title}</span>
                  <span className="mt-0.5 block text-sm text-ink-3">{t.kinds[kind].description}</span>
                </span>
                <ChevronRight className="mt-1 size-5 shrink-0 text-ink-3" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>

      <h2 className="mb-2 mt-8 text-lg">{t.history.title}</h2>
      {!imports.length ? (
        <EmptyState icon={<Upload className="size-8" aria-hidden />} title={t.history.emptyTitle} description={t.history.emptyDescription} />
      ) : (
        <div className="rounded-[var(--radius-card)] border border-line bg-surface">
          <div className={`hidden gap-3 border-b border-line bg-canvas px-4 py-2 text-sm font-semibold text-ink-3 md:grid ${GRID}`}>
            <span>{t.history.date}</span><span>{t.history.kind}</span><span>{t.history.file}</span><span>{t.history.by}</span>
            <span className="text-right">{t.history.imported}</span><span className="text-right">{t.history.skipped}</span>
            <span className="text-right">{t.history.flagged}</span><span />
          </div>
          <ul className="divide-y divide-line">
            {imports.map((i) => (
              <li key={i.id}>
                <Link href={`/import/${i.id}`} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-canvas md:py-2 ${GRID}`}>
                  <span className="order-2 col-span-2 text-sm text-ink-3 md:order-none md:col-span-1 md:text-base md:text-ink">{formatDateTime(i.created_at, ctx.settings.timezone)}</span>
                  <span className="order-1 font-semibold md:order-none">{IMPORT_KINDS[i.kind] ?? i.kind}</span>
                  <span className="order-3 col-span-2 min-w-0 truncate md:order-none md:col-span-1">{i.filename ?? "—"}</span>
                  <span className="hidden min-w-0 truncate text-ink-3 md:block">{i.created_by_name ?? "—"}</span>
                  <span className="order-4 col-span-2 flex flex-wrap gap-1.5 md:hidden">
                    <Badge tone="green">{t.history.importedN(i.rows_imported)}</Badge>
                    {i.rows_skipped ? <Badge>{t.history.skippedN(i.rows_skipped)}</Badge> : null}
                    {i.rows_flagged ? <Badge tone="orange">{t.history.flaggedN(i.rows_flagged)}</Badge> : null}
                  </span>
                  <span className="hidden text-right font-semibold tabular-nums md:block">{i.rows_imported}</span>
                  <span className="hidden text-right tabular-nums text-ink-3 md:block">{i.rows_skipped || "—"}</span>
                  <span className="hidden text-right tabular-nums md:block">{i.rows_flagged ? <Badge tone="orange">{i.rows_flagged}</Badge> : <span className="text-ink-3">—</span>}</span>
                  <ChevronRight className="order-1 size-5 justify-self-end text-ink-3 md:order-none" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
