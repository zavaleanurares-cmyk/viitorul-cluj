import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, CircleCheck, CircleDashed, PenLine } from "lucide-react";
import { formatDate } from "@club/shared";
import { requireCapability, visibleGroups } from "@/lib/auth";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { TableWrap } from "@/components/ui/misc";
import { DeleteRoundButton, PublishRoundButton } from "@/components/performance/evaluation-admin";
import { loadRound } from "@/components/performance/evaluation-queries";
import { CATEGORIES } from "@/components/performance/evaluation-templates";
import { cn } from "@/lib/cn";
import { getT } from "@/messages";

export const metadata = { title: "Rundă de evaluări" };

const STATUS = {
  none: { Icon: CircleDashed, cls: "bg-sunken text-ink-2" },
  draft: { Icon: PenLine, cls: "bg-st-yellow-soft text-ink" },
  submitted: { Icon: CircleCheck, cls: "bg-st-green-soft text-ink" },
} as const;

export default async function RoundPage({ params }: { params: Promise<{ round: string }> }) {
  const { db, ctx } = await requireCapability("viewAnalysis");
  const { round: roundId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(roundId)) notFound();
  const data = await loadRound(db, roundId);
  if (!data) notFound();
  const { round, criteria, roster } = data;
  const t = getT().performance.evaluations;
  const manager = ctx.role === "sporting_director" || ctx.role === "physio";
  const myTeams = new Set(visibleGroups(ctx).map((g) => g.id));
  const groups = data.groupIds.filter((g) => manager || myTeams.has(g));
  const open = round.status === "open";
  const submitted = roster.filter((p) => p.status === "submitted").length;
  const evaluatorIds = [...new Set(roster.map((p) => p.evaluatorId).filter(Boolean))] as string[];
  const { data: evaluators } = evaluatorIds.length ? await db.from("profiles").select("id, full_name").in("id", evaluatorIds) : { data: [] };
  const evaluatorName = new Map((evaluators ?? []).map((e) => [e.id, e.full_name]));

  // media pe categorii, pe echipă, din evaluările trimise
  const evalIds = roster.filter((p) => p.status === "submitted" && p.evaluationId).map((p) => p.evaluationId!);
  const { data: scores } = evalIds.length ? await db.from("evaluation_scores").select("evaluation_id, criterion_id, score").in("evaluation_id", evalIds) : { data: [] };
  const catOf = new Map(criteria.map((c) => [c.id, c.category]));
  const teamOfEval = new Map(roster.filter((p) => p.evaluationId).map((p) => [p.evaluationId!, p.groupId]));
  const sums = new Map<string, { s: number; n: number }>();
  for (const sc of scores ?? []) {
    const k = `${teamOfEval.get(sc.evaluation_id)}:${catOf.get(sc.criterion_id)}`;
    const v = sums.get(k) ?? { s: 0, n: 0 };
    v.s += sc.score; v.n++;
    sums.set(k, v);
  }
  const avg = (g: string, cat: string) => { const v = sums.get(`${g}:${cat}`); return v ? (v.s / v.n).toLocaleString("ro-RO", { maximumFractionDigits: 1, minimumFractionDigits: 1 }) : "—"; };
  const teamName = (id: string) => ctx.groups.find((g) => g.id === id)?.name ?? "—";
  const usedCats = CATEGORIES.filter((c) => criteria.some((k) => k.category === c));

  return (
    <>
      <PageHeader
        back={<Link href="/performanta/evaluari" className="inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink"><ChevronLeft className="size-5" aria-hidden />{t.title}</Link>}
        title={round.name}
        description={`${t.roundStatus[round.status as "open" | "published"]}${round.due_on && open ? ` · ${t.due(formatDate(round.due_on))}` : ""}${round.published_at ? ` · ${t.publishedOn(formatDate(round.published_at.slice(0, 10)))}` : ""} · ${t.progress(submitted, roster.length)}`}
        action={manager && open ? (
          <div className="flex flex-wrap gap-2">
            {!roster.some((p) => p.status !== "none") ? <DeleteRoundButton roundId={round.id} /> : null}
            <PublishRoundButton roundId={round.id} submitted={submitted} total={roster.length} />
          </div>
        ) : undefined} />

      <div className="space-y-4">
        {groups.map((g) => {
          const players = roster.filter((p) => p.groupId === g);
          const done = players.filter((p) => p.status === "submitted").length;
          return (
            <Card key={g}>
              <CardHeader title={teamName(g)} description={t.progress(done, players.length)} />
              <CardBody>
                <ul className="divide-y divide-line">
                  {players.map((p) => {
                    const S = STATUS[p.status];
                    const canRate = open && (manager || myTeams.has(g));
                    const href = canRate ? `/performanta/evaluari/${round.id}/${p.id}` : p.evaluationId && p.status === "submitted" ? `/evaluari/${p.evaluationId}` : null;
                    const body = (
                      <>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{p.name}</span>
                          {p.evaluatorId ? <span className="block text-sm text-ink-3">{t.evaluator(evaluatorName.get(p.evaluatorId) ?? "—")}</span> : null}
                        </span>
                        <span className={cn("inline-flex h-7 items-center gap-1 rounded-md px-2 text-sm font-semibold", S.cls)}><S.Icon className="size-4" aria-hidden />{t.status[p.status]}</span>
                        {canRate ? <span className="hidden font-semibold text-ink-2 sm:inline">{p.status === "none" ? t.rate : t.continue}</span> : null}
                      </>
                    );
                    return (
                      <li key={p.id}>
                        {href ? <Link href={href} className="flex min-h-14 items-center gap-3 py-2 hover:bg-canvas">{body}</Link> : <div className="flex min-h-14 items-center gap-3 py-2">{body}</div>}
                      </li>
                    );
                  })}
                </ul>
              </CardBody>
            </Card>
          );
        })}

        {submitted ? (
          <Card>
            <CardHeader title={t.teamAverages} description={t.teamAveragesHint} />
            <CardBody>
              <TableWrap>
                <>
                  <thead><tr><th scope="col">{t.teams}</th>{usedCats.map((c) => <th key={c} scope="col" className="text-right">{t.categories[c]}</th>)}</tr></thead>
                  <tbody>
                    {groups.map((g) => (
                      <tr key={g}><th scope="row">{teamName(g)}</th>{usedCats.map((c) => <td key={c} className="text-right tabular-nums">{avg(g, c)}</td>)}</tr>
                    ))}
                  </tbody>
                </>
              </TableWrap>
            </CardBody>
          </Card>
        ) : null}
      </div>
    </>
  );
}
