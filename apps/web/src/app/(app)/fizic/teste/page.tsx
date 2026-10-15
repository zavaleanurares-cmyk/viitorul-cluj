import Link from "next/link";
import { ClipboardPen, Timer, Users } from "lucide-react";
import { can, formatDateShort, listPlayers } from "@club/shared";
import { requireCapability, visibleGroups } from "@/lib/auth";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader, Stat } from "@/components/ui/card";
import { TableWrap, TabLinks } from "@/components/ui/misc";
import { getT } from "@/messages";
import { Delta } from "@/components/physical/delta";
import { compare, formatValue } from "@/components/physical/domain";
import { groupAverages, listResults, listTests } from "@/components/physical/queries";
import { SectionNav } from "@/components/physical/section-nav";
import { TestsManager } from "@/components/physical/tests-manager";

/** Teste fizice pe grupă: ultimul rezultat al fiecărui jucător, clasament, media grupei, diferența față de testarea anterioară. */
export default async function Page({ searchParams }: { searchParams: Promise<{ grupa?: string; test?: string }> }) {
  const { db, ctx } = await requireCapability("viewPhysicalData");
  const sp = await searchParams;
  const t = getT().physical;
  const tt = t.tests;
  const canEdit = can(ctx.role, "manage");
  const groups = visibleGroups(ctx);

  if (!groups.length) {
    return (
      <>
        <PageHeader title={t.title} />
        <EmptyState
          icon={<Users className="size-8" aria-hidden />}
          title={ctx.role === "coach" ? t.noGroupsCoachTitle : t.noGroupsTitle}
          description={ctx.role === "coach" ? t.noGroupsCoach : t.noGroups}
        />
      </>
    );
  }

  const group = groups.find((g) => g.id === sp.grupa) ?? groups[0];
  const allTests = await listTests(db, { includeInactive: true });
  const tests = allTests.filter((x) => x.is_active || x.id === sp.test);
  const test = tests.find((x) => x.id === sp.test) ?? tests.find((x) => x.is_active) ?? null;
  const players = await listPlayers(db, { groupId: group.id });
  const ids = players.map((p) => p.id);
  const [results, averages] = await Promise.all([
    test ? listResults(db, ids, test.id) : Promise.resolve([]),
    groupAverages(db, group.id),
  ]);

  const href = (g: string, testId?: string | null) => {
    const p = new URLSearchParams();
    if (g !== groups[0].id) p.set("grupa", g);
    if (testId) p.set("test", testId);
    const s = p.toString();
    return s ? `/fizic/teste?${s}` : "/fizic/teste";
  };

  // ultimul rezultat și cel dinainte, pe jucător (rezultatele vin cele mai noi primele)
  const byPlayer = new Map<string, { last: (typeof results)[number]; previous: (typeof results)[number] | null }>();
  for (const r of results) {
    const cur = byPlayer.get(r.player_id);
    if (!cur) byPlayer.set(r.player_id, { last: r, previous: null });
    else if (!cur.previous) cur.previous = r;
  }
  const lower = test?.lower_is_better ?? false;
  const ranked = players
    .filter((p) => byPlayer.has(p.id))
    .map((p) => ({ player: p, ...byPlayer.get(p.id)! }))
    .sort((a, b) => (lower ? a.last.value - b.last.value : b.last.value - a.last.value) || a.player.display_name.localeCompare(b.player.display_name, "ro"));
  const untested = players.filter((p) => !byPlayer.has(p.id));
  const avg = test ? averages.get(test.id) ?? null : null;
  const lastDate = ranked.reduce<string | null>((d, r) => (!d || r.last.tested_on > d ? r.last.tested_on : d), null);
  const entryHref = test ? `/fizic/teste/rezultate?grupa=${group.id}&test=${test.id}` : null;

  return (
    <>
      <PageHeader
        title={t.title}
        description={tt.description(group.name)}
        action={
          canEdit ? (
            <div className="flex max-w-[calc(100vw-2rem)] flex-wrap gap-2">
              <TestsManager tests={allTests.map((x) => ({ id: x.id, name: x.name, unit: x.unit, lower_is_better: x.lower_is_better, is_active: x.is_active }))} />
              {entryHref ? <LinkButton href={entryHref} variant="primary" icon={<ClipboardPen className="size-5" aria-hidden />}>{tt.enter}</LinkButton> : null}
            </div>
          ) : undefined
        }
      />
      <SectionNav
        current="teste"
        groups={groups}
        groupId={group.id}
        hrefFor={(section, g) => (section === "teste" ? href(g, test?.id) : `/fizic${g === groups[0].id ? "" : `?grupa=${g}`}`)}
      />

      {!test ? (
        <EmptyState icon={<Timer className="size-8" aria-hidden />} title={tt.noTestsTitle} description={canEdit ? tt.noTestsPhysio : tt.noTestsCoach} />
      ) : (
        <div className="space-y-4">
          <TabLinks tabs={tests.map((x) => ({ key: x.id, href: href(group.id, x.id), label: x.name }))} current={test.id} />

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Stat
              label={tt.groupAverage}
              value={avg ? <>{formatValue(avg.average)} <span className="text-lg font-normal text-ink-3">{test.unit}</span></> : "—"}
              hint={avg ? tt.averageOf(avg.players) : tt.averageMissing}
            />
            <Stat
              label={tt.best}
              value={ranked.length ? <>{formatValue(ranked[0].last.value)} <span className="text-lg font-normal text-ink-3">{test.unit}</span></> : "—"}
              hint={ranked.length ? ranked[0].player.display_name : undefined}
            />
            <Stat label={tt.tested} value={`${ranked.length}/${players.length}`} hint={tt.testedHint} />
            <Stat label={tt.lastTesting} value={lastDate ? <span className="text-2xl sm:text-3xl">{formatDateShort(lastDate)}</span> : "—"} hint={test.lower_is_better ? tt.lowerBetter : tt.higherBetter} />
          </div>

          {ranked.length ? (
            <TableWrap>
              <caption className="sr-only">{tt.caption(test.name, group.name)}</caption>
              <thead>
                <tr>
                  <th scope="col" className="w-10 px-2! text-right">#</th>
                  <th scope="col">{tt.colPlayer}</th>
                  <th scope="col" className="text-right">{tt.colResult(test.unit)}</th>
                  <th scope="col">{tt.colDate}</th>
                  <th scope="col">{tt.colVsPrevious}</th>
                  <th scope="col">{tt.colVsAverage}</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((r, i) => (
                  <tr key={r.player.id}>
                    <td className="px-2! text-right text-ink-3">{i + 1}</td>
                    <th scope="row" className="border-t border-line text-base! font-semibold! whitespace-nowrap text-ink!">
                      <Link href={`/lot/jucatori/${r.player.id}/fizic`} className="hover:underline">{r.player.display_name}</Link>
                    </th>
                    <td className="text-right text-lg font-bold whitespace-nowrap">{formatValue(r.last.value)}</td>
                    <td className="whitespace-nowrap text-ink-2">{formatDateShort(r.last.tested_on)}</td>
                    <td>
                      {r.previous ? (
                        <span title={tt.previousTitle(formatValue(r.previous.value), test.unit, formatDateShort(r.previous.tested_on))}>
                          <Delta cmp={compare(r.last.value, r.previous.value, lower)} unit={test.unit} />
                        </span>
                      ) : <span className="text-ink-3">{tt.firstResult}</span>}
                    </td>
                    <td><Delta cmp={avg ? compare(r.last.value, avg.average, lower) : null} unit={test.unit} /></td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          ) : (
            <EmptyState
              icon={<Timer className="size-8" aria-hidden />}
              title={tt.emptyTitle(test.name)}
              description={canEdit ? tt.emptyPhysio : tt.emptyCoach}
              action={canEdit && entryHref ? <LinkButton href={entryHref} variant="primary">{tt.enter}</LinkButton> : undefined}
            />
          )}

          {ranked.length && untested.length ? (
            <p className="text-sm text-ink-3">{tt.untested(untested.length)}: {untested.map((p) => p.display_name).join(", ")}.</p>
          ) : null}
          <p className="text-sm text-ink-3">{tt.legend}</p>
        </div>
      )}
    </>
  );
}
