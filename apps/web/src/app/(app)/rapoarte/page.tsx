import type { ReactNode } from "react";
import { FileSpreadsheet, FileText, Table2 } from "lucide-react";
import { addDays, formatDateShort, listPlayers, weekStart } from "@club/shared";
import { requireRole } from "@/lib/auth";
import { Card, CardBody, Notice, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/status";
import { getT } from "@/messages";
import { PlayerSheetForm, RosterForm, WeeklyForm } from "@/components/reports/export-forms";

const WEEKS = 16;

function ReportCard({ icon, title, formats, summary, items, containsLabel, children }: {
  icon: ReactNode; title: string; formats: string[]; summary: string; items: readonly string[]; containsLabel: string; children: ReactNode;
}) {
  return (
    <Card>
      <CardBody className="grid gap-4">
        <header className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-sunken text-ink-2">{icon}</span>
          <div className="min-w-0">
            <h2 className="flex flex-wrap items-center gap-2 text-lg">
              {title}
              {formats.map((f) => <Badge key={f} tone="outline">{f}</Badge>)}
            </h2>
            <p className="mt-0.5 text-ink-2">{summary}</p>
          </div>
        </header>
        <div>
          <p className="text-sm font-semibold text-ink-3">{containsLabel}</p>
          <ul className="mt-1 list-disc pl-5 text-ink-2 marker:text-ink-3">
            {items.map((it) => <li key={it}>{it}</li>)}
          </ul>
        </div>
        {children}
      </CardBody>
    </Card>
  );
}

/** Exporturi PDF și Excel. Doar preparatorul; rutele de export verifică din nou rolul. */
export default async function Page() {
  const { db, ctx } = await requireRole("physio");
  const t = getT().reports;
  const labels = { pdf: t.download.pdf, xlsx: t.download.xlsx };

  const groups = ctx.groups.filter((g) => g.is_active);
  const players = await listPlayers(db, { includeInactive: true });
  const groupIds = new Set(ctx.groups.map((g) => g.id));
  const byGroup = [
    ...ctx.groups.map((g) => ({ label: g.name, list: players.filter((p) => p.group_id === g.id) })),
    { label: t.playerSheet.noGroup, list: players.filter((p) => !p.group_id || !groupIds.has(p.group_id)) },
  ]
    .filter((g) => g.list.length)
    .map((g) => ({
      label: g.label,
      players: g.list.map((p) => ({
        value: p.id,
        label: `${p.display_name}${p.full_name && p.full_name !== p.display_name ? ` (${p.full_name})` : ""}${p.is_active ? "" : ` · ${t.playerSheet.inactive}`}`,
      })),
    }));

  const thisWeek = weekStart(ctx.today);
  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const monday = addDays(thisWeek, -7 * i);
    const range = t.weekly.weekOption(formatDateShort(monday, false), formatDateShort(addDays(monday, 6)));
    return { value: monday, label: i === 0 ? `${range} · ${t.weekly.currentWeek}` : range };
  });
  const groupOptions = groups.map((g) => ({ value: g.id, label: g.name }));

  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      <Notice tone="yellow" className="mb-4">{t.confidential}</Notice>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <ReportCard icon={<FileText className="size-5" aria-hidden />} title={t.playerSheet.title} formats={["PDF"]}
          summary={t.playerSheet.summary} items={t.playerSheet.items} containsLabel={t.contains}>
          {byGroup.length ? <PlayerSheetForm groups={byGroup} playerLabel={t.playerSheet.player} labels={labels} /> : <p className="text-ink-3">{t.noPlayers}</p>}
        </ReportCard>

        <ReportCard icon={<Table2 className="size-5" aria-hidden />} title={t.weekly.title} formats={["PDF", "Excel"]}
          summary={t.weekly.summary} items={t.weekly.items} containsLabel={t.contains}>
          {groupOptions.length
            ? <WeeklyForm groups={groupOptions} weeks={weeks} groupLabel={t.weekly.group} weekLabel={t.weekly.week} labels={labels} />
            : <p className="text-ink-3">{t.noGroups}</p>}
        </ReportCard>

        <ReportCard icon={<FileSpreadsheet className="size-5" aria-hidden />} title={t.roster.title} formats={["Excel"]}
          summary={t.roster.summary} items={t.roster.items} containsLabel={t.contains}>
          <RosterForm groups={[{ value: "toate", label: t.roster.allGroups }, ...groupOptions]} groupLabel={t.roster.group} labels={labels} />
        </ReportCard>
      </div>
    </>
  );
}
