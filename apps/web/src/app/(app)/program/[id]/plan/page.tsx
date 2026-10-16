import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil } from "lucide-react";
import { can, formatDateTime, formatEventWhen } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/card";
import { DataList } from "@/components/ui/misc";
import { PrintButton } from "@/components/players/print-button";
import { DrillDetail } from "@/components/drills/drill-detail";
import { PlanEditor } from "@/components/drills/plan-editor";
import { drillMinutes, getPlan, listDrills } from "@/components/drills/queries";
import { getEvent } from "@/components/schedule/queries";
import { getT } from "@/messages";

export const metadata = { title: "Planul antrenamentului" };

/** Planul unui antrenament: citire (și tipărire) pentru tot staff-ul, modificare pentru cine conduce antrenamentul. */
export default async function PlanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ modifica?: string }> }) {
  const { db, ctx } = await requireCapability("viewSchedule");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const e = await getEvent(db, id);
  if (!e || e.kind !== "training") notFound();
  const t = getT().drills.plan;
  const td = getT().drills;
  const tz = ctx.settings.timezone;
  const runs = can(ctx.role, "manageSchedule") || (ctx.role === "coach" && e.groupIds.some((g) => ctx.staffGroupIds.includes(g)));
  const teams = ctx.groups.filter((g) => e.groupIds.includes(g.id)).map((g) => g.name).join(", ");
  const available = Math.round((Date.parse(e.ends_at) - Date.parse(e.starts_at)) / 60000);
  const [plan, drills] = await Promise.all([getPlan(db, id), listDrills(db, { includeArchived: true })]);
  const editing = runs && (!plan || (await searchParams).modifica === "1");
  const back = (
    <Link href={`/program/${id}`} className="no-print inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink">
      <ChevronLeft className="size-5" aria-hidden />{teams || e.title}
    </Link>
  );
  const subtitle = `${teams} · ${formatEventWhen(e.starts_at, e.ends_at, tz)}${e.venue ? ` · ${e.venue.name}` : ""}`;

  if (editing) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title={t.title} description={subtitle} back={back} />
        <PlanEditor
          eventId={id}
          available={available}
          cancelHref={plan ? `/program/${id}/plan` : `/program/${id}`}
          drills={drills.filter((d) => d.is_active).map((d) => ({ id: d.id, name: d.name, ageGroup: d.age_group, kind: d.kind, minutes: drillMinutes(d), players: d.players, goalkeepers: d.goalkeepers }))}
          initial={{
            theme: plan?.theme ?? "", objectives: plan?.objectives ?? "", description: plan?.description ?? "",
            items: (plan?.items ?? []).map((i) => ({ drillId: i.drill_id, title: i.title, durationMin: i.duration_min, notes: i.notes ?? "" })),
          }}
        />
      </div>
    );
  }

  const byId = new Map(drills.map((d) => [d.id, d]));
  const planned = (plan?.items ?? []).reduce((s, i) => s + (i.duration_min ?? 0), 0);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title={t.title} description={subtitle} back={back}
        action={plan ? (
          <div className="flex flex-wrap gap-2">
            {runs ? <LinkButton href={`/program/${id}/plan?modifica=1`} variant="primary" className="no-print" icon={<Pencil className="size-5" aria-hidden />}>{td.view.edit}</LinkButton> : null}
            <PrintButton label={t.print} />
          </div>
        ) : null} />

      {!plan ? (
        <EmptyState title={t.none} description={t.readonlyNote} />
      ) : (
        <>
          {plan.theme || plan.objectives || plan.description ? (
            <Card>
              <CardBody>
                <DataList items={[
                  ...(plan.theme ? [{ label: t.theme, value: plan.theme }] : []),
                  ...(plan.objectives ? [{ label: t.objectives, value: <span className="whitespace-pre-line">{plan.objectives}</span> }] : []),
                  ...(plan.description ? [{ label: t.description, value: <span className="whitespace-pre-line">{plan.description}</span> }] : []),
                ]} />
              </CardBody>
            </Card>
          ) : null}

          <h2 className="flex items-baseline justify-between gap-3 pt-2 text-xl">
            {t.sections}
            <span className="text-sm font-semibold tabular-nums text-ink-2">{t.total(planned, available)}</span>
          </h2>
          {plan.items.length ? (
            <ol className="space-y-4">
              {plan.items.map((it, i) => {
                const d = it.drill_id ? byId.get(it.drill_id) : null;
                return (
                  <li key={it.id} className="print:break-inside-avoid">
                    <Card>
                      <CardHeader
                        className={d ? undefined : "pb-4 md:pb-5"}
                        title={<span><span className="tabular-nums text-ink-3">{i + 1}.</span> {it.title}</span>}
                        description={it.notes ?? undefined}
                        action={it.duration_min ? <span className="whitespace-nowrap font-semibold tabular-nums">{td.minutes(it.duration_min)}</span> : null}
                      />
                      {d ? <CardBody><DrillDetail drill={d} compact /></CardBody> : null}
                    </Card>
                  </li>
                );
              })}
            </ol>
          ) : <p className="text-ink-3">{t.sectionsEmpty}</p>}
          {plan.updated_by ? <p className="text-sm text-ink-3">{t.updated(plan.updated_by, formatDateTime(plan.updated_at, tz))}</p> : null}
        </>
      )}
    </div>
  );
}
