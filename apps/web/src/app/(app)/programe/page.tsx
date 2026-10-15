import Link from "next/link";
import { ChevronRight, ListChecks, Plus } from "lucide-react";
import { PROGRAM_KINDS, label } from "@club/shared";
import { requireRole } from "@/lib/auth";
import { getT } from "@/messages";
import { cn } from "@/lib/cn";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/status";
import { TabLinks } from "@/components/ui/misc";
import { listProgramSummaries, type ProgramSummary } from "@/components/planning/queries";

export const metadata = { title: "Programe" };

type Search = { tip?: string; arhivate?: string };

/** Programele clubului: șabloane și programe proprii (doar preparatorul). */
export default async function ProgramsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const { db, ctx } = await requireRole("physio");
  const t = getT().planning.programs;

  const all = await listProgramSummaries(db, ctx.today);
  const kind = sp.tip && sp.tip in PROGRAM_KINDS ? sp.tip : "";
  const showArchived = sp.arhivate === "1";
  const archivedCount = all.filter((p) => !p.is_active).length;
  const pool = showArchived ? all : all.filter((p) => p.is_active);
  const shown = kind ? pool.filter((p) => p.kind === kind) : pool;

  const href = (tip: string, arhivate = showArchived) => {
    const q = new URLSearchParams();
    if (tip) q.set("tip", tip);
    if (arhivate) q.set("arhivate", "1");
    const s = q.toString();
    return s ? `/programe?${s}` : "/programe";
  };
  const kinds = Object.keys(PROGRAM_KINDS).filter((k) => pool.some((p) => p.kind === k));
  const tabs = [
    { key: "", href: href(""), label: `${t.allKinds} (${pool.length})` },
    ...kinds.map((k) => ({ key: k, href: href(k), label: `${label(PROGRAM_KINDS, k)} (${pool.filter((p) => p.kind === k).length})` })),
  ];
  const sections = [
    { title: t.templates, programs: shown.filter((p) => p.is_template) },
    { title: t.own, programs: shown.filter((p) => !p.is_template) },
  ].filter((s) => s.programs.length);

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        action={<LinkButton href="/programe/nou" variant="primary" icon={<Plus className="size-5" aria-hidden />}>{t.add}</LinkButton>}
      />
      {all.length ? (
        <>
          <TabLinks tabs={tabs} current={kind} className="mb-4" />
          {sections.length ? (
            <div className="space-y-6">
              {sections.map((s) => (
                <section key={s.title}>
                  <h2 className="mb-2 text-lg">{s.title} <span className="font-normal text-ink-3">({s.programs.length})</span></h2>
                  <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {s.programs.map((p) => <ProgramCard key={p.id} program={p} />)}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <EmptyState title={t.empty.filtered} action={<LinkButton href={href("")}>{t.allKinds}</LinkButton>} />
          )}
          {archivedCount ? (
            <p className="mt-6">
              <Link href={href(kind, !showArchived)} className="inline-flex h-12 items-center font-semibold text-ink-2 underline underline-offset-2">
                {showArchived ? t.hideArchived : `${t.showArchived} (${archivedCount})`}
              </Link>
            </p>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon={<ListChecks className="size-8" aria-hidden />}
          title={t.empty.title}
          description={t.empty.description}
          action={<LinkButton href="/programe/nou" variant="primary">{t.add}</LinkButton>}
        />
      )}
    </>
  );
}

function ProgramCard({ program: p }: { program: ProgramSummary }) {
  const t = getT().planning.programs;
  return (
    <li>
      <Link href={`/programe/${p.id}`}
        className={cn("flex h-full items-start gap-3 rounded-[var(--radius-card)] border border-line p-3 hover:border-line-strong hover:bg-canvas", p.is_active ? "bg-surface" : "bg-canvas")}>
        <span className="min-w-0 flex-1">
          <span className="block font-bold leading-snug">{p.name}</span>
          {p.description ? <span className="mt-0.5 line-clamp-2 text-sm text-ink-3">{p.description}</span> : null}
          <span className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge tone="outline">{label(PROGRAM_KINDS, p.kind)}</Badge>
            <Badge tone="gray">{t.exercises(p.exerciseCount)}</Badge>
            <Badge tone={p.activeAssignments ? "blue" : "outline"}>{t.activeAssignments(p.activeAssignments)}</Badge>
            {!p.is_active ? <Badge tone="gray">{t.archived}</Badge> : null}
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 self-center text-ink-3" aria-hidden />
      </Link>
    </li>
  );
}
