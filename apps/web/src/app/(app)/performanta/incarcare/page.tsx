import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { acuteChronicRatio, acwrSeries, acwrZone, addDays, dateRange, formatDateShort, type AcwrZone } from "@club/shared";
import { requireCapability, visibleGroups } from "@/lib/auth";
import { Card, CardBody, EmptyState, Notice, PageHeader } from "@/components/ui/card";
import { TableWrap } from "@/components/ui/misc";
import { NavSelect } from "@/components/planning/nav-select";
import { LoadCharts } from "@/components/charts/acwr";
import { AcwrChip } from "@/components/performance/bits";
import { getT } from "@/messages";

export const metadata = { title: "Încărcare" };

const ORDER: Record<AcwrZone, number> = { high: 0, caution: 1, low: 2, optimal: 3, unknown: 4 };

/**
 * Încărcarea internă (sRPE = RPE × minute) pe echipă: raportul acut:cronic al fiecărui jucător,
 * graficul echipei pe 28 de zile și cine n-a completat RPE-ul după sesiuni.
 */
export default async function LoadPage({ searchParams }: { searchParams: Promise<{ echipa?: string }> }) {
  const { db, ctx } = await requireCapability("viewWellnessGrid");
  const sp = await searchParams;
  const t = getT().performance.load;
  const teams = visibleGroups(ctx);
  const team = teams.find((g) => g.id === sp.echipa) ?? (teams.length === 1 ? teams[0] : null);
  const groupIds = team ? [team.id] : teams.map((g) => g.id);
  const from = addDays(ctx.today, -55);
  const chartFrom = addDays(ctx.today, -27);
  const weekFrom = addDays(ctx.today, -6);

  const { data: players } = groupIds.length
    ? await db.from("players").select("id, display_name, group_id, user_id").in("group_id", groupIds).eq("is_active", true).is("anonymized_at", null).order("display_name")
    : { data: [] };
  const roster = players ?? [];
  const ids = roster.map((p) => p.id);
  const [{ data: rpe }, { data: evs }] = ids.length
    ? await Promise.all([
        db.from("rpe_entries").select("player_id, entry_date, rpe, load").in("player_id", ids).gte("entry_date", from).lte("entry_date", ctx.today).limit(20000),
        db.from("event_teams").select("group_id, events!inner(id, kind, starts_at, status, deleted_at, attendance(player_id, status))")
          .in("group_id", groupIds).gte("events.starts_at", `${weekFrom}T00:00:00Z`).lte("events.starts_at", `${ctx.today}T23:59:59Z`),
      ])
    : [{ data: [] }, { data: [] }];

  const byPlayer = new Map<string, Record<string, number>>();
  const lastEntry = new Map<string, { date: string; rpe: number }>();
  for (const r of rpe ?? []) {
    const m = byPlayer.get(r.player_id) ?? {};
    m[r.entry_date] = (m[r.entry_date] ?? 0) + (r.load ?? 0);
    byPlayer.set(r.player_id, m);
    const l = lastEntry.get(r.player_id);
    if (!l || r.entry_date > l.date) lastEntry.set(r.player_id, { date: r.entry_date, rpe: r.rpe });
  }

  // RPE lipsă: prezent la o sesiune din ultimele 7 zile, fără RPE în ziua aceea
  const tz = ctx.settings.timezone;
  const dayOf = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  const missing = new Map<string, number>();
  type Ev = { id: string; kind: string; starts_at: string; status: string; deleted_at: string | null; attendance: Array<{ player_id: string; status: string }> };
  const seen = new Set<string>();
  for (const row of evs ?? []) {
    const e = row.events as unknown as Ev;
    if (!e || seen.has(e.id) || e.deleted_at || e.status === "cancelled" || !["training", "match"].includes(e.kind) || new Date(e.starts_at) > new Date()) continue;
    seen.add(e.id);
    const d = dayOf(e.starts_at);
    for (const a of e.attendance ?? []) {
      if (a.status !== "present" && a.status !== "late") continue;
      if (!ids.includes(a.player_id)) continue;
      if ((byPlayer.get(a.player_id) ?? {})[d] === undefined) missing.set(a.player_id, (missing.get(a.player_id) ?? 0) + 1);
    }
  }

  const rows = roster.map((p) => {
    const loads = byPlayer.get(p.id) ?? {};
    const r = acuteChronicRatio(loads, ctx.today);
    const sessions = Object.keys(loads).filter((d) => d >= weekFrom).length;
    return { ...p, ...r, zone: acwrZone(r.ratio), sessions, last: lastEntry.get(p.id) ?? null, missing: missing.get(p.id) ?? 0 };
  }).sort((a, b) => ORDER[a.zone] - ORDER[b.zone] || (b.ratio ?? 0) - (a.ratio ?? 0) || a.display_name.localeCompare(b.display_name, "ro"));

  // echipa: media pe jucătorii care au raportat în ziua respectivă
  const teamDaily: Record<string, number> = {};
  for (const d of dateRange(from, ctx.today)) {
    const vals = [...byPlayer.values()].map((m) => m[d]).filter((v): v is number => typeof v === "number");
    if (vals.length) teamDaily[d] = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
  }
  const series = acwrSeries(teamDaily, chartFrom, ctx.today).map((p) => ({ x: formatDateShort(p.date, false), load: p.load || null, ratio: p.ratio }));
  const attention = rows.filter((r) => r.zone === "high" || r.zone === "caution");
  const missingRows = rows.filter((r) => r.missing > 0);
  const teamName = (gid: string | null) => ctx.groups.find((g) => g.id === gid)?.name ?? "—";
  const fmt = (n: number) => n.toLocaleString("ro-RO");

  return (
    <>
      <PageHeader title={t.title} description={t.description}
        action={teams.length > 1 ? (
          <NavSelect label={t.team} value={team?.id ?? ""} className="w-full sm:w-56"
            options={[{ value: "", label: t.allTeams, href: "/performanta/incarcare" }, ...teams.map((g) => ({ value: g.id, label: g.name, href: `/performanta/incarcare?echipa=${g.id}` }))]} />
        ) : undefined} />

      {!rpe?.length ? <EmptyState title={t.empty} description={t.emptyText} /> : (
        <div className="space-y-4">
          {attention.length ? (
            <Notice tone="red" title={t.attention}>{t.attentionText(attention.length)}</Notice>
          ) : null}

          <Card>
            <CardBody><LoadCharts data={series} loadLabel={t.chartLoad} ratioLabel={t.chartRatio} caption={t.chartCaption} /></CardBody>
          </Card>

          <TableWrap>
            <>
              <thead>
                <tr>
                  <th scope="col">{t.cols.player}</th>
                  <th scope="col">{t.cols.ratio}</th>
                  <th scope="col" className="text-right">{t.cols.acute}</th>
                  <th scope="col" className="text-right">{t.cols.chronic}</th>
                  <th scope="col" className="text-right">{t.cols.sessions}</th>
                  <th scope="col">{t.cols.last}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/lot/jucatori/${r.id}/wellness`} className="font-semibold hover:underline">{r.display_name}</Link>
                      {!team ? <span className="block text-sm text-ink-3">{teamName(r.group_id)}</span> : null}
                      {r.missing ? (
                        <span className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-st-red">
                          <CircleAlert className="size-4" aria-hidden />{t.missing(r.missing)}{!r.user_id ? ` · ${t.noAccount}` : ""}
                        </span>
                      ) : null}
                    </td>
                    <td><AcwrChip zone={r.zone} ratio={r.ratio} /></td>
                    <td className="text-right tabular-nums">{fmt(r.acute)}</td>
                    <td className="text-right tabular-nums">{fmt(r.chronic)}</td>
                    <td className="text-right tabular-nums">{r.sessions}</td>
                    <td className="whitespace-nowrap text-sm">{r.last ? `${formatDateShort(r.last.date, false)} · RPE ${r.last.rpe}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </>
          </TableWrap>

          {missingRows.length ? <Notice tone="gray" title={`${t.missingTitle} · ${missingRows.length}`}>{t.missingText}</Notice> : null}
        </div>
      )}
    </>
  );
}
