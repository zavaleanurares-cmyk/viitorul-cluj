import Link from "next/link";
import { ChevronLeft, Timer } from "lucide-react";
import { listPlayers } from "@club/shared";
import { requireRole, visibleGroups } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { getT } from "@/messages";
import { isIsoDate } from "@/components/physical/domain";
import { listResults, listTests } from "@/components/physical/queries";
import { ResultsForm } from "@/components/physical/results-form";

/** Introducerea rapidă a rezultatelor unei testări pentru toată grupa (doar preparatorul). */
export default async function Page({ searchParams }: { searchParams: Promise<{ grupa?: string; test?: string; data?: string }> }) {
  const { db, ctx } = await requireRole("physio");
  const sp = await searchParams;
  const t = getT().physical;
  const groups = visibleGroups(ctx);
  const tests = await listTests(db);
  const group = groups.find((g) => g.id === sp.grupa) ?? groups[0] ?? null;
  const test = tests.find((x) => x.id === sp.test) ?? tests[0] ?? null;
  const date = isIsoDate(sp.data) && sp.data <= ctx.today ? sp.data : ctx.today;
  const backHref = group && test ? `/fizic/teste?grupa=${group.id}&test=${test.id}` : "/fizic/teste";
  const back = (
    <Link href={backHref} className="inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink">
      <ChevronLeft className="size-5" aria-hidden /> {t.results.backToTests}
    </Link>
  );

  if (!group || !test) {
    return (
      <>
        <PageHeader back={back} title={t.results.title} />
        <EmptyState icon={<Timer className="size-8" aria-hidden />} title={t.tests.noTestsTitle} description={t.tests.noTestsPhysio} />
      </>
    );
  }

  const players = await listPlayers(db, { groupId: group.id });
  const results = await listResults(db, players.map((p) => p.id), test.id);
  const rows = players.map((p) => {
    const mine = results.filter((r) => r.player_id === p.id);
    const current = mine.find((r) => r.tested_on === date)?.value ?? null;
    const previous = mine.find((r) => r.tested_on < date) ?? null;
    return { id: p.id, name: p.display_name, current, previous: previous ? { value: previous.value, tested_on: previous.tested_on } : null };
  });

  return (
    <>
      <PageHeader back={back} title={t.results.title} description={t.results.description} />
      <ResultsForm
        key={`${group.id}:${test.id}:${date}`}
        groups={groups.map((g) => ({ id: g.id, name: g.name }))}
        groupId={group.id}
        tests={tests.map((x) => ({ id: x.id, name: x.name, unit: x.unit, lower_is_better: x.lower_is_better }))}
        testId={test.id}
        date={date}
        today={ctx.today}
        players={rows}
        backHref={backHref}
      />
    </>
  );
}
