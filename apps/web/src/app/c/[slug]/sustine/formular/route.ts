import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAnonDb } from "@club/db";
import { COUNTIES, formatDate, friendlyError, isValidCnp, todayIn } from "@club/shared";
import { fileResponse } from "@/components/reports/http";
import { Report } from "@/components/reports/pdf";
import { visitorIp } from "@/lib/public-site";
import { getT } from "@/messages";

export const dynamic = "force-dynamic";

const s = (max: number) => z.string().trim().max(max);
const Form = z.object({
  lastName: s(60).min(2), firstName: s(60).min(2), fatherInitial: s(3).optional().default(""),
  cnp: z.string().trim().refine(isValidCnp),
  street: s(100).min(2), number: s(10).min(1), block: s(10).optional().default(""), stair: s(5).optional().default(""),
  floor: s(5).optional().default(""), apartment: s(6).optional().default(""),
  county: z.enum(COUNTIES), city: s(60).min(2), postalCode: s(6).optional().default(""),
  email: z.union([z.email(), z.literal("")]).optional().default(""), phone: s(20).optional().default(""),
  twoYears: z.boolean(), shareData: z.boolean(), keepContact: z.boolean(),
  startedAt: z.number(), website: z.string().max(200).optional(),
});

const err = (message: string, status = 400) => NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Formularul 230 completat: se înregistrează doar numele (și contactul, cu acord), apoi se întoarce PDF-ul.
 * CNP-ul și adresa trăiesc doar în această cerere: nu se scriu în baza de date și nu se scriu în jurnale.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = getT().club.supporters;
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) return err("Origine nepermisă.", 403);
  let body: unknown;
  try { body = await request.json(); } catch { return err(getT().site.errors.generic); }
  const parsed = Form.safeParse(body);
  if (!parsed.success) return err(parsed.error.issues.some((i) => i.path[0] === "cnp") ? t.public.cnpInvalid : getT().club.enrolment.errors.invalid);
  const v = parsed.data;
  if (v.website || Date.now() - v.startedAt < 3000) return err(getT().site.errors.tooFast);
  const fullName = `${v.lastName} ${v.fatherInitial ? `${v.fatherInitial.replace(/\.?$/, ".")} ` : ""}${v.firstName}`;
  const { data, error } = await createAnonDb().rpc("record_support_pledge", {
    p_slug: slug, p_ip: (await visitorIp()) ?? undefined,
    p: { full_name: fullName, email: v.email, phone: v.phone, two_years: v.twoYears, keep_contact: v.keepContact },
  });
  if (error) return err(friendlyError(error), error.code === "54000" ? 429 : 400);
  const club = data as { name: string; fiscal_code: string; iban: string; income_year: number };

  const p = t.pdf;
  const doc = await Report.create({
    club: club.name, title: p.title, subtitle: p.subtitle(club.income_year), generated: "", footer: p.subtitle(club.income_year),
    pageLabel: (n, total) => `${n} / ${total}`,
  });
  const address = [`Str. ${v.street} nr. ${v.number}`, v.block && `bl. ${v.block}`, v.stair && `sc. ${v.stair}`, v.floor && `et. ${v.floor}`,
    v.apartment && `ap. ${v.apartment}`, v.city, `jud. ${v.county}`, v.postalCode && `cod poștal ${v.postalCode}`].filter(Boolean).join(", ");
  doc.heading(p.s1);
  doc.keyValues([[p.name, v.lastName], [p.initial, v.fatherInitial || "—"], [p.firstName, v.firstName], [p.cnp, v.cnp]], 2);
  doc.keyValues([[p.address, address], [p.email, v.email || "—"], [p.phone, v.phone || "—"]], 1);
  doc.space(10);
  doc.heading(p.s2);
  doc.paragraph(p.entity, { bold: true });
  doc.keyValues([[p.beneficiary, club.name], [p.fiscalCode, club.fiscal_code], [p.iban, club.iban], [p.percent, p.percentValue], [p.twoYears, v.twoYears ? p.yes : p.no]], 1);
  doc.space(6);
  doc.paragraph(p.consent(v.shareData));
  doc.space(28);
  doc.keyValues([[p.signature, "________________________"], [p.date, formatDate(todayIn())]], 2);
  doc.space(18);
  doc.paragraph(p.note, { size: 9, muted: true });
  return fileResponse(await doc.bytes(), `formular-230-${club.income_year}.pdf`, "pdf");
}
