/**
 * Creează clubul Viitorul Cluj (dacă nu există) și conturile demo de staff.
 * Parolele sunt generate aleator și scrise în conturi-demo.local.md (fișier ignorat de git).
 *
 *   npx tsx scripts/seed-club.ts
 */
import fs from "node:fs";
import path from "node:path";
import { ensureAccount, must, randomPassword, root, serviceClient } from "./lib";

const admin = serviceClient();
const SLUG = process.env.CLUB_SLUG ?? "viitorul-cluj";
const DOMAIN = process.env.DEMO_EMAIL_DOMAIN ?? "example.com";

let { data: club } = await admin.from("clubs").select("*").eq("slug", SLUG).maybeSingle();
if (!club) {
  const id = must(
    await admin.rpc("setup_club", {
      p_slug: SLUG, p_name: "Viitorul Cluj", p_short_name: "Viitorul",
      p_groups: ["Liga 3", "U21", "U17", "U16", "U15"], p_settings: {},
    }),
    "setup_club",
  );
  club = must(await admin.from("clubs").select("*").eq("id", id).single(), "club");
  console.log("Club creat:", club.name);
} else {
  console.log("Clubul există deja:", club.name);
}
const groups = must(await admin.from("groups").select("*").eq("club_id", club.id).order("sort"), "grupe");
const g = (name: string) => groups.find((x) => x.name === name)!.id;

const accounts = [
  { key: "patron", full_name: "Patron Demo", role: "owner" as const },
  { key: "director", full_name: "Director Sportiv Demo", role: "sporting_director" as const },
  { key: "preparator", full_name: "Preparator Fizic Demo", role: "physio" as const },
  { key: "antrenor.l3", full_name: "Antrenor Liga 3 Demo", role: "coach" as const, group_ids: [g("Liga 3")] },
  { key: "antrenor.juniori", full_name: "Antrenor U17 + U16 Demo", role: "coach" as const, group_ids: [g("U17"), g("U16")] },
  { key: "partener", full_name: "Partener Medical Demo", role: "medical_partner" as const },
];

const lines = [`## ${club.name}`, "", "| Rol | E-mail | Parolă |", "|---|---|---|"];
for (const a of accounts) {
  const email = `${a.key}.viitorul@${DOMAIN}`;
  const password = process.env.DEMO_PASSWORD ?? randomPassword();
  await ensureAccount(admin, { email, password, full_name: a.full_name, role: a.role, club_id: club.id, group_ids: a.group_ids });
  lines.push(`| ${a.full_name} | ${email} | \`${password}\` |`);
}
const out = path.join(root, "conturi-demo.local.md");
const header = "# Conturi demo\n\nGenerat de scripturile de seed. NU se pune în git. Schimbă parolele înainte de a da acces altcuiva.\n\n";
const existing = fs.existsSync(out) ? fs.readFileSync(out, "utf8") : header;
const section = lines.join("\n") + "\n";
const re = new RegExp(`## ${club.name}[\\s\\S]*?(?=\\n## |$)`);
fs.writeFileSync(out, re.test(existing) ? existing.replace(re, section) : existing + section + "\n");
console.log(`Conturi create. Parolele sunt în ${path.relative(root, out)}.`);
