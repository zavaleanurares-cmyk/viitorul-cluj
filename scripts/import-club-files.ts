/**
 * Importul inițial al celor două tabele ale clubului, cap-coadă, prin EXACT aceleași
 * funcții pe care le folosește ecranul de import (parsere din @club/shared + RPC-uri sub RLS),
 * autentificat ca preparator fizic.
 *
 *   npx tsx scripts/import-club-files.ts [--week 2026-09-28]
 *
 * Fișiere așteptate în data/private/: stare-de-sanatate.xlsx, fatigue-l3.xlsx
 * Deciziile de potrivire pe care în aplicație le ia preparatorul sunt luate aici după o
 * regulă prudentă: se acceptă doar propunerile din aceeași grupă; restul devin jucători
 * noi, marcați „de verificat".
 */
import path from "node:path";
import fs from "node:fs";
import { readSheet } from "read-excel-file/node";
import {
  parseHealthSheet, suggestGroupForBlock, buildHealthPayload, parseFatigueGrid, buildWellnessEntries,
  buildWellnessPayload, proposeMatch, decisionKey, hashSheet, weekStart, addDays, todayIn,
  type NameDecision, type Sheet,
} from "../packages/shared/src";
import { closePool, must, root, userClient } from "./lib";

const DOMAIN = process.env.DEMO_EMAIL_DOMAIN ?? "example.com";
const email = `preparator.viitorul@${DOMAIN}`;
const db = await userClient(email);
const dir = path.join(root, "data/private");
const weekArg = process.argv.indexOf("--week");
// implicit: săptămâna trecută
const week = weekArg > 0 ? process.argv[weekArg + 1] : addDays(weekStart(todayIn()), -7);

async function sheet(file: string): Promise<Sheet> {
  const p = path.join(dir, file);
  if (!fs.existsSync(p)) throw new Error(`Lipsește ${p}`);
  return (await readSheet(p)) as Sheet;
}

const groups = must(await db.from("groups").select("*").order("sort"), "grupe");

// ---- 1. STARE DE SANATATE ---------------------------------------------------
{
  const s = await sheet("stare-de-sanatate.xlsx");
  const parsed = parseHealthSheet(s);
  const blockGroups = parsed.blocks.map((b, i) => suggestGroupForBlock(b.label, groups, i)?.id ?? null);
  const existing = must(await db.from("players").select("id, display_name, full_name, group_id"), "jucători");
  const remembered = must(await db.from("name_matches").select("source_name, group_id, player_id"), "potriviri");
  const decisions: Record<string, NameDecision> = {};
  parsed.blocks.forEach((b, i) => {
    const gid = blockGroups[i];
    if (!gid) return;
    for (const r of b.rows) {
      const p = proposeMatch(r.name, gid, existing, remembered);
      const top = p.candidates[0];
      decisions[decisionKey(r.name, gid)] =
        p.confident && top.same_group ? { action: "match", player_id: top.player_id } : { action: "create" };
    }
  });
  const payload = buildHealthPayload({
    parsed, blockGroupIds: blockGroups, decisions,
    meta: { filename: "STARE DE SANATATE.xlsx", file_hash: await hashSheet(s) },
  });
  const res = must(await db.rpc("import_health_status", { p_payload: payload }), "import stare");
  console.log("Stare de sănătate:", JSON.stringify(res));
  parsed.blocks.forEach((b, i) =>
    console.log(`  bloc „${b.label || "(fără etichetă)"}" -> ${groups.find((g) => g.id === blockGroups[i])?.name}: ${b.rows.length} jucători`));
}

// ---- 2. FATIGUE L3 ------------------------------------------------------------
{
  const s = await sheet("fatigue-l3.xlsx");
  const grid = parseFatigueGrid(s);
  const l3 = groups[0];
  const { entries, namesWithoutData } = buildWellnessEntries(grid, grid.columns, week);
  const players = must(await db.from("players").select("id, display_name, full_name, group_id"), "jucători");
  const remembered = must(await db.from("name_matches").select("source_name, group_id, player_id"), "potriviri");
  const decisions: Record<string, NameDecision> = {};
  const log: string[] = [];
  for (const name of new Set(grid.rows.map((r) => r.name))) {
    const p = proposeMatch(name, l3.id, players, remembered);
    const top = p.candidates[0];
    const hasData = entries.some((e) => e.name === name);
    if (top && top.same_group && p.suggested === top.player_id) {
      decisions[decisionKey(name, l3.id)] = { action: "match", player_id: top.player_id };
      const target = players.find((x) => x.id === top.player_id)!.display_name;
      if (target !== name) log.push(`  „${name}" -> ${target} (${top.reason}, ${top.score})`);
    } else if (hasData) {
      decisions[decisionKey(name, l3.id)] = { action: "create" };
      log.push(`  „${name}" -> jucător nou, de verificat (nicio potrivire sigură în ${l3.name})`);
    } else {
      decisions[decisionKey(name, l3.id)] = { action: "skip" };
      log.push(`  „${name}" -> sărit (fără valori și fără potrivire în ${l3.name})`);
    }
  }
  const payload = buildWellnessPayload({
    entries, namesWithoutData, groupId: l3.id, decisions,
    meta: { filename: "FATIGUE STARE DE OBOSEALA L3.xlsx", file_hash: await hashSheet(s), mapping: { week, columns: grid.columns } },
  });
  const res = must(await db.rpc("import_wellness", { p_payload: payload }), "import chestionare");
  console.log(`Chestionare L3 (săptămâna ${week}):`, JSON.stringify(res));
  console.log(log.join("\n"));
}

const { count } = await db.from("players").select("id", { count: "exact", head: true });
console.log("Total jucători în evidență:", count);
await closePool();
