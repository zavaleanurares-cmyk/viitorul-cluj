import Link from "next/link";
import { Check, Clock, X } from "lucide-react";
import { MONTHS_RO, WEEKDAYS_SHORT_RO, addDays, isoWeekday, weekStart } from "@club/shared";
import { requireCapability, visibleGroups } from "@/lib/auth";
import { Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/card";
import { PrevNext, TableWrap } from "@/components/ui/misc";
import { Badge } from "@/components/ui/status";
import { PrintButton } from "@/components/players/print-button";
import { TeamSelect } from "@/components/schedule/team-select";
import { weekActivity, type CheckKey, type CheckState, type TeamActivity } from "@/components/schedule/activity";
import { requestTime } from "@/lib/request-time";
import { cn } from "@/lib/cn";
import { getT } from "@/messages";

export const metadata = { title: "Activitatea antrenorilor" };

const KEYS: CheckKey[] = ["attendance", "plan", "ratings", "report"];
const TONE: Record<CheckState, string> = {
  done: "bg-st-green-soft text-st-green",
  missing: "bg-st-red-soft text-st-red",
  pending: "bg-sunken text-ink-3",
};
const ICON = { done: Check, missing: X, pending: Clock } as const;

/** Unde duce fiecare verificare: ecranul în care se face lucrul care lipsește. */
function checkHref(id: string, kind: "training" | "match", key: CheckKey) {
  if (kind === "match") return `/program/${id}/meci`;
  return key === "attendance" ? `/program/${id}/prezenta` : key === "plan" ? `/program/${id}/plan` : `/program/${id}/note`;
}

function Ratio({ v }: { v: TeamActivity["totals"][CheckKey] }) {
  const t = getT().activity.report;
  if (!v.due) return <span className="text-ink-3">{t.none}</span>;
  return <Badge tone={v.done === v.due ? "green" : "red"}>{t.ratio(v.done, v.due)}</Badge>;
}

/**
 * Raportul de activitate al antrenorilor (echivalentul „Raport activitate” din TFB):
 * pe săptămână, pentru fiecare echipă, ce s-a făcut la antrenamente și meciuri și ce lipsește.
 */
export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ sapt?: string; echipa?: string }> }) {
  const { db, ctx } = await requireCapability("runEvents");
  const sp = await searchParams;
  const t = getT().activity.report;
  const day = typeof sp.sapt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.sapt) ? sp.sapt : ctx.today;
  const monday = weekStart(day);
  const groups = visibleGroups(ctx);
  const team = typeof sp.echipa === "string" && groups.some((g) => g.id === sp.echipa) ? sp.echipa : "";
  const ids = team ? [team] : groups.map((g) => g.id);
  const teams = ids.length ? await weekActivity(db, ctx, monday, ids, requestTime()) : [];

  const f = (d: string) => `${Number(d.slice(8, 10))} ${MONTHS_RO[Number(d.slice(5, 7)) - 1].slice(0, 3)}.`;
  const href = (p: { sapt?: string; echipa?: string }) => {
    const u = new URLSearchParams();
    const w = p.sapt ?? monday;
    if (w !== weekStart(ctx.today)) u.set("sapt", w);
    const e = p.echipa ?? team;
    if (e) u.set("echipa", e);
    const s = u.toString();
    return s ? `/program/activitate?${s}` : "/program/activitate";
  };
  const missing = (x: TeamActivity) => KEYS.reduce((s, k) => s + x.totals[k].due - x.totals[k].done, 0);

  return (
    <>
      <PageHeader title={t.title} description={t.description} action={<PrintButton label={t.print} />} />
      <div className="no-print mb-6 grid gap-2 md:grid-cols-[minmax(0,26rem)_16rem] md:justify-between">
        <PrevNext prevHref={href({ sapt: addDays(monday, -7) })} nextHref={href({ sapt: addDays(monday, 7) })}
          label={t.week(f(monday), f(addDays(monday, 6)))} todayHref={monday === weekStart(ctx.today) ? undefined : href({ sapt: ctx.today })} />
        {groups.length > 1 ? (
          <TeamSelect value={team} options={groups.map((g) => ({ id: g.id, name: g.name }))} label={t.team} allLabel={t.allTeams}
            hrefFor={Object.fromEntries([["", href({ echipa: "" })], ...groups.map((g) => [g.id, href({ echipa: g.id })])])} />
        ) : null}
      </div>
      <p className="mb-4 hidden font-semibold print:block">{t.week(f(monday), f(addDays(monday, 6)))}</p>

      {!teams.length ? <EmptyState title={t.noTeams} /> : (
        <div className="space-y-6">
          <TableWrap>
            <thead>
              <tr>
                <th scope="col">{t.team}</th>
                {KEYS.map((k) => <th key={k} scope="col" className="text-center"><span className="hidden sm:inline">{t.cols[k]}</span><span className="sm:hidden">{t.colsShort[k]}</span></th>)}
              </tr>
            </thead>
            <tbody>
              {teams.map((x) => (
                <tr key={x.id}>
                  <th scope="row" className="!text-[0.9375rem] !font-semibold !text-ink">
                    {x.events.length ? <a href={`#e-${x.id}`} className="hover:underline">{x.name}</a> : x.name}
                    <span className="hidden text-sm font-normal text-ink-3 sm:block">{x.coaches.join(", ") || t.noCoach}</span>
                  </th>
                  {KEYS.map((k) => <td key={k} className="text-center"><Ratio v={x.totals[k]} /></td>)}
                </tr>
              ))}
            </tbody>
          </TableWrap>

          {teams.filter((x) => x.events.length).map((x) => {
            const n = missing(x);
            return (
              <Card key={x.id} id={`e-${x.id}`} className="scroll-mt-20 print:break-inside-avoid">
                <CardHeader title={x.name} description={[x.coaches.join(", ") || t.noCoach, n ? t.missingTitle(n) : t.allDone].join(" · ")} />
                <CardBody>
                  <ul className="divide-y divide-line">
                    {x.events.map((e) => (
                      <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
                        <Link href={`/program/${e.id}`} className="min-w-0 flex-1 basis-56 hover:underline">
                          <span className="font-semibold tabular-nums">{WEEKDAYS_SHORT_RO[isoWeekday(e.date) - 1]} {f(e.date)} · {e.time}</span>
                          <span className="text-ink-2"> · {e.kind === "match" ? `${t.match}${e.opponent ? ` ${t.vs(e.opponent)}` : ""}` : t.training}</span>
                        </Link>
                        <span className="flex flex-wrap gap-1.5">
                          {KEYS.filter((k) => e.checks[k]).map((k) => {
                            const s = e.checks[k]!;
                            const Icon = ICON[s];
                            return (
                              <Link key={k} href={checkHref(e.id, e.kind, k)} aria-label={t.cell(t.cols[k], t.states[s])}
                                className={cn("inline-flex h-8 items-center gap-1 rounded-full px-3 text-sm font-medium", TONE[s])}>
                                <Icon className="size-4" aria-hidden />{t.cols[k]}
                              </Link>
                            );
                          })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            );
          })}
          {!teams.some((x) => x.events.length) ? <EmptyState title={t.noEvents} /> : null}
        </div>
      )}
    </>
  );
}
