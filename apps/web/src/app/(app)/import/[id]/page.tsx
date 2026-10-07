import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { IMPORT_KINDS, formatDateTime } from "@club/shared";
import { requireRole } from "@/lib/auth";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { getT } from "@/messages";
import { getImport } from "@/components/imports/queries";
import { ReportView } from "@/components/imports/report-view";
import { SLUG_BY_KIND } from "@/components/imports/types";

/** Raportul unui import din istoric. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { db, ctx } = await requireRole("physio");
  const { id } = await params;
  const t = getT().imports;
  const record = /^[0-9a-f-]{36}$/i.test(id) ? await getImport(db, id) : null;
  if (!record) notFound();

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
