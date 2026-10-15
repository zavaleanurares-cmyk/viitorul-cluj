import "server-only";
import { createServiceDb } from "@club/db";
import { formatDateTime, type Db } from "@club/shared";
import { Report } from "@/components/reports/pdf";
import { readFile } from "@/lib/files";
import { getT } from "@/messages";

async function streamBytes(stream: ReadableStream): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); }
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

/**
 * Contractul semnat ca PDF: textul exact trimis, semnătura desenată, cine, când, de unde, amprenta,
 * apoi urma de audit. Rândul se citește cu identitatea utilizatorului (biroul sau semnatarul).
 */
export async function contractPdf(db: Db, id: string, timezone: string): Promise<{ bytes: Uint8Array; name: string } | null> {
  const t = getT().club.contracts;
  const { data: c } = await db.from("contracts").select("*, players(display_name)").eq("id", id).maybeSingle();
  if (!c) return null;
  const { data: events } = await db.from("contract_events").select("at, action, ip, details, actor_id, profiles(full_name)").eq("contract_id", id).order("at");
  const { data: club } = await createServiceDb().from("clubs").select("name").eq("id", c.club_id).single();
  const doc = await Report.create({
    club: club?.name ?? "", title: c.title, subtitle: (c.players as { display_name: string } | null)?.display_name ?? undefined,
    generated: "", footer: c.document_hash ? `${t.family.hash}: ${c.document_hash.slice(0, 16)}…` : t.status[c.status as "sent"], pageLabel: (n, total) => `${n} / ${total}`,
  });
  doc.paragraph(c.body, { size: 10.5 });
  doc.space(14);
  if (c.status === "signed") {
    doc.heading(t.status.signed, 120);
    if (c.signature_path) {
      const f = await readFile("contracts", c.signature_path);
      if (f) await doc.image(await streamBytes(f.stream), { width: 220, height: 90 });
    }
    doc.keyValues([
      [t.pdfLabels.signedBy, c.signed_name],
      [t.pdfLabels.when, c.signed_at ? formatDateTime(c.signed_at, timezone) : null],
      ["IP", c.signed_ip],
      [t.family.hash, c.document_hash],
    ], 1);
    doc.space(6);
    doc.paragraph(t.family.legal, { size: 9, muted: true });
  } else {
    doc.paragraph(t.status[c.status as "sent"], { bold: true });
  }
  doc.heading(t.trail, 40);
  doc.table(
    [{ header: t.pdfLabels.when, width: 0.3 }, { header: t.pdfLabels.action, width: 0.2 }, { header: t.pdfLabels.by, width: 0.3 }, { header: "IP", width: 0.2 }],
    (events ?? []).map((e) => [formatDateTime(e.at, timezone), t.events[e.action as keyof typeof t.events] ?? e.action, !e.actor_id ? t.automatic : e.actor_id === c.signer_user_id ? c.signer_name : (e.profiles as { full_name: string } | null)?.full_name ?? "—", e.ip ?? ""]),
  );
  const safe = c.title.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").slice(0, 60);
  return { bytes: await doc.bytes(), name: `${safe}.pdf` };
}
