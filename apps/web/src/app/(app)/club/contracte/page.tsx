import Link from "next/link";
import { CircleAlert, FileDown, FileSignature } from "lucide-react";
import { formatDate } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { TabLinks, TableWrap } from "@/components/ui/misc";
import { ContractTemplates, RemindButton, SendContractsButton, VoidButton, type ContractTemplateRow } from "@/components/club/contract-admin";
import { cn } from "@/lib/cn";
import { getT } from "@/messages";

export const metadata = { title: "Contracte" };

type View = "pending" | "signed" | "other" | "templates";
const SLUG: Record<string, View> = { semnate: "signed", altele: "other", modele: "templates" };

export default async function ContractsPage({ searchParams }: { searchParams: Promise<{ vedere?: string }> }) {
  const { db, ctx } = await requireCapability("manageContracts");
  const sp = await searchParams;
  const t = getT().club.contracts;
  const view: View = SLUG[sp.vedere ?? ""] ?? "pending";
  const [{ data: tpls }, { data: contracts }, { data: players }] = await Promise.all([
    db.from("contract_templates").select("id, name, kind, is_active, contract_template_versions(version, body)").eq("is_active", true).order("name"),
    db.from("contracts").select("id, title, status, sent_at, due_on, signed_at, signer_name, reminders_sent, decline_reason, void_reason, players(display_name, group_id)").order("sent_at", { ascending: false }).limit(1000),
    db.from("players").select("id, display_name, group_id").eq("is_active", true).is("anonymized_at", null).order("display_name"),
  ]);
  const templates: ContractTemplateRow[] = (tpls ?? []).map((x) => {
    const v = [...(x.contract_template_versions ?? [])].sort((a, b) => b.version - a.version)[0];
    return { id: x.id, name: x.name, kind: x.kind as ContractTemplateRow["kind"], version: v?.version ?? 0, body: v?.body ?? "" };
  });
  const all = contracts ?? [];
  const lists: Record<Exclude<View, "templates">, typeof all> = {
    pending: all.filter((c) => c.status === "sent"),
    signed: all.filter((c) => c.status === "signed"),
    other: all.filter((c) => c.status === "declined" || c.status === "voided"),
  };
  const teamName = (gid: string | null | undefined) => ctx.groups.find((g) => g.id === gid)?.name ?? "";
  const tab = (v: View, label: string) => ({ key: v, href: `/club/contracte${v === "pending" ? "" : `?vedere=${Object.keys(SLUG).find((k) => SLUG[k] === v)}`}`, label });
  return (
    <>
      <PageHeader title={t.title} description={t.description}
        action={<SendContractsButton templates={templates.filter((x) => x.version).map((x) => ({ id: x.id, name: x.name }))}
          teams={ctx.groups.filter((g) => g.is_active).map((g) => ({ id: g.id, name: g.name }))}
          players={(players ?? []).map((p) => ({ id: p.id, name: p.display_name, groupId: p.group_id }))} />} />
      <TabLinks className="mb-4" current={view} tabs={[
        tab("pending", `${t.views.pending}${lists.pending.length ? ` · ${lists.pending.length}` : ""}`),
        tab("signed", t.views.signed), tab("other", t.views.other), tab("templates", t.views.templates),
      ]} />
      {view === "templates" ? <ContractTemplates templates={templates} /> : !lists[view].length ? (
        view === "pending" ? <EmptyState icon={<FileSignature className="size-8" aria-hidden />} title={t.emptyPending} description={t.emptyPendingText} /> : <EmptyState title={t.emptySigned} />
      ) : (
        <div className="space-y-3">
          {view === "pending" ? <div className="flex justify-end"><RemindButton ids={lists.pending.map((c) => c.id)} label={t.remindAll} /></div> : null}
          <TableWrap>
            <>
              <thead><tr>
                <th scope="col">{t.cols.doc}</th><th scope="col">{t.cols.player}</th><th scope="col">{t.cols.signer}</th>
                <th scope="col">{view === "signed" ? t.cols.signed : t.cols.sent}</th><th scope="col"><span className="sr-only">{t.cols.status}</span></th>
              </tr></thead>
              <tbody>
                {lists[view].map((c) => {
                  const p = c.players as { display_name: string; group_id: string | null } | null;
                  const overdue = c.status === "sent" && c.due_on && c.due_on < ctx.today;
                  return (
                    <tr key={c.id}>
                      <td><Link href={`/contracte/${c.id}`} className="font-semibold hover:underline">{c.title}</Link>
                        {c.status === "declined" ? <span className="block text-sm text-st-red">{t.status.declined}: {c.decline_reason}</span> : null}
                        {c.status === "voided" ? <span className="block text-sm text-ink-3">{t.status.voided}: {c.void_reason}</span> : null}
                      </td>
                      <td>{p?.display_name}<span className="block text-sm text-ink-3">{teamName(p?.group_id)}</span></td>
                      <td>{c.signer_name}</td>
                      <td className="whitespace-nowrap text-sm">
                        {view === "signed" && c.signed_at ? formatDate(c.signed_at.slice(0, 10)) : formatDate(c.sent_at.slice(0, 10))}
                        {c.due_on && c.status === "sent" ? <span className={cn("block", overdue ? "font-semibold text-st-red" : "text-ink-3")}>{overdue ? <CircleAlert className="mr-1 inline size-4 align-[-3px]" aria-hidden /> : null}{t.cols.due.toLowerCase()} {formatDate(c.due_on)}{overdue ? ` · ${t.overdue}` : ""}</span> : null}
                        {c.reminders_sent ? <span className="block text-ink-3">{t.reminders(c.reminders_sent)}</span> : null}
                      </td>
                      <td className="text-right">
                        <span className="inline-flex items-center gap-1">
                          {c.status === "sent" ? <RemindButton ids={[c.id]} label={t.remind} /> : null}
                          {c.status === "sent" || c.status === "declined" ? <VoidButton id={c.id} /> : null}
                          {c.status === "signed" ? <a href={`/api/club/contract/${c.id}`} className="inline-flex h-10 items-center gap-1 rounded-lg px-2 font-semibold hover:bg-sunken"><FileDown className="size-4" aria-hidden />{t.pdf}</a> : null}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </>
          </TableWrap>
        </div>
      )}
    </>
  );
}
