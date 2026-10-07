import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil } from "lucide-react";
import { SESSION_TYPES, can, formatDate, label } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { getT } from "@/messages";
import { MetricsTable } from "@/components/physical/metrics-table";
import { getSessionDetail } from "@/components/physical/queries";
import { SessionDeleteButton } from "@/components/physical/session-delete";

/** O sesiune: tabel jucători × indicatori, sortabil, cu media și maximul pe coloană. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, ctx } = await requireCapability("viewPhysicalData");
  const detail = await getSessionDetail(db, id);
  if (!detail) notFound();
  const { session, rows } = detail;
  const t = getT().physical;
  const canEdit = can(ctx.role, "manage");
  const group = ctx.groups.find((g) => g.id === session.group_id);
  const backHref = group ? `/fizic?grupa=${group.id}` : "/fizic";
  const typeLabel = label(SESSION_TYPES, session.session_type);

  return (
    <>
      <PageHeader
        back={
          <Link href={backHref} className="inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink">
            <ChevronLeft className="size-5" aria-hidden /> {t.session.back}
          </Link>
        }
        title={session.name || typeLabel}
        description={[
          formatDate(session.session_date, { weekday: true }),
          typeLabel,
          group?.name ?? t.list.noGroup,
          session.duration_min ? t.list.minutes(session.duration_min) : null,
          t.sources[session.source as keyof typeof t.sources] ?? session.source,
        ].filter(Boolean).join(" · ")}
        action={
          canEdit ? (
            <div className="flex max-w-[calc(100vw-2rem)] flex-wrap gap-2">
              <SessionDeleteButton sessionId={session.id} backHref={backHref} rows={rows.length} />
              <LinkButton href={`/fizic/sesiuni/${session.id}/modifica`} icon={<Pencil className="size-5" aria-hidden />}>{t.session.edit}</LinkButton>
            </div>
          ) : undefined
        }
      />
      {rows.length ? (
        <>
          <MetricsTable rows={rows} sessionId={session.id} canEdit={canEdit} />
          <p className="mt-2 text-sm text-ink-3">{t.session.legend}</p>
        </>
      ) : (
        <EmptyState
          title={t.session.emptyTitle}
          description={canEdit ? t.session.emptyPhysio : t.session.emptyCoach}
          action={canEdit ? <LinkButton href={`/fizic/sesiuni/${session.id}/modifica`}>{t.session.edit}</LinkButton> : undefined}
        />
      )}
    </>
  );
}
