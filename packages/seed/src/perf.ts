/**
 * Clubul demo, faza 4 (Performanță și Club). Fiecare modul își adaugă aici datele, cu identitatea
 * conturilor demo, prin aceleași funcții ca aplicația. Totul inventat.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createDb, type Db } from "@club/db";
import { STANDARD_BATTERIES, STANDARD_TEMPLATES, addDays, todayIn } from "@club/shared";
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
  await seedBody(admin, clubId, today);
  await seedBatteries(ids);
  await seedEvaluations(admin, clubId, ids, today);
}

/** Bateriile standard „Viteză și forță" și „Rezistență și mobilitate", create de preparator. */
async function seedBatteries(ids: Record<string, string>) {
  if (!ids.preparator) return;
  const physio = createDb({ sub: ids.preparator, role: "authenticated" });
  const { count } = await physio.from("fitness_batteries").select("id", { count: "exact", head: true });
  if (count) return;
  for (const b of STANDARD_BATTERIES.filter((x) => ["speed", "endurance"].includes(x.key))) {
    await rpc(physio, "create_fitness_battery", { p: { name: b.name, description: b.description, tests: b.tests } }, `baterie ${b.name}`);
  }
}

/**
 * Evaluări: modelul „Dezvoltare", o rundă publicată pentru U17 (toamna trecută → familia vede profilul)
 * și o rundă deschisă pentru U19, notată pe jumătate de antrenor.
 */
async function seedEvaluations(admin: Db, clubId: string, ids: Record<string, string>, today: string) {
  if (!ids.director || !ids["antrenor.juniori"]) return;
  const director = createDb({ sub: ids.director, role: "authenticated" });
  const coach = createDb({ sub: ids["antrenor.juniori"], role: "authenticated" });
  const { count } = await director.from("evaluation_rounds").select("id", { count: "exact", head: true });
  if (count) return;
  const tplData = STANDARD_TEMPLATES.find((x) => x.key === "development")!;
  const tpl = await rpc<string>(director, "save_evaluation_template", { p: { name: tplData.name, age_label: tplData.age_label, criteria: tplData.criteria } }, "model");
  const crit = must(await director.from("evaluation_criteria").select("id, category").eq("template_id", tpl).order("sort"), "criterii");
  const { data: groups } = await admin.from("groups").select("id, name").eq("club_id", clubId);
  const g = (n: string) => groups?.find((x) => x.name === n)?.id;
  let seed = 777;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const goals = ["Prima atingere cu piciorul slab, 10 minute pe zi.", "Comunicare mai multă în faza defensivă.", "Sprinturi repetate: păstrează intensitatea până la final.", "Decizie mai rapidă la pasa de după preluare."];
  const rate = async (round: string, player: string, submit: boolean, shift = 0) => {
    const scores = Object.fromEntries(crit.map((c) => [c.id, Math.max(1, Math.min(5, Math.round(2.6 + rnd() * 2 + shift)))]));
    await rpc(coach, "save_evaluation", { p_round: round, p_player: player, p_scores: scores, p_strengths: "Atitudine foarte bună la antrenament.",
      p_next_goals: goals[Math.floor(rnd() * goals.length)], p_comment: null, p_submit: submit }, "evaluare");
  };
  const u17 = g("U17");
  if (u17) {
    const r1 = await rpc<string>(director, "start_evaluation_round", { p: { name: "Primăvara 2026", template_id: tpl, group_ids: [u17], due_on: addDays(today, -150) } }, "runda U17");
    const { data: players } = await admin.from("players").select("id").eq("group_id", u17).eq("is_active", true);
    for (const p of players ?? []) await rate(r1, p.id, true, -0.4);
    await rpc(director, "publish_evaluation_round", { p_round: r1 }, "publicare U17");
    const r2 = await rpc<string>(director, "start_evaluation_round", { p: { name: "Toamna 2026", template_id: tpl, group_ids: [u17], due_on: addDays(today, -2) } }, "runda U17 toamna");
    for (const p of players ?? []) await rate(r2, p.id, true, 0.3);
    await rpc(director, "publish_evaluation_round", { p_round: r2 }, "publicare U17 toamna");
  }
  const u19 = g("U19");
  if (u19) {
    const r = await rpc<string>(director, "start_evaluation_round", { p: { name: "Toamna 2026", template_id: tpl, group_ids: [u19], due_on: addDays(today, 10) } }, "runda U19");
    const { data: players } = await admin.from("players").select("id").eq("group_id", u19).eq("is_active", true).order("display_name");
    for (const [i, p] of (players ?? []).entries()) if (i < 6) await rate(r, p.id, i < 5);
  }
}

/**
 * Greutate: la două săptămâni, ultimele 12 săptămâni, cu variații mici; doi jucători slăbesc vizibil
 * (ca semnalul „Schimbare rapidă" să aibă ce arăta). Înlocuiește valorile generate la întâmplare de seed-ul Vestiar.
 */
async function seedBody(admin: Db, clubId: string, today: string) {
  const { data: players } = await admin.from("players").select("id, birth_date").eq("club_id", clubId).eq("is_active", true).order("display_name");
  const ids = (players ?? []).map((p) => p.id);
  if (!ids.length) return;
  const { data: existing } = await admin.from("anthropometrics").select("player_id, weight_kg, height_cm").in("player_id", ids).order("measured_on");
  const marker = await admin.from("anthropometrics").select("id", { count: "exact", head: true }).in("player_id", ids).eq("notes", "demo-serie");
  if (marker.count) return;
  const first = new Map<string, { w: number; h: number | null }>();
  for (const e of existing ?? []) if (!first.has(e.player_id) && e.weight_kg) first.set(e.player_id, { w: Number(e.weight_kg), h: e.height_cm ? Number(e.height_cm) : null });
  await admin.from("anthropometrics").delete().in("player_id", ids);
  let seed = 4242;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const rows: Array<{ player_id: string; measured_on: string; weight_kg: number; height_cm: number | null; body_fat_pct: number; notes: string | null }> = [];
  ids.forEach((id, i) => {
    const base = first.get(id) ?? { w: 62 + Math.round(rnd() * 16), h: 172 + Math.round(rnd() * 14) };
    const losing = i % 11 === 3;
    for (let k = 6; k >= 0; k--) {
      const drift = losing ? -(6 - k) * 0.55 : (rnd() - 0.5) * 0.8;
      rows.push({
        player_id: id, measured_on: addDays(today, -14 * k - 1), weight_kg: Math.round((base.w + drift) * 10) / 10,
        height_cm: base.h, body_fat_pct: Math.round((10 + rnd() * 4) * 10) / 10, notes: k === 0 ? "demo-serie" : null,
      });
    }
  });
  for (let i = 0; i < rows.length; i += 200) must(await admin.from("anthropometrics").insert(rows.slice(i, i + 200)).select("id"), "greutate demo");
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
