import Link from "next/link";
import { ChevronLeft, Layers } from "lucide-react";
import { listPlayers } from "@club/shared";
import { requireRole, visibleGroups } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { NavSelect } from "@/components/planning/nav-select";
import { Field, Input } from "@/components/ui/form";
import { TestGrid } from "@/components/physical/test-grid";
import { getT } from "@/messages";

export const metadata = { title: "Testare" };

/** O testare completă: toată echipa × toate testele bateriei, într-o singură grilă (doar preparatorul). */
export default async function BatteryEntryPage({ searchParams }: { searchParams: Promise<{ grupa?: string; baterie?: string; data?: string }> }) {
  const { db, ctx } = await requireRole("physio");
  const sp = await searchParams;
  const t = getT().performance.tests;
  const groups = visibleGroups(ctx);
  const { data: batteries } = await db.from("fitness_batteries")
    .select("id, name, fitness_battery_tests(sort, fitness_tests(id, name, unit, is_active))").eq("is_active", true).order("sort");
  const group = groups.find((g) => g.id === sp.grupa) ?? groups[0] ?? null;
  const battery = (batteries ?? []).find((b) => b.id === sp.baterie) ?? batteries?.[0] ?? null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.data ?? "") && sp.data! <= ctx.today ? sp.data! : ctx.today;
  const back = (
    <Link href="/fizic/teste" className="inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink">
      <ChevronLeft className="size-5" aria-hidden /> {getT().physical.results.backToTests}
    </Link>
  );
  if (!group || !battery) {
    return (<><PageHeader back={back} title={t.enterBattery} /><EmptyState icon={<Layers className="size-8" aria-hidden />} title={t.noBatteries} description={t.batteriesHint} /></>);
  }
  const tests = [...(battery.fitness_battery_tests ?? [])].sort((a, b) => a.sort - b.sort)
    .map((x) => x.fitness_tests as { id: string; name: string; unit: string; is_active: boolean } | null).filter((x): x is { id: string; name: string; unit: string; is_active: boolean } => !!x);
  const players = await listPlayers(db, { groupId: group.id });
  const { data: results } = players.length && tests.length
    ? await db.from("fitness_test_results").select("player_id, test_id, tested_on, value").in("player_id", players.map((p) => p.id)).in("test_id", tests.map((x) => x.id)).lte("tested_on", date).order("tested_on", { ascending: false })
    : { data: [] };
  const rows = players.map((p) => {
    const mine = (results ?? []).filter((r) => r.player_id === p.id);
    return {
      id: p.id, name: p.display_name,
      values: Object.fromEntries(tests.map((x) => [x.id, mine.find((r) => r.test_id === x.id && r.tested_on === date)?.value ?? null])),
      previous: Object.fromEntries(tests.map((x) => [x.id, mine.find((r) => r.test_id === x.id && r.tested_on < date)?.value ?? null])),
    };
  });
  const href = (o: { grupa?: string; baterie?: string; data?: string }) =>
    `/fizic/teste/baterie?${new URLSearchParams({ grupa: o.grupa ?? group.id, baterie: o.baterie ?? battery.id, data: o.data ?? date }).toString()}`;
  return (
    <>
      <PageHeader back={back} title={t.gridTitle(battery.name)} description={t.gridHint} />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <NavSelect label={t.battery} value={battery.id} options={(batteries ?? []).map((b) => ({ value: b.id, label: b.name, href: href({ baterie: b.id }) }))} />
        {groups.length > 1 ? <NavSelect label={t.team} value={group.id} options={groups.map((g) => ({ value: g.id, label: g.name, href: href({ grupa: g.id }) }))} /> : <div />}
        <form action="/fizic/teste/baterie" className="flex items-end gap-2">
          <input type="hidden" name="grupa" value={group.id} /><input type="hidden" name="baterie" value={battery.id} />
          <Field label={t.date} className="flex-1"><Input type="date" name="data" defaultValue={date} max={ctx.today} /></Field>
          <button type="submit" className="h-11 rounded-full bg-sunken px-4 font-medium transition-colors hover:bg-line">{getT().common.actions.open}</button>
        </form>
      </div>
      <TestGrid key={`${group.id}:${battery.id}:${date}`} tests={tests.map(({ id, name, unit }) => ({ id, name, unit }))} rows={rows} date={date} />
    </>
  );
}
