import { notFound } from "next/navigation";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatDate } from "@club/shared";
import { requireSession } from "@/lib/auth";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { CATEGORIES, type Category } from "@/components/performance/evaluation-templates";
import { cn } from "@/lib/cn";
import { getT } from "@/messages";

export const metadata = { title: "Evaluare" };

type Score = { criterion_id: string; score: number };

/**
 * O evaluare: profilul pe categorii (cu evaluarea anterioară), notele pe criterii, punctele forte și obiectivele.
 * RLS decide cine o vede: staff-ul care notează sau, după publicare, familia și jucătorul. Nota internă nu apare aici.
 */
export default async function EvaluationView({ params }: { params: Promise<{ id: string }> }) {
  const { db, ctx } = await requireSession();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const t = getT().performance.evaluations;
  const { data: ev } = await db.from("evaluations")
    .select("id, player_id, round_id, status, strengths, next_goals, submitted_at, evaluation_rounds(name, template_id, published_at, status), players(display_name, full_name)")
    .eq("id", id).maybeSingle();
  if (!ev) notFound();
  const round = ev.evaluation_rounds as { name: string; template_id: string; published_at: string | null; status: string } | null;
  const player = ev.players as { display_name: string; full_name: string } | null;
  const family = ctx.role === "guardian" || ctx.role === "player";

  // evaluarea anterioară a aceluiași jucător, vizibilă cititorului (publicată, pentru familie)
  const { data: others } = await db.from("evaluations")
    .select("id, submitted_at, status, evaluation_rounds(name, published_at, status)").eq("player_id", ev.player_id).eq("status", "submitted").neq("id", ev.id)
    .lt("submitted_at", ev.submitted_at ?? new Date().toISOString()).order("submitted_at", { ascending: false }).limit(5);
  const prev = (others ?? []).find((o) => !family || (o.evaluation_rounds as { status: string } | null)?.status === "published") ?? null;
  const [{ data: scores }, { data: prevScores }, { data: crit }] = await Promise.all([
    db.from("evaluation_scores").select("criterion_id, score").eq("evaluation_id", ev.id),
    prev ? db.from("evaluation_scores").select("criterion_id, score").eq("evaluation_id", prev.id) : Promise.resolve({ data: [] as Score[] }),
    db.from("evaluation_criteria").select("id, category, name, description, sort").eq("template_id", round?.template_id ?? "").order("sort"),
  ]);
  const allCrit = new Map<string, { category: Category; name: string }>();
  // criteriile evaluării anterioare pot fi din alt model: le citim pe toate cele notate
  const prevIds = (prevScores ?? []).map((s) => s.criterion_id).filter((x) => !(crit ?? []).some((c) => c.id === x));
  const { data: prevCrit } = prevIds.length ? await db.from("evaluation_criteria").select("id, category, name").in("id", prevIds) : { data: [] };
  for (const c of [...(crit ?? []), ...(prevCrit ?? [])]) allCrit.set(c.id, { category: c.category as Category, name: c.name });

  const catAvg = (list: Score[] | null) => {
    const m = new Map<Category, { s: number; n: number }>();
    for (const s of list ?? []) {
      const c = allCrit.get(s.criterion_id)?.category;
      if (!c) continue;
      const v = m.get(c) ?? { s: 0, n: 0 };
      v.s += s.score; v.n++;
      m.set(c, v);
    }
    return new Map([...m].map(([k, v]) => [k, v.s / v.n]));
  };
  const now = catAvg(scores);
  const before = catAvg(prevScores);
  const fmt = (n: number) => n.toLocaleString("ro-RO", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const byId = new Map((scores ?? []).map((s) => [s.criterion_id, s.score]));
  const prevLabel = prev ? (prev.evaluation_rounds as { name: string } | null)?.name ?? "" : "";

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={player?.full_name ?? ""} description={`${round?.name ?? ""}${round?.published_at ? ` · ${t.publishedOn(formatDate(round.published_at.slice(0, 10)))}` : ""}`} />
      <div className="space-y-4">
        <Card>
          <CardHeader title={t.profile} description={prev ? t.vsPrevious(prevLabel) : t.noPrevious} />
          <CardBody>
            <ul className="space-y-3">
              {CATEGORIES.filter((c) => now.has(c)).map((c) => {
                const v = now.get(c)!;
                const b = before.get(c);
                const d = b !== undefined ? v - b : null;
                return (
                  <li key={c} className="grid grid-cols-[8.5rem_minmax(0,1fr)_5.5rem] items-center gap-3">
                    <span className="font-semibold">{t.categories[c]}</span>
                    <span className="relative h-3 rounded-full bg-sunken" role="img" aria-label={`${t.categories[c]}: ${fmt(v)} din 5`}>
                      <span className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${(v / 5) * 100}%` }} />
                      {b !== undefined ? <span className="absolute -top-1 h-5 w-0.5 bg-ink" style={{ left: `${(b / 5) * 100}%` }} aria-hidden /> : null}
                    </span>
                    <span className="flex items-center justify-end gap-1 tabular-nums">
                      <span className="font-bold">{fmt(v)}</span>
                      {d !== null ? (
                        <span className={cn("inline-flex items-center text-sm", d > 0.05 ? "text-st-green" : d < -0.05 ? "text-st-red" : "text-ink-3")}>
                          {d > 0.05 ? <ArrowUpRight className="size-4" aria-hidden /> : d < -0.05 ? <ArrowDownRight className="size-4" aria-hidden /> : <Minus className="size-4" aria-hidden />}
                          {d > 0.05 || d < -0.05 ? fmt(Math.abs(d)) : ""}
                        </span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>

        {ev.next_goals || ev.strengths ? (
          <Card>
            <CardBody className="space-y-4">
              {ev.next_goals ? <section><h2 className="mb-1 text-lg">{t.nextGoals}</h2><p className="whitespace-pre-line">{ev.next_goals}</p></section> : null}
              {ev.strengths ? <section><h2 className="mb-1 text-lg">{t.strengths}</h2><p className="whitespace-pre-line">{ev.strengths}</p></section> : null}
            </CardBody>
          </Card>
        ) : null}

        {CATEGORIES.filter((c) => (crit ?? []).some((k) => k.category === c && byId.has(k.id))).map((c) => (
          <Card key={c}>
            <CardHeader title={t.categories[c]} />
            <CardBody>
              <ul className="divide-y divide-line">
                {(crit ?? []).filter((k) => k.category === c && byId.has(k.id)).map((k) => {
                  const s = byId.get(k.id)!;
                  return (
                    <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span className="font-semibold">{k.name}</span>
                      <span className="flex items-center gap-2">
                        <span className="flex gap-1" aria-hidden>{[1, 2, 3, 4, 5].map((n) => <span key={n} className={cn("size-3 rounded-full", n <= s ? "bg-brand" : "bg-sunken")} />)}</span>
                        <span className="text-sm text-ink-2">{s} · {t.scores[s]}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
