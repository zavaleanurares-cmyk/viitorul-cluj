import "server-only";
import { createServiceDb } from "@club/db";
import { formatDateShort, formatLei, leiInWords, PAYMENT_METHOD_LABELS, type Db } from "@club/shared";
import { Report } from "@/components/reports/pdf";
import { getT } from "@/messages";

/**
 * Chitanța (plată în numerar) și dovada plății (orice plată), ca PDF.
 * Rândul se citește cu identitatea utilizatorului (RLS: biroul sau familia); datele clubului
 * de pe document (beneficiar, CIF, adresă) se citesc apoi cu clientul de serviciu.
 */
async function clubInfo(clubId: string) {
  const admin = createServiceDb();
  const [{ data: fs }, { data: club }] = await Promise.all([
    admin.from("finance_settings").select("beneficiary, fiscal_code, address, iban, bank_name").eq("club_id", clubId).maybeSingle(),
    admin.from("clubs").select("name").eq("id", clubId).single(),
  ]);
  return { name: fs?.beneficiary || club?.name || "", fiscalCode: fs?.fiscal_code ?? null, address: fs?.address ?? null, iban: fs?.iban ?? null, bank: fs?.bank_name ?? null };
}

async function issuerName(id: string | null): Promise<string | null> {
  if (!id) return null;
  const { data } = await createServiceDb().from("profiles").select("full_name").eq("id", id).maybeSingle();
  return data?.full_name ?? null;
}

export async function receiptPdf(db: Db, receiptId: string): Promise<{ bytes: Uint8Array; name: string } | null> {
  const t = getT().money.documents;
  const { data: r } = await db.from("receipts").select("*").eq("id", receiptId).maybeSingle();
  if (!r) return null;
  const club = await clubInfo(r.club_id);
  const cashier = await issuerName(r.issued_by);
  const doc = await Report.create({
    club: club.name, title: t.receiptTitle, subtitle: t.receiptSubtitle(r.series, r.number, formatDateShort(r.issued_on)),
    generated: "", footer: t.footer, pageLabel: (n, total) => `${n} / ${total}`,
  });
  doc.keyValues([[t.beneficiary, club.name], [t.fiscalCode, club.fiscalCode], [t.address, club.address]], 1);
  doc.space(10);
  if (r.cancelled_at) doc.paragraph(t.cancelled(r.cancel_reason ?? ""), { bold: true, size: 12 });
  doc.keyValues([
    [t.receivedFrom, r.payer_name],
    [t.amount, formatLei(r.amount, { decimals: "always" })],
    [t.inWords, leiInWords(r.amount)],
    [t.representing, r.description],
  ], 1);
  doc.space(24);
  doc.keyValues([[t.cashier, cashier ?? ""], [t.signature, ""]], 2);
  return { bytes: await doc.bytes(), name: `chitanta-${r.series}-${r.number}.pdf` };
}

export async function paymentProofPdf(db: Db, paymentId: string): Promise<{ bytes: Uint8Array; name: string } | null> {
  const t = getT().money.documents;
  const { data: p } = await db.from("payments").select("*").eq("id", paymentId).maybeSingle();
  if (!p) return null;
  const { data: allocs } = await db.from("allocations").select("amount, charges(title, players(full_name))").eq("payment_id", paymentId);
  const club = await clubInfo(p.club_id);
  const doc = await Report.create({
    club: club.name, title: t.proofTitle, subtitle: t.proofSubtitle(formatDateShort(p.received_on)),
    generated: "", footer: t.footer, pageLabel: (n, total) => `${n} / ${total}`,
  });
  if (p.status === "void") doc.paragraph(t.cancelled(p.void_reason ?? ""), { bold: true, size: 12 });
  doc.keyValues([
    [t.beneficiary, club.name], [t.fiscalCode, club.fiscalCode],
    [t.paidBy, p.payer_name], [t.method, PAYMENT_METHOD_LABELS[p.method] ?? p.method],
    [t.amount, formatLei(p.amount, { decimals: "always" })],
    ...(p.refunded_amount ? [[t.refunded, formatLei(p.refunded_amount, { decimals: "always" })] as [string, string]] : []),
    ...(p.provider_ref ? [[t.reference, p.provider_ref] as [string, string]] : p.reference ? [[t.reference, p.reference] as [string, string]] : []),
  ], 1);
  doc.heading(t.allocations, 40);
  doc.table(
    [{ header: t.colFor, width: 0.7 }, { header: t.colAmount, width: 0.3, align: "right" }],
    (allocs ?? []).map((a) => {
      const c = a.charges as { title: string; players: { full_name: string } | null } | null;
      return [`${c?.title ?? ""}${c?.players ? ` – ${c.players.full_name}` : ""}`, formatLei(a.amount, { decimals: "always" })];
    }),
    { empty: t.noAllocations },
  );
  return { bytes: await doc.bytes(), name: `plata-${p.received_on}-${p.id.slice(0, 8)}.pdf` };
}
