import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { addDays, ageOn, can, formatDateShort } from "@club/shared";
import { requireCapability, visibleGroups } from "@/lib/auth";
import { EmptyState, Notice, PageHeader } from "@/components/ui/card";
import { TabLinks, TableWrap } from "@/components/ui/misc";
import { NavSelect } from "@/components/planning/nav-select";
import { Sparkline } from "@/components/charts/acwr";
import { BodyGrid } from "@/components/performance/body-grid";
import { getT } from "@/messages";

export const metadata = { title: "Greutate" };

type M = { player_id: string; measured_on: string; weight_kg: number | null; height_cm: number | null; body_fat_pct: number | null };
const kg = (n: number | null) => (n === null ? "—" : n.toLocaleString("ro-RO", { maximumFractionDigits: 1 }));

/**
 * Greutatea pe echipă. Jucătorii sub vârsta setată de club (implicit 14 ani) nu apar deloc:
 * la copii, cântărirea periodică nu aduce informație utilă și poate face rău.
 */
export default async function BodyPage({ searchParams }: { searchParams: Promise<{ echipa?: string; vedere?: string; data?: string }> }) {
  const { db, ctx } = await requireCapability("viewWellnessGrid");
  const sp = await searchParams;
  const t = getT().performance.body;
  const teams = visibleGroups(ctx);
  const team = teams.find((g) => g.id === sp.echipa) ?? teams[0] ?? null;
  const canManage = can(ctx.role, "manage");
  const view = canManage && sp.vedere === "grila" ? "grid" : "list";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.data ?? "") && sp.data! <= ctx.today ? sp.data! : ctx.today;
  const minAge = ctx.settings.body_min_age;

  const { data: players } = team
    ? await db.from("players").select("id, display_name, birth_date").eq("group_id", team.id).eq("is_active", true).is("anonymized_at", null).order("display_name")
    : { data: [] };
  const tracked = (players ?? []).filter((p) => (ageOn(p.birth_date, ctx.today) ?? 99) >= minAge);
  const underAge = (players ?? []).length - tracked.length;
  const ids = tracked.map((p) => p.id);
  const { data: ms } = ids.length
    ? await db.from("anthropometrics").select("player_id, measured_on, weight_kg, height_cm, body_fat_pct").in("player_id", ids).order("measured_on").limit(10000)
    : { data: [] };
  const byPlayer = new Map<string, M[]>();
  for (const m of (ms ?? []) as M[]) byPlayer.set(m.player_id, [...(byPlayer.get(m.player_id) ?? []), m]);

  const base = `/performanta/corp?echipa=${team?.id ?? ""}`;
  const rows = tracked.map((p) => {
    const list = (byPlayer.get(p.id) ?? []).filter((m) => m.weight_kg !== null);
    const last = list[list.length - 1] ?? null;
    const prev = list[list.length - 2] ?? null;
    const fourWeeks = [...list].reverse().find((m) => last && m.measured_on <= addDays(last.measured_on, -28)) ?? null;
    const delta = last && prev ? Math.round((last.weight_kg! - prev.weight_kg!) * 10) / 10 : null;
    const pct4w = last && fourWeeks && fourWeeks.weight_kg ? ((last.weight_kg! - fourWeeks.weight_kg) / fourWeeks.weight_kg) * 100 : null;
    const recent = list.filter((m) => m.measured_on >= addDays(ctx.today, -183)).map((m) => m.weight_kg!);
    const onDate = (byPlayer.get(p.id) ?? []).find((m) => m.measured_on === date) ?? null;
    const before = [...list].reverse().find((m) => m.measured_on < date) ?? null;
    return { p, last, delta, rapid: pct4w !== null && Math.abs(pct4w) >= 3, recent, onDate, before };
  });

  return (
    <>
      <PageHeader title={t.title} description={t.description}
        action={teams.length > 1 ? (
          <NavSelect label={t.team} value={team?.id ?? ""} className="w-full sm:w-56"
            options={teams.map((g) => ({ value: g.id, label: g.name, href: `/performanta/corp?echipa=${g.id}${view === "grid" ? "&vedere=grila" : ""}` }))} />
        ) : undefined} />
      {canManage ? (
        <TabLinks className="mb-4" current={view} tabs={[
          { key: "list", href: base, label: t.title },
          { key: "grid", href: `${base}&vedere=grila`, label: t.entry },
        ]} />
      ) : null}
      {underAge ? <Notice tone="gray" className="mb-4">{t.underAge(underAge, minAge)}</Notice> : null}

      {!tracked.length ? <EmptyState title={t.noTeamPlayers} /> : view === "grid" ? (
        <BodyGrid date={date} today={ctx.today} dateHref={`${base}&vedere=grila`}
          rows={rows.map((r) => ({
            id: r.p.id, name: r.p.display_name,
            weight: r.onDate?.weight_kg ?? null, height: r.onDate?.height_cm ?? null, fat: r.onDate?.body_fat_pct ?? null,
            prevWeight: r.before?.weight_kg ?? null,
          }))} />
      ) : !rows.some((r) => r.last) ? <EmptyState title={t.empty} description={t.emptyText} /> : (
        <TableWrap>
          <>
            <thead>
              <tr>
                <th scope="col">{t.cols.player}</th>
                <th scope="col" className="text-right">{t.cols.weight}</th>
                <th scope="col" className="text-right">{t.cols.change}</th>
                <th scope="col">{t.cols.trend}</th>
                <th scope="col">{t.cols.last}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.p.id}>
                  <td>
                    <Link href={`/lot/jucatori/${r.p.id}/stare`} className="font-semibold hover:underline">{r.p.display_name}</Link>
                    {r.rapid ? (
                      <span className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-ink" title={t.rapidHelp}>
                        <TriangleAlert className="size-4 text-st-orange" aria-hidden />{t.rapid}
                      </span>
                    ) : null}
                  </td>
                  <td className="text-right tabular-nums font-semibold">{kg(r.last?.weight_kg ?? null)}</td>
                  <td className="text-right tabular-nums">{r.delta === null ? "—" : `${r.delta > 0 ? "+" : r.delta < 0 ? "−" : ""}${kg(Math.abs(r.delta))}`}</td>
                  <td><Sparkline values={r.recent} label={`${t.cols.trend}: ${r.recent.map((v) => kg(v)).join(", ")}`} /></td>
                  <td className="whitespace-nowrap text-sm">{r.last ? formatDateShort(r.last.measured_on) : t.never}</td>
                </tr>
              ))}
            </tbody>
          </>
        </TableWrap>
      )}
    </>
  );
}
