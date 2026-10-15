import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ChevronLeft, CircleCheck, FileDown } from "lucide-react";
import { formatDate, formatDateTime } from "@club/shared";
import { requireSession } from "@/lib/auth";
import { Card, CardBody, Notice, PageHeader } from "@/components/ui/card";
import { SignContract } from "@/components/club/sign-contract";
import { getT } from "@/messages";

export const metadata = { title: "Document" };

/** Documentul, textul exact trimis; dacă așteaptă semnătura, formularul de semnare. Deschiderea intră în urma de audit. */
export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, ctx } = await requireSession();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: c } = await db.from("contracts").select("id, title, body, status, signer_user_id, signer_name, signed_at, signed_name, document_hash, due_on, players(display_name)").eq("id", id).maybeSingle();
  if (!c) notFound();
  const t = getT().club.contracts;
  const mine = c.signer_user_id === ctx.userId;
  const { data: trail } = mine ? { data: null } : await db.from("contract_events").select("id, at, action, ip, details, actor_id, profiles(full_name)").eq("contract_id", id).order("at");
  if (mine && c.status === "sent") {
    const h = await headers();
    await db.rpc("view_contract", { p_id: id, p_ip: (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || undefined });
  }
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader back={<Link href={mine ? "/contracte" : "/club/contracte"} className="inline-flex h-10 items-center gap-1 font-semibold text-ink-3 hover:text-ink"><ChevronLeft className="size-5" aria-hidden />{mine ? t.family.title : t.title}</Link>}
        title={c.title} description={(c.players as { display_name: string } | null)?.display_name ?? undefined} />
      {c.status === "signed" ? (
        <Notice tone="green" title={t.family.signedOn(formatDateTime(c.signed_at!, ctx.settings.timezone))}>
          <p className="flex items-center gap-1"><CircleCheck className="size-4" aria-hidden />{c.signed_name}</p>
          <p className="mt-1 break-all text-sm">{t.family.hash}: {c.document_hash}</p>
          <a href={`/api/club/contract/${c.id}`} className="mt-2 inline-flex h-11 items-center gap-2 rounded-full bg-sunken px-3 font-medium"><FileDown className="size-5" aria-hidden />{t.family.downloadPdf}</a>
        </Notice>
      ) : c.status !== "sent" ? <Notice tone="gray" title={t.status[c.status as "voided"]} /> : null}
      <Card><CardBody><div className="whitespace-pre-line leading-relaxed">{c.body}</div></CardBody></Card>
      {mine && c.status === "sent" ? <SignContract id={c.id} clubId={ctx.club.id} defaultName={c.signer_name} /> : null}
      {c.due_on && c.status === "sent" ? <p className="text-sm text-ink-3">{t.cols.due}: {formatDate(c.due_on)}</p> : null}
      {trail?.length ? (
        <section>
          <h2 className="mb-2 text-lg">{t.trail}</h2>
          <ol className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line/70 bg-surface shadow-[var(--shadow-card)]">
            {trail.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 px-4 py-2">
                <span className="w-36 shrink-0 text-sm tabular-nums text-ink-3">{formatDateTime(e.at, ctx.settings.timezone)}</span>
                <span className="font-semibold">{t.events[e.action as keyof typeof t.events]}</span>
                <span className="text-sm text-ink-2">{!e.actor_id ? t.automatic : e.actor_id === c.signer_user_id ? c.signer_name : (e.profiles as { full_name: string } | null)?.full_name ?? "—"}{e.ip ? ` · IP ${e.ip}` : ""}</span>
                {e.details && e.action !== "signed" ? <span className="basis-full text-sm text-ink-3">{e.details}</span> : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
