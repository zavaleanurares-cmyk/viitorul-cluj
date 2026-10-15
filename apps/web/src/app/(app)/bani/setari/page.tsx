import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/auth";
import { PageHeader } from "@/components/ui/card";
import { FinanceSettingsForm } from "@/components/money/settings-form";
import { getFinanceSettings } from "@/components/money/queries";
import { availableProviders } from "@/lib/payments/registry";
import { formatIban } from "@club/shared";
import { getT } from "@/messages";

export const metadata = { title: "Setări financiare" };

export default async function FinanceSettingsPage() {
  const { db, ctx } = await requireCapability("administerMoney");
  const t = getT().money.settings;
  const s = await getFinanceSettings(db);
  if (!s) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader title={t.title} description={t.description} />
      <FinanceSettingsForm providers={availableProviders()} canSetApprovers={ctx.role === "admin"} initial={{
        beneficiary: s.beneficiary ?? "", fiscal_code: s.fiscal_code ?? "", address: s.address ?? "", iban: s.iban ? formatIban(s.iban) : "", bank_name: s.bank_name ?? "",
        receipt_prefix: s.receipt_prefix, ref_prefix: s.ref_prefix, issue_day: s.issue_day, due_day: s.due_day, reminder_days: s.reminder_days, fee_months: s.fee_months,
        sibling_discount_pct: s.sibling_discount_pct, auto_issue: s.auto_issue, online_enabled: s.online_enabled, provider: s.provider, vat_rates: s.vat_rates, approver_roles: s.approver_roles,
      }} />
    </div>
  );
}
