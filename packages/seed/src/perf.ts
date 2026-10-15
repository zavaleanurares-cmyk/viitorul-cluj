/**
 * Clubul demo, faza 4 (Performanță și Club). Fiecare modul își adaugă aici datele, cu identitatea
 * conturilor demo, prin aceleași funcții ca aplicația. Totul inventat.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createDb, type Db } from "@club/db";
import { addDays, todayIn } from "@club/shared";
import { must } from "./common";

/** Un PDF minim (o pagină cu un titlu), ca documentele demo să se poată deschide. */
export function tinyPdf(title: string): Buffer {
  const text = title.replace(/[()\\]/g, "");
  const stream = `BT /F1 18 Tf 72 760 Td (${text}) Tj ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

/** Scrie un fișier demo în depozitul local (doar în dezvoltare; în producție depozitul e Vercel Blob). */
export function writeLocalFile(bucket: string, p: string, body: Buffer): boolean {
  if (process.env.BLOB_READ_WRITE_TOKEN) return false;
  const root = process.env.LOCAL_FILES_DIR ?? path.resolve(import.meta.dirname, "../../../tools/local-stack/.data/files");
  const file = path.join(root, bucket, ...p.split("/"));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
  return true;
}

async function rpc<T>(db: Db, fn: string, args: Record<string, unknown>, label: string): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).rpc(fn, args);
  if (error) throw new Error(`${label}: ${error.message}`);
  return data as T;
}

export async function seedPerfDemo(admin: Db, clubId: string, ids: Record<string, string>): Promise<void> {
  const today = todayIn();
  await seedVisas(admin, clubId, ids, today);
}

/** Vize: copilul părintelui demo expiră în 10 zile și părintele a trimis deja avizul nou (de aprobat). */
async function seedVisas(admin: Db, clubId: string, ids: Record<string, string>, today: string) {
  const { count } = await admin.from("visa_documents").select("id", { count: "exact", head: true }).eq("club_id", clubId);
  if (count || !ids.parinte) return;
  const { data: g } = await admin.from("guardians").select("id, guardian_players(player_id)").eq("user_id", ids.parinte).eq("club_id", clubId).maybeSingle();
  const child = (g?.guardian_players as Array<{ player_id: string }> | undefined)?.[0]?.player_id;
  if (!child) return;
  must(await admin.from("players").update({ medical_visa_expires_on: addDays(today, 10) }).eq("id", child).select("id"), "viza copilului");
  const p = `${child}/${crypto.randomUUID()}-aviz-medical.pdf`;
  if (!writeLocalFile("visas", p, tinyPdf("Aviz medical sportiv - demo"))) return;
  const parent = createDb({ sub: ids.parinte, role: "authenticated" });
  await rpc(parent, "submit_visa_document", {
    p_player: child, p_path: p, p_file_name: "aviz-medical.pdf", p_mime: "application/pdf", p_size: 900, p_issued_on: addDays(today, -2),
  }, "viza trimisă de părinte");
}
