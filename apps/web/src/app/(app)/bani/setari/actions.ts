"use server";
import { z } from "zod";
import { isValidIban, normalizeIban } from "@club/shared";
import { fail, run } from "@/lib/actions";
import { availableProviders } from "@/lib/payments/registry";
import { getT } from "@/messages";

const days = z.array(z.number().int().min(1).max(28)).max(10);
const Settings = z.object({
  beneficiary: z.string().max(200),
  fiscal_code: z.string().max(30),
  address: z.string().max(300),
  iban: z.string().max(40),
  bank_name: z.string().max(80),
  receipt_prefix: z.string().regex(/^[A-Z0-9]{1,6}$/, "Seria: 1–6 litere mari sau cifre."),
  ref_prefix: z.string().regex(/^[A-Z0-9]{2,6}$/, "Prefixul: 2–6 litere mari sau cifre."),
  issue_day: z.number().int().min(1).max(28),
  due_day: z.number().int().min(1).max(28),
  reminder_days: days,
  fee_months: z.array(z.number().int().min(1).max(12)).max(12),
  sibling_discount_pct: z.number().int().min(0).max(100),
  auto_issue: z.boolean(),
  online_enabled: z.boolean(),
  provider: z.string().max(32),
  vat_rates: z.array(z.number().int().min(0).max(100)).min(1).max(6),
  approver_roles: z.array(z.enum(["admin", "owner", "sporting_director", "accountant", "secretary"])).min(1, "Alege cel puțin un rol care aprobă referatele."),
});

export async function saveFinanceSettings(input: z.input<typeof Settings>) {
  return run({ roles: ["admin", "accountant"], revalidate: ["/bani", "/bani/setari", "/bani/taxe", "/plati"], message: getT().money.settings.saved }, async ({ db, ctx }) => {
    const s = Settings.parse(input);
    const iban = s.iban ? normalizeIban(s.iban) : "";
    if (iban && !isValidIban(iban)) fail(getT().money.settings.invalidIban);
    if (!availableProviders().some((p) => p.id === s.provider)) fail("Operator de plăți necunoscut.");
    const { provider, ...rest } = s;
    const { error } = await db.from("finance_settings").update({
      ...rest, iban: iban || null, beneficiary: s.beneficiary.trim() || null, fiscal_code: s.fiscal_code.trim() || null,
      address: s.address.trim() || null, bank_name: s.bank_name.trim() || null,
    }).eq("club_id", ctx.club.id);
    if (error) fail(error.message);
    // operatorul nu se schimbă din aplicație decât printre adaptoarele instalate (coloana nu e deschisă utilizatorilor)
    if (provider) {
      const { createServiceDb } = await import("@club/db");
      const { error: e2 } = await createServiceDb().from("finance_settings").update({ provider }).eq("club_id", ctx.club.id);
      if (e2) fail(e2.message);
    }
    return null;
  });
}
