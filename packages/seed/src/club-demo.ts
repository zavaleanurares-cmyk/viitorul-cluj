/**
 * Clubul demo, faza 4 · Club: mesaje și contracte (apoi înscrieri, tabere, site, magazin, susținători).
 * Totul prin funcțiile aplicației, cu identitatea conturilor demo. Totul inventat.
 */
import crypto from "node:crypto";
import zlib from "node:zlib";
import { createDb, type Db } from "@club/db";
import { STANDARD_CONTRACTS, addDays, todayIn } from "@club/shared";
import { writeLocalFile } from "./perf";

async function rpc<T>(db: Db, fn: string, args: Record<string, unknown>, label: string): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).rpc(fn, args);
  if (error) throw new Error(`${label}: ${error.message}`);
  return data as T;
}

/** O semnătură desenată (PNG alb-negru, 360×120): o linie ondulată, ca să arate a semnătură în PDF. */
export function demoSignaturePng(): Buffer {
  const w = 360, h = 120;
  const px = new Uint8Array(w * h).fill(255);
  const dot = (x: number, y: number) => {
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const xx = Math.round(x) + dx, yy = Math.round(y) + dy;
      if (xx >= 0 && xx < w && yy >= 0 && yy < h) px[yy * w + xx] = 20;
    }
  };
  for (let t = 0; t <= 1; t += 0.0004) {
    const x = 20 + t * 320;
    const y = 62 + Math.sin(t * 19) * 26 * (1 - t * 0.6) + Math.sin(t * 61) * 6;
    dot(x, y);
  }
  for (let t = 0; t <= 1; t += 0.002) dot(150 + t * 190, 98 - t * 6); // sublinierea
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w + 1)] = 0; Buffer.from(px.subarray(y * w, (y + 1) * w)).copy(raw, y * (w + 1) + 1); }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

export async function seedClubDemo(admin: Db, clubId: string, ids: Record<string, string>): Promise<void> {
  const today = todayIn();
  await seedMessages(admin, clubId, ids, today);
  await seedContracts(admin, clubId, ids, today);
}

/** Mesaje: unul trimis părinților U17 (citit de părintele demo) și unul programat pentru mâine. */
async function seedMessages(admin: Db, clubId: string, ids: Record<string, string>, today: string) {
  const { count } = await admin.from("messages").select("id", { count: "exact", head: true }).eq("club_id", clubId);
  if (count || !ids.secretariat || !ids.parinte) return;
  const { data: g } = await admin.from("guardians").select("guardian_players(players(group_id))").eq("user_id", ids.parinte).eq("club_id", clubId).maybeSingle();
  const groupId = (g?.guardian_players as Array<{ players: { group_id: string } | null }> | undefined)?.[0]?.players?.group_id;
  if (!groupId) return;
  const office = createDb({ sub: ids.secretariat, role: "authenticated" });
  const sent = await rpc<{ id: string }>(office, "send_message", {
    p: {
      title: "Echipamentul pentru sezonul nou",
      body: "Bună ziua,\n\nEchipamentul de joc pentru sezonul nou se ridică de la secretariat, de luni până joi, între 16:00 și 19:00. Vă rugăm să verificați mărimea în aplicație înainte.\n\nMulțumim,\nSecretariatul clubului",
      audience: { audiences: ["guardians"], group_ids: [groupId], exclude_user_ids: [] },
    },
  }, "mesaj trimis");
  const parent = createDb({ sub: ids.parinte, role: "authenticated" });
  if (sent?.id) await rpc(parent, "mark_message_read", { p_id: sent.id }, "mesaj citit");
  await rpc(office, "send_message", {
    p: {
      title: "Ședința cu părinții",
      body: "Vă așteptăm joi, la ora 18:30, în sala de la stadion, pentru prezentarea programului de pregătire din iarnă.",
      audience: { audiences: ["guardians"], group_ids: [groupId], exclude_user_ids: [] },
      scheduled_at: `${addDays(today, 1)}T07:00:00Z`,
    },
  }, "mesaj programat");
}

