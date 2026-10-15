import Link from "next/link";
import { notFound } from "next/navigation";
import { FileDown, FileText, Pencil } from "lucide-react";
import { can, formatDateShort, formatLei, PURCHASE_STATUS_LABELS } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, Notice, PageHeader } from "@/components/ui/card";
import { DataList, TableWrap } from "@/components/ui/misc";
import { Money, PurchaseStatusChip } from "@/components/money/bits";
import { PurchaseForm } from "@/components/money/purchase-form";
import { CancelRequestButton, CompleteButton, DecideButtons } from "@/components/money/purchase-actions";
import { getT } from "@/messages";
import { departmentBudget, formOptions } from "../queries";

export const metadata = { title: "Referat" };

export default async function PurchasePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ modifica?: string }> }) {
  const { db, ctx } = await requireCapability("purchaseRequests");
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const t = getT().money.purchases;
  const [{ data: r }, { data: items }, settings] = await Promise.all([
    db.from("purchase_requests").select("*, departments(name), groups(name), author:profiles!purchase_requests_requested_by_fkey(full_name), decider:profiles!purchase_requests_decided_by_fkey(full_name)").eq("id", id).maybeSingle(),
    db.from("purchase_request_items").select("*").eq("request_id", id).order("position"),
    db.from("finance_settings").select("approver_roles").maybeSingle(),
  ]);
  if (!r) notFound();
  const finance = can(ctx.role, "manageMoney");
  const mine = r.requested_by === ctx.userId;
  const open = r.status === "draft" || r.status === "submitted";
  const canEdit = open && (mine || finance);
  const approver = (settings.data?.approver_roles ?? []).includes(ctx.role);
  const opts = await formOptions(db);
  const budget = await departmentBudget(db, opts.depts, r.department_id, Number(ctx.today.slice(0, 4)));
  const budgetNote = budget ? (budget.planned ? t.form.budget(formatLei(budget.spent), formatLei(budget.planned)) : t.form.noBudget) : null;

  if (sp.modifica === "1" && canEdit) {
    const teams = ctx.groups.filter((g) => g.is_active).map((g) => ({ id: g.id, label: g.name }));
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader title={t.form.editTitle(r.number)} back={<Link href={`/bani/referate/${id}`} className="font-semibold underline">#{r.number}</Link>} />
        <PurchaseForm clubId={ctx.club.id} userId={ctx.userId} departments={opts.departments} teams={teams} vatRates={opts.vatRates} budgetNote={budgetNote}
          initial={{ id: r.id, department_id: r.department_id, group_id: r.group_id, justification: r.justification, needed_by: r.needed_by, spec_path: r.spec_path,
            items: (items ?? []).map((i) => ({ name: i.name, details: i.details ?? "", unit: i.unit, quantity: Number(i.quantity), unit_price: i.unit_price, vat_rate: i.vat_rate, price_includes_vat: i.price_includes_vat })) }} />
      </div>
    );
  }

  const author = (r.author as { full_name: string } | null)?.full_name ?? "—";
  const decider = (r.decider as { full_name: string } | null)?.full_name ?? "—";
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader
        title={`#${r.number} · ${formatLei(r.total)}`}
        back={<Link href="/bani/referate" className="font-semibold underline">{t.title}</Link>}
        description={<PurchaseStatusChip status={r.status} label={PURCHASE_STATUS_LABELS[r.status] ?? r.status} size="md" />}
        action={<>
          <a href={`/api/bani/referat/${id}`} className="inline-flex h-11 items-center gap-2 rounded-full px-4 font-medium hover:bg-line bg-sunken transition-colors"><FileDown className="size-5" aria-hidden />{t.detail.pdf}</a>
          {canEdit ? <LinkButton href={`/bani/referate/${id}?modifica=1`} icon={<Pencil className="size-5" aria-hidden />}>{getT().money.common.edit}</LinkButton> : null}
        </>}
      />
      {r.status === "submitted" && approver && mine ? <Notice tone="gray">{t.detail.ownNote}</Notice> : null}
      {r.status === "submitted" && !approver ? <Notice tone="yellow">{t.detail.waiting}</Notice> : null}
      {r.decision_note ? <Notice tone={r.status === "rejected" ? "red" : "green"} title={t.detail.decidedBy(decider, formatDateShort(r.decided_at?.slice(0, 10)))}>{r.decision_note}</Notice> : null}
      <Card>
        <CardBody className="space-y-4">
          <p className="text-lg">{r.justification}</p>
          <DataList items={[
            { label: t.cols.author, value: t.detail.requestedBy(author, formatDateShort(r.created_at.slice(0, 10))) },
            { label: t.cols.department, value: (r.departments as { name: string } | null)?.name ?? "—" },
            ...(r.groups ? [{ label: t.form.team, value: (r.groups as { name: string }).name }] : []),
            ...(r.needed_by ? [{ label: t.form.neededBy, value: formatDateShort(r.needed_by) }] : []),
            ...(r.decided_at && !r.decision_note ? [{ label: PURCHASE_STATUS_LABELS[r.status], value: t.detail.decidedBy(decider, formatDateShort(r.decided_at.slice(0, 10))) }] : []),
          ]} />
          {budgetNote ? <p className="text-sm text-ink-3">{budgetNote}</p> : null}
          {r.spec_path ? <a className="inline-flex items-center gap-2 font-semibold underline" href={`/api/files/finance/${r.spec_path.split("/").map(encodeURIComponent).join("/")}`} target="_blank" rel="noreferrer"><FileText className="size-5" aria-hidden />{r.spec_path.split("/").pop()}</a> : null}
        </CardBody>
      </Card>
      <TableWrap>
        <>
          <thead><tr><th scope="col">{t.form.item.name}</th><th scope="col" className="text-right">{t.form.item.qty}</th><th scope="col" className="text-right">{t.form.item.price}</th><th scope="col" className="text-right">{t.form.item.vat}</th><th scope="col" className="text-right">{t.form.totals.total}</th></tr></thead>
          <tbody>
            {(items ?? []).map((i) => (
              <tr key={i.id}>
                <td><span className="font-semibold">{i.name}</span>{i.details ? <span className="block text-sm text-ink-3">{i.details}</span> : null}</td>
                <td className="text-right tabular-nums">{Number(i.quantity).toLocaleString("ro-RO")} {i.unit}</td>
                <td className="text-right"><Money value={i.unit_price} decimals="always" /></td>
                <td className="text-right tabular-nums">{i.vat_rate}%</td>
                <td className="text-right font-semibold"><Money value={i.line_net + i.line_vat} decimals="always" /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><th scope="row" colSpan={4} className="text-right">{t.form.totals.net}</th><td className="text-right"><Money value={r.total_net} decimals="always" /></td></tr>
            <tr><th scope="row" colSpan={4} className="text-right">{t.form.totals.vat}</th><td className="text-right"><Money value={r.total_vat} decimals="always" /></td></tr>
            <tr><th scope="row" colSpan={4} className="text-right">{t.form.totals.total}</th><td className="text-right text-lg font-bold"><Money value={r.total} decimals="always" /></td></tr>
          </tfoot>
        </>
      </TableWrap>
      <div className="flex flex-wrap justify-end gap-2">
        {open && (mine || finance) ? <CancelRequestButton id={id} /> : null}
        {r.status === "submitted" && approver && !mine ? <DecideButtons id={id} /> : null}
        {r.status === "approved" && finance ? <CompleteButton id={id} total={r.total} today={ctx.today} /> : null}
      </div>
    </div>
  );
}
