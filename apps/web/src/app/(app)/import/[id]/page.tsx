import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { IMPORT_KINDS, formatDateTime, type TfbReconciliation } from "@club/shared";
import { requireRole } from "@/lib/auth";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { getT } from "@/messages";
import { getImport } from "@/components/imports/queries";
import { ReportView } from "@/components/imports/report-view";
import { StatRow } from "@/components/imports/parts";
import { Reconciliation } from "@/components/imports/tfb-wizard";
import { SLUG_BY_KIND } from "@/components/imports/types";

/** Raportul unui import din istoric. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { db, ctx } = await requireRole("physio");
  const { id } = await params;
  const t = getT().imports;
  const record = /^[0-9a-f-]{36}$/i.test(id) ? await getImport(db, id) : null;
  if (!record) notFound();
  if ((record.kind as string) === "tfb") {
    const tfb = getT().tfb;
    const rec = record.report.reconciliation as TfbReconciliation | undefined;
    const written = (record.report.written ?? {}) as Record<string, number>;
    return (
      <>
        <PageHeader
          title={tfb.kindLabel}
          description={t.report.meta(tfb.report.meta, formatDateTime(record.created_at, ctx.settings.timezone), record.created_by_name)}
          back={(
            <Link href="/import" className="inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink">
              <ChevronLeft className="size-5" aria-hidden />{t.title}
            </Link>
          )}
          action={<LinkButton href="/import/tfb">{tfb.done.again}</LinkButton>}
        />
        <StatRow className="md:grid-cols-5" stats={Object.entries(tfb.done.written).map(([k, label]) => ({ label, value: Number(written[k] ?? 0) + (k === "payments" ? Number(written.payments_existing ?? 0) : 0), tone: "green" as const }))} />
        {rec?.months && rec.teams ? <Reconciliation preview={{ reconciliation: rec }} /> : <p className="mt-4 text-ink-3">{tfb.report.nothing}</p>}
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={record.filename ?? IMPORT_KINDS[record.kind]}
        description={t.report.meta(IMPORT_KINDS[record.kind], formatDateTime(record.created_at, ctx.settings.timezone), record.created_by_name)}
        back={(
          <Link href="/import" className="inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink">
            <ChevronLeft className="size-5" aria-hidden />{t.title}
          </Link>
        )}
        action={<LinkButton href={`/import?tip=${SLUG_BY_KIND[record.kind]}`}>{t.report.again}</LinkButton>}
      />
      <ReportView record={record} />
    </>
  );
}
