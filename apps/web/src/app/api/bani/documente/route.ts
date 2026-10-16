import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { zipSync } from "fflate";
import { can, formatLei } from "@club/shared";
import { getSession } from "@/lib/auth";
import { canAccess, presignedReadUrl, putFile, readFile, storageMode } from "@/lib/files";
import { addMonths } from "@/components/money/queries";
import { getT } from "@/messages";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DIRECT_LIMIT = 4 * 1024 * 1024;
const MAX_TOTAL = 300 * 1024 * 1024;

const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "cheltuiala";
const csvCell = (v: string) => (/[";\n]/.test(v) || /^[=+\-@]/.test(v) ? `"${v.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : v);

/**
 * Dosarul lunii pentru contabilitate: toate documentele cheltuielilor dintr-o lună (factura și documentele
 * justificative), câte un folder pe cheltuială, plus opisul în CSV. Doar biroul financiar; descărcarea se jurnalizează.
 */
export async function GET(request: NextRequest) {
  const tm = getT().money.expenses;
  const session = await getSession();
  if (!session) return NextResponse.json({ eroare: getT().admin.errors.sessionExpired }, { status: 401 });
  const { db, ctx } = session;
  if (!can(ctx.role, "manageMoney")) return NextResponse.json({ eroare: getT().admin.errors.forbidden }, { status: 403 });

  const luna = request.nextUrl.searchParams.get("luna") ?? "";
  if (!/^\d{4}-\d{2}$/.test(luna)) return NextResponse.json({ eroare: "Luna nu este validă." }, { status: 400 });
  const month = `${luna}-01`;
  const dep = request.nextUrl.searchParams.get("dep");

  let deptIds: string[] | null = null;
  const { data: depts } = await db.from("departments").select("id, name, parent_id").is("deleted_at", null);
  if (dep && /^[0-9a-f-]{36}$/i.test(dep)) deptIds = [dep, ...(depts ?? []).filter((d) => d.parent_id === dep).map((d) => d.id)];
  const deptName = new Map((depts ?? []).map((d) => [d.id, d.name]));

  let q = db.from("expenses").select("id, description, department_id, supplier, invoice_no, amount, spent_on, document_path")
    .is("deleted_at", null).gte("spent_on", month).lt("spent_on", addMonths(month, 1)).order("spent_on");
  if (deptIds) q = q.in("department_id", deptIds);
  const { data: expenses, error } = await q;
  if (error) return NextResponse.json({ eroare: error.message }, { status: 500 });
  const rows = expenses ?? [];
  const { data: extra } = rows.length
    ? await db.from("expense_documents").select("expense_id, kind, path, file_name").in("expense_id", rows.map((r) => r.id)).order("created_at")
    : { data: [] };

  const files: Record<string, Uint8Array> = {};
  const index = [["Nr.", "Data", "Descriere", "Departament", "Furnizor", "Nr. factură", "Suma (lei)", "Documente"]];
  let total = 0;
  let n = 0;
  let withDocs = 0;
  for (const r of rows) {
    n++;
    const docs = [
      ...(r.document_path ? [{ kind: "invoice", path: r.document_path, file_name: r.document_path.split("/").pop()!.replace(/^[0-9a-f-]{37}/, "") || "factura" }] : []),
      ...(extra ?? []).filter((d) => d.expense_id === r.id),
    ];
    const folder = `${String(n).padStart(3, "0")}_${r.spent_on}_${slug(r.supplier || r.description)}`;
    const names: string[] = [];
    for (const d of docs) {
      if (!(await canAccess(db, "finance", d.path, "read"))) continue;
      const f = await readFile("finance", d.path);
      if (!f) continue;
      const buf = new Uint8Array(await new Response(f.stream).arrayBuffer());
      total += buf.length;
      if (total > MAX_TOTAL) return NextResponse.json({ eroare: tm.docs.zipTooBig }, { status: 413 });
      const kind = d.kind === "invoice" ? "factura" : slug(tm.docs.kinds[d.kind] ?? d.kind).toLowerCase();
      let name = `${kind}_${d.file_name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").slice(-80)}`;
      while (names.includes(name)) name = `1-${name}`;
      names.push(name);
      files[`${folder}/${name}`] = buf;
    }
    if (names.length) withDocs++;
    index.push([String(n), r.spent_on, r.description, r.department_id ? deptName.get(r.department_id) ?? "" : "", r.supplier ?? "", r.invoice_no ?? "",
      formatLei(r.amount, { currency: false }), names.length ? names.join(", ") : tm.docs.none]);
  }
  if (!withDocs) return NextResponse.json({ eroare: tm.docs.zipEmpty }, { status: 404 });
  files["opis.csv"] = new TextEncoder().encode("﻿" + index.map((l) => l.map(csvCell).join(";")).join("\r\n"));
  const zip = zipSync(files, { level: 1 });

  await db.rpc("log_event", { p_action: "EXPORT", p_entity: "expense_documents", p_details: { month: luna, expenses: rows.length, files: Object.keys(files).length - 1 } });
  const filename = `documente-${ctx.club.slug}-${luna}.zip`;
  if (zip.length > DIRECT_LIMIT && storageMode() === "blob") {
    const path = `${ctx.club.id}/${luna}-documente-${crypto.randomUUID()}.zip`;
    await putFile("exports", path, Buffer.from(zip), "application/zip");
    const url = await presignedReadUrl("exports", path, 15 * 60);
    if (url) return NextResponse.redirect(url, { status: 303, headers: { "Cache-Control": "no-store" } });
  }
  return new NextResponse(Buffer.from(zip), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" },
  });
}
