// Parcurge toate ecranele fiecărui rol și raportează erorile (răspunsuri 5xx, erori de consolă, pagini de eroare).
//   node tools/e2e/smoke.mjs <id jucător demo> <id grupă demo>
import { chromium } from "playwright";
import fs from "node:fs";
const [playerId, groupId] = process.argv.slice(2);
const base = process.env.BASE_URL ?? "http://localhost:3000";
const pw = (email) => /`([^`]+)`/.exec(fs.readFileSync("conturi-demo.local.md", "utf8").split("\n").find((l) => l.includes(`| ${email} |`)) ?? "")?.[1];
const staff = ["/tablou", "/disponibilitate", "/jucatori", `/jucatori/${playerId}`, `/jucatori/${playerId}/medical`, `/jucatori/${playerId}/wellness`, `/jucatori/${playerId}/fizic`, `/jucatori/${playerId}/plan`, `/jucatori/${playerId}/documente`, "/wellness", "/wellness?zi=azi", "/planuri", "/programe", "/programe/nou", "/biblioteca", "/biblioteca/nou", "/fizic", "/fizic/teste", "/fizic/sesiuni/nou", "/import", "/import?tip=sanatate", "/import?tip=fizic", "/rapoarte", "/administrare", "/administrare/conturi", "/administrare/grupe", "/administrare/stari", "/administrare/club", "/administrare/audit", "/administrare/gdpr", "/notificari", "/profil", "/azi", "/chestionar", "/plan", "/cazuri", `/rapoarte/jucator/${playerId}`, `/rapoarte/grupa/${groupId}?format=xlsx`, "/rapoarte/jucatori?grupa=toate"];
const roles = ["preparator", "antrenor", "director", "patron", "jucator", "jucator.accidentat", "partener"].map((k) => `${k}.demo@example.com`);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
let problems = 0;
for (const email of roles) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, acceptDownloads: true });
  const page = await ctx.newPage();
  let errors = [];
  page.on("console", (m) => m.type() === "error" && !/favicon|Failed to load resource/.test(m.text()) && errors.push(m.text().slice(0, 160)));
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  await page.goto(base + "/autentificare");
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', pw(email));
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/autentificare"), { timeout: 30000 });
  if (page.url().includes("/consimtamant")) {
    const n = page.locator('input[autocomplete="name"]');
    if (await n.count()) await n.fill("Părinte Demo");
    await page.locator("main button").first().click();
    await page.waitForURL((u) => !u.pathname.startsWith("/consimtamant"), { timeout: 30000 });
  }
  const seen = {};
  for (const r of staff) {
    errors = [];
    let status = 0, final = "", note = "";
    try {
      const res = await ctx.request.get(base + r, { maxRedirects: 0 }).catch(() => null);
      status = res?.status() ?? 0;
      const ct = res?.headers()["content-type"] ?? "";
      if (ct.includes("text/html")) {
        await page.goto(base + r, { waitUntil: "networkidle", timeout: 45000 });
        final = new URL(page.url()).pathname;
        const text = await page.locator("body").innerText();
        if (/nu a putut fi încărcată|Application error|Unhandled Runtime/i.test(text)) note = "PAGINĂ DE EROARE";
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (overflow > 2) note += ` derulare orizontală +${overflow}px`;
      } else final = `(${ct.split(";")[0] || "fără conținut"})`;
    } catch (e) { note = "EXCEPȚIE " + String(e).slice(0, 100); }
    const bad = status >= 500 || note || errors.length;
    if (bad) { problems++; console.log(`✗ ${email.split("@")[0]} ${r} → ${status} ${final} ${note} ${errors.join(" | ")}`); }
    seen[r] = `${status}${final && final !== r.split("?")[0] ? "→" + final : ""}`;
  }
  console.log(email.split("@")[0].padEnd(20), Object.entries(seen).map(([k, v]) => `${k.replace(playerId, "<j>").replace(groupId, "<g>")}:${v}`).join("  "));
  await ctx.close();
}
await browser.close();
console.log(problems ? `${problems} probleme` : "Nicio problemă.");
