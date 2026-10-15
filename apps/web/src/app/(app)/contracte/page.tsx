import Link from "next/link";
import { ChevronRight, FileSignature } from "lucide-react";
import { formatDate } from "@club/shared";
import { requireRole } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { getT } from "@/messages";

export const metadata = { title: "Documente" };

/** Documentele trimise spre semnare familiei (sau jucătorului adult). */
export default async function FamilyContracts() {
  const { db } = await requireRole("guardian", "player");
  const t = getT().club.contracts;
  const { data } = await db.from("contracts").select("id, title, status, sent_at, signed_at, due_on, players(display_name)").in("status", ["sent", "signed"]).order("sent_at", { ascending: false });
  const pending = (data ?? []).filter((c) => c.status === "sent");
  const done = (data ?? []).filter((c) => c.status === "signed");
  const Row = ({ c }: { c: NonNullable<typeof data>[number] }) => (
    <li>
      <Link href={`/contracte/${c.id}`} className="flex min-h-16 items-center gap-3 px-4 py-2 hover:bg-canvas">
        <FileSignature className="size-6 shrink-0 text-ink-3" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{c.title}</span>
          <span className="block text-sm text-ink-3">{(c.players as { display_name: string } | null)?.display_name}{c.signed_at ? ` · ${t.family.signedOn(formatDate(c.signed_at.slice(0, 10)))}` : c.due_on ? ` · ${t.cols.due.toLowerCase()} ${formatDate(c.due_on)}` : ""}</span>
        </span>
        <ChevronRight className="size-5 text-ink-3" aria-hidden />
      </Link>
    </li>
  );
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={t.family.title} description={t.family.description} />
      {!data?.length ? <EmptyState icon={<FileSignature className="size-8" aria-hidden />} title={t.family.empty} /> : null}
      {pending.length ? (<section><h2 className="mb-2 text-lg">{t.family.pending}</h2><ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">{pending.map((c) => <Row key={c.id} c={c} />)}</ul></section>) : null}
      {done.length ? (<section><h2 className="mb-2 text-lg">{t.family.done}</h2><ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">{done.map((c) => <Row key={c.id} c={c} />)}</ul></section>) : null}
    </div>
  );
}
