/**
 * Club demonstrativ, cu date inventate (vezi packages/seed/src/demo.ts).
 *   npx tsx scripts/seed-demo.ts            # creează sau completează
 *   npx tsx scripts/seed-demo.ts --reset    # șterge clubul demo și îl reface
 */
import fs from "node:fs";
import path from "node:path";
import { closePool, root, serviceClient } from "./lib";
import { seedDemo, type SeededAccount } from "../packages/seed/src";

function writeAccounts(clubName: string, accounts: SeededAccount[]) {
  const out = path.join(root, "conturi-demo.local.md");
  const header = "# Conturi demo\n\nGenerat de scripturile de seed. NU se pune în git. Schimbă parolele înainte de a da acces altcuiva.\n\n";
  const existing = fs.existsSync(out) ? fs.readFileSync(out, "utf8") : header;
  const section = [`## ${clubName}`, "", "| Rol | E-mail | Parolă |", "|---|---|---|", ...accounts.map((a) => `| ${a.label} | ${a.email} | \`${a.password}\` |`)].join("\n") + "\n";
  const re = new RegExp(`## ${clubName}[\\s\\S]*?(?=\\n## |$)`);
  fs.writeFileSync(out, re.test(existing) ? existing.replace(re, section) : existing + "\n" + section);
}

const res = await seedDemo(serviceClient(), { reset: process.argv.includes("--reset"), domain: process.env.DEMO_EMAIL_DOMAIN, password: process.env.DEMO_PASSWORD });
writeAccounts(res.clubName, res.accounts);
console.log(`${res.clubName}: ${res.players} jucători, ${res.accounts.length} conturi. Parolele sunt în conturi-demo.local.md.`);
await closePool();
