import Link from "next/link";
import { requireCapability } from "@/lib/auth";
import { PageHeader } from "@/components/ui/card";
import { PurchaseForm } from "@/components/money/purchase-form";
import { getT } from "@/messages";
import { formOptions } from "../queries";

export const metadata = { title: "Referat nou" };

export default async function NewPurchasePage() {
  const { db, ctx } = await requireCapability("purchaseRequests");
  const t = getT().money.purchases;
  const { departments, vatRates } = await formOptions(db);
  const teams = ctx.groups.filter((g) => g.is_active && (ctx.role !== "coach" || ctx.staffGroupIds.includes(g.id))).map((g) => ({ id: g.id, label: g.name }));
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t.form.newTitle} back={<Link href="/bani/referate" className="font-semibold underline">{t.title}</Link>} />
      <PurchaseForm clubId={ctx.club.id} userId={ctx.userId} departments={departments} teams={teams} vatRates={vatRates}
        initial={{ id: null, department_id: null, group_id: teams.length === 1 ? teams[0].id : null, justification: "", needed_by: null, spec_path: null,
          items: [{ name: "", details: "", unit: "buc", quantity: 1, unit_price: null, vat_rate: vatRates[0] ?? 21, price_includes_vat: true }] }} />
    </div>
  );
}
