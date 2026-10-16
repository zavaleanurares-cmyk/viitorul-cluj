import Link from "next/link";
import { Download, FileText, Landmark } from "lucide-react";
import { formatDateShort, monthLabel } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { EmptyState, Notice, PageHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { PrevNext, TableWrap } from "@/components/ui/misc";
import { FilterLinks } from "@/components/squad/bits";
import { Money } from "@/components/money/bits";
import { DepartmentsButton, ExpenseButton, type Dept, type ExpenseDoc } from "@/components/money/expense-dialogs";
import { addMonths, periodOf } from "@/components/money/queries";
import { getT } from "@/messages";

export const metadata = { title: "Cheltuieli" };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ luna?: string; dep?: string; doc?: string }> }) {
  const { db, ctx } = await requireCapability("manageMoney");
  const sp = await searchParams;
  const t = getT().money.expenses;
  const month = /^\d{4}-\d{2}$/.test(sp.luna ?? "") ? `${sp.luna}-01` : periodOf(ctx.today);
  const [deptRes, players] = await Promise.all([
    db.from("departments").select("id, name, parent_id").is("deleted_at", null).order("sort").order("name"),
    db.from("players").select("id, full_name").eq("is_active", true).is("anonymized_at", null).order("full_name"),
  ]);
  const depts: Dept[] = (deptRes.data ?? []).map((d) => ({ id: d.id, name: d.name, parentId: d.parent_id }));
  const roots = depts.filter((d) => !d.parentId);
  const dep = roots.some((d) => d.id === sp.dep) ? sp.dep! : null;
  const inDep = dep ? [dep, ...depts.filter((d) => d.parentId === dep).map((d) => d.id)] : null;
  let q = db.from("expenses").select("id, description, department_id, supplier, invoice_no, amount, spent_on, method, group_id, player_id, document_path, purchase_request_id, bank_line_id, purchase_requests(number)")
    .is("deleted_at", null).gte("spent_on", month).lt("spent_on", addMonths(month, 1)).order("spent_on", { ascending: false });
  if (inDep) q = q.in("department_id", inDep);
  const { data } = await q;
  const all = data ?? [];
  const { data: docRows } = all.length
    ? await db.from("expense_documents").select("expense_id, kind, path, file_name").in("expense_id", all.map((r) => r.id)).order("created_at")
    : { data: [] };
  const docsOf = new Map<string, ExpenseDoc[]>();
  for (const d of docRows ?? []) docsOf.set(d.expense_id, [...(docsOf.get(d.expense_id) ?? []), { kind: d.kind as ExpenseDoc["kind"], path: d.path, file_name: d.file_name }]);
  const docCount = (r: { id: string; document_path: string | null }) => (r.document_path ? 1 : 0) + (docsOf.get(r.id)?.length ?? 0);
  const onlyMissing = sp.doc === "lipsa";
  const missing = all.filter((r) => !docCount(r)).length;
  const rows = onlyMissing ? all.filter((r) => !docCount(r)) : all;
  const name = new Map(depts.map((d) => [d.id, d]));
  const deptLabel = (id: string | null) => {
    const d = id ? name.get(id) : null;
    if (!d) return "—";
    return d.parentId ? `${name.get(d.parentId)?.name ?? ""} › ${d.name}` : d.name;
  };
  const teams = ctx.groups.filter((g) => g.is_active).map((g) => ({ id: g.id, label: g.name }));
  const pl = (players.data ?? []).map((p) => ({ id: p.id, label: p.full_name }));
  const href = (o: { luna?: string; dep?: string | null; doc?: boolean }) => {
    const u = new URLSearchParams({ luna: (o.luna ?? month).slice(0, 7) });
    const d = o.dep === undefined ? dep : o.dep;
    if (d) u.set("dep", d);
    if (o.doc ?? onlyMissing) u.set("doc", "lipsa");
    return `/bani/cheltuieli?${u.toString()}`;
  };
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const zipHref = `/api/bani/documente?${new URLSearchParams({ luna: month.slice(0, 7), ...(dep ? { dep } : {}) }).toString()}`;

  return (
    <>
      <PageHeader title={t.title} description={t.description} action={<>
        <DepartmentsButton depts={depts} />
        <ExpenseButton clubId={ctx.club.id} today={ctx.today} depts={depts} teams={teams} players={pl} />
      </>} />
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="w-72"><PrevNext prevHref={href({ luna: addMonths(month, -1) })} nextHref={href({ luna: addMonths(month, 1) })} label={monthLabel(month)} /></div>
        <p className="text-lg font-bold"><Money value={total} /></p>
        {all.length ? (
          <a href={zipHref} className={buttonClass("secondary", "md", "ml-auto")} title={t.docs.zipHint}>
            <Download className="size-5" aria-hidden />{t.docs.zip}
          </a>
        ) : null}
      </div>
      {all.length ? (
        <div className="mb-4 space-y-3">
          <FilterLinks label={t.docs.title} items={[
            { href: href({ doc: false }), label: t.docs.filterAll, active: !onlyMissing },
            { href: href({ doc: true }), label: `${t.docs.filterMissing} · ${missing}`, active: onlyMissing },
          ]} />
          {missing && !onlyMissing ? <Notice tone="yellow">{t.docs.missingCount(missing)}</Notice> : null}
        </div>
      ) : null}
      {roots.length ? (
        <div className="mb-4"><FilterLinks label={t.filterAll} items={[
          { href: href({ dep: null }), label: t.filterAll, active: !dep },
          ...roots.map((d) => ({ href: href({ dep: d.id }), label: d.name, active: dep === d.id })),
        ]} /></div>
      ) : null}
      {rows.length === 0 ? <EmptyState title={t.empty} /> : (
        <TableWrap>
          <>
            <thead>
              <tr>
                <th scope="col">{t.cols.date}</th><th scope="col">{t.cols.what}</th><th scope="col">{t.cols.department}</th>
                <th scope="col">{t.cols.supplier}</th><th scope="col" className="text-right">{t.cols.amount}</th><th scope="col">{t.cols.doc}</th><th scope="col"><span className="sr-only">{getT().money.common.edit}</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const pr = r.purchase_requests as { number: number } | null;
                return (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap tabular-nums">{formatDateShort(r.spent_on)}</td>
                    <td>
                      <span className="block font-semibold">{r.description}</span>
                      <span className="flex flex-wrap gap-x-3 text-sm text-ink-3">
                        {pr && r.purchase_request_id ? <Link href={`/bani/referate/${r.purchase_request_id}`} className="underline">{t.fromRequest(pr.number)}</Link> : null}
                        {r.bank_line_id ? <span className="inline-flex items-center gap-1"><Landmark className="size-3.5" aria-hidden />{t.bankLinked}</span> : null}
                        {r.invoice_no ? <span>{r.invoice_no}</span> : null}
                      </span>
                    </td>
                    <td className="text-sm">{deptLabel(r.department_id)}</td>
                    <td className="text-sm">{r.supplier ?? "—"}</td>
                    <td className="text-right font-semibold"><Money value={r.amount} /></td>
                    <td className="whitespace-nowrap">
                      {r.document_path ? <a href={`/api/files/finance/${r.document_path.split("/").map(encodeURIComponent).join("/")}`} target="_blank" rel="noreferrer" aria-label={t.fields.document} className="inline-flex size-10 items-center justify-center rounded-lg hover:bg-sunken"><FileText className="size-5" aria-hidden /></a> : null}
                      {docsOf.get(r.id)?.length ? <span className="text-sm text-ink-3">+{docsOf.get(r.id)!.length}</span> : null}
                      {!docCount(r) ? <span className="text-sm font-medium text-st-red">{t.docs.none}</span> : null}
                    </td>
                    <td className="text-right"><ExpenseButton clubId={ctx.club.id} today={ctx.today} depts={depts} teams={teams} players={pl}
                      expense={{ id: r.id, description: r.description, department_id: r.department_id, supplier: r.supplier, invoice_no: r.invoice_no, amount: r.amount, spent_on: r.spent_on, method: r.method as "bank", group_id: r.group_id, player_id: r.player_id, document_path: r.document_path, documents: docsOf.get(r.id) ?? [] }} /></td>
                  </tr>
                );
              })}
            </tbody>
          </>
        </TableWrap>
      )}
    </>
  );
}
