import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireCapability, visibleGroups } from "@/lib/auth";
import { PageHeader } from "@/components/ui/card";
import { RatingForm } from "@/components/performance/rating-form";
import { loadRound } from "@/components/performance/evaluation-queries";
import { getT } from "@/messages";

export const metadata = { title: "Evaluare" };

/** Ecranul de notare: un jucător pe ecran, cu „următorul" din aceeași echipă. */
export default async function RatePage({ params }: { params: Promise<{ round: string; player: string }> }) {
  const { db, ctx } = await requireCapability("viewAnalysis");
  const { round: roundId, player: playerId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(roundId) || !/^[0-9a-f-]{36}$/i.test(playerId)) notFound();
  const data = await loadRound(db, roundId);
  if (!data) notFound();
  const me = data.roster.find((p) => p.id === playerId);
  if (!me) notFound();
  const t = getT().performance.evaluations;
  const manager = ctx.role === "sporting_director" || ctx.role === "physio";
  const myTeams = new Set(visibleGroups(ctx).map((g) => g.id));
  if (!manager && !(me.groupId && myTeams.has(me.groupId))) notFound();

  // ordinea: jucătorii echipei, întâi cei netrimiși
  const team = data.roster.filter((p) => p.groupId === me.groupId);
  const i = team.findIndex((p) => p.id === playerId);
  const nextOpen = [...team.slice(i + 1), ...team.slice(0, i)].find((p) => p.status !== "submitted");
  const base = `/performanta/evaluari/${roundId}`;
  let initial = { scores: {} as Record<string, number>, strengths: "", nextGoals: "", comment: "" };
  if (me.evaluationId) {
    const [{ data: ev }, { data: scores }, { data: comment }] = await Promise.all([
      db.from("evaluations").select("strengths, next_goals").eq("id", me.evaluationId).maybeSingle(),
      db.from("evaluation_scores").select("criterion_id, score").eq("evaluation_id", me.evaluationId),
      db.rpc("evaluation_comment", { p_eval: me.evaluationId }),
    ]);
    initial = {
      scores: Object.fromEntries((scores ?? []).map((s) => [s.criterion_id, s.score])),
      strengths: ev?.strengths ?? "", nextGoals: ev?.next_goals ?? "", comment: (comment as string | null) ?? "",
    };
  }
  const teamName = ctx.groups.find((g) => g.id === me.groupId)?.name ?? "";
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        back={<Link href={base} className="inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink"><ChevronLeft className="size-5" aria-hidden />{data.round.name}</Link>}
        title={me.name}
        description={`${teamName} · ${t.of(i + 1, team.length)} · ${t.status[me.status]}`} />
      <RatingForm key={playerId} roundId={roundId} playerId={playerId} criteria={data.criteria} initial={initial}
        prevHref={i > 0 ? `${base}/${team[i - 1].id}` : null}
        nextHref={nextOpen && nextOpen.id !== playerId ? `${base}/${nextOpen.id}` : null}
        roundHref={base} readOnly={data.round.status !== "open"} />
    </div>
  );
}
