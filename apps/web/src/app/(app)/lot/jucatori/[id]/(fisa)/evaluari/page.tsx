import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { formatDate } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { EmptyState } from "@/components/ui/card";
import { getT } from "@/messages";

/** Evaluările jucătorului, din toate rundele (cele trimise se deschid în vederea completă). */
export default async function PlayerEvaluations({ params }: { params: Promise<{ id: string }> }) {
  const { db } = await requireCapability("viewAnalysis");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const t = getT().performance.evaluations;
  const { data } = await db.from("evaluations").select("id, status, submitted_at, round_id, evaluation_rounds(name, status, published_at)")
    .eq("player_id", id).order("updated_at", { ascending: false });
  if (!data?.length) return <EmptyState title={t.playerTabEmpty} />;
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      {data.map((e) => {
        const r = e.evaluation_rounds as { name: string; status: string; published_at: string | null } | null;
        const href = e.status === "submitted" ? `/evaluari/${e.id}` : r?.status === "open" ? `/performanta/evaluari/${e.round_id}/${id}` : null;
        const body = (
          <>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{r?.name}</span>
              <span className="block text-sm text-ink-3">
                {t.status[e.status as "draft" | "submitted"]} · {t.roundStatus[(r?.status ?? "open") as "open" | "published"]}
                {r?.published_at ? ` · ${formatDate(r.published_at.slice(0, 10))}` : ""}
              </span>
            </span>
            {href ? <ChevronRight className="size-5 text-ink-3" aria-hidden /> : null}
          </>
        );
        return <li key={e.id}>{href ? <Link href={href} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-canvas">{body}</Link> : <div className="flex min-h-14 items-center gap-3 px-4 py-2">{body}</div>}</li>;
      })}
    </ul>
  );
}