/**
 * Contracte: modelele standard; acordul foto trimis echipei copilului părintelui demo (semnat de părinte, cu semnătură desenată),
 * contractul de participare în așteptare pentru același copil, regulamentul seniorilor trimis jucătorului adult (îl semnează singur).
 */
async function seedContracts(admin: Db, clubId: string, ids: Record<string, string>, today: string) {
  const { count } = await admin.from("contract_templates").select("id", { count: "exact", head: true }).eq("club_id", clubId);
  if (count || !ids.secretariat || !ids.parinte) return;
  const office = createDb({ sub: ids.secretariat, role: "authenticated" });
  const tpl: Record<string, string> = {};
  for (const s of STANDARD_CONTRACTS) tpl[s.key] = await rpc<string>(office, "save_contract_template", { p: { name: s.name, kind: s.kind, body: s.body } }, `model ${s.key}`);

  const { data: g } = await admin.from("guardians").select("guardian_players(player_id, players(group_id))").eq("user_id", ids.parinte).eq("club_id", clubId).maybeSingle();
  const link = (g?.guardian_players as Array<{ player_id: string; players: { group_id: string } | null }> | undefined)?.[0];
  if (!link?.players) return;
  const team = (await admin.from("players").select("id").eq("group_id", link.players.group_id).eq("is_active", true)).data?.map((p) => p.id) ?? [];
  await rpc(office, "send_contracts", { p_template: tpl.photo, p_players: team, p_due_on: addDays(today, 14) }, "acord foto U17");
  await rpc(office, "send_contracts", { p_template: tpl.enrolment, p_players: [link.player_id], p_due_on: addDays(today, 7) }, "fișa de înscriere");

  // Părintele semnează acordul foto.
  const { data: photo } = await admin.from("contracts").select("id, signer_name").eq("player_id", link.player_id).eq("signer_user_id", ids.parinte).eq("title", STANDARD_CONTRACTS.find((s) => s.key === "photo")!.name).maybeSingle();
  if (photo) {
    const parent = createDb({ sub: ids.parinte, role: "authenticated" });
    const p = `${clubId}/${photo.id}/semnatura-${crypto.randomUUID()}.png`;
    if (writeLocalFile("contracts", p, demoSignaturePng())) {
      await rpc(parent, "view_contract", { p_id: photo.id, p_ip: "192.0.2.10" }, "deschidere");
      await rpc(parent, "sign_contract", { p_id: photo.id, p_name: photo.signer_name, p_signature_path: p, p_ip: "192.0.2.10", p_user_agent: "Demo" }, "semnare");
    }
  }

  // Un model scris de birou: regulamentul intern pentru seniori, pe care jucătorul adult îl semnează singur.
  if (ids.jucator) {
    const { data: adult } = await admin.from("players").select("id, group_id").eq("user_id", ids.jucator).maybeSingle();
    if (adult?.group_id) {
      const rules = await rpc<string>(office, "save_contract_template", {
        p: {
          name: "Regulamentul intern al lotului de seniori", kind: "other",
          body: "Subsemnatul {{jucator}}, jucător al echipei {{echipa}}, am luat la cunoștință regulamentul intern al {{club}} pentru sezonul {{sezon}}:\n\n1. Prezența la antrenamente și la meciuri este obligatorie; absențele se anunță în aplicație cu cel puțin 24 de ore înainte.\n2. Chestionarul de stare se completează zilnic până la ora 10:00.\n3. Echipamentul primit rămâne proprietatea clubului și se returnează la sfârșitul sezonului.\n4. Abaterile disciplinare se discută cu antrenorul principal și cu directorul sportiv.\n\nData: {{data}}",
        },
      }, "model regulament");
      const senior = (await admin.from("players").select("id").eq("group_id", adult.group_id).eq("is_active", true).limit(12)).data?.map((p) => p.id) ?? [];
      await rpc(office, "send_contracts", { p_template: rules, p_players: [...new Set([adult.id, ...senior])], p_due_on: addDays(today, 10) }, "regulament seniori");
    }
  }
}
