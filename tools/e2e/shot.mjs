// Capturi de ecran pentru verificare vizuală.
//   node tools/e2e/shot.mjs <email> <cale> [mobile|desktop] [fișier.png]
// Parola se citește din conturi-demo.local.md.
import { chromium } from "playwright";
import fs from "node:fs";

const [email, route = "/", mode = "mobile", out = "shot.png"] = process.argv.slice(2);
const line = fs.readFileSync("conturi-demo.local.md", "utf8").split("\n").find((l) => l.includes(`| ${email} |`));
const password = /`([^`]+)`/.exec(line ?? "")?.[1];
if (!password) throw new Error("Nu găsesc parola pentru " + email);

const browser = await chromium.launch({ executablePath: fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined });
const ctx = await browser.newContext(mode === "mobile"
  ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  : { viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
const base = process.env.BASE_URL ?? "http://localhost:3000";
await page.goto(base + "/autentificare");
await page.fill('input[type="email"]', email);
await page.fill('input[type="password"]', password);
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/autentificare"), { timeout: 20000 });
if (page.url().includes("/consimtamant") && route !== "/consimtamant") {
  // prima autentificare a contului demo: acceptă consimțământul
  const name = page.locator('input[autocomplete="name"]');
  if (await name.count()) await name.fill("Părinte Demo");
  await page.locator("main button").first().click();
  await page.waitForURL((u) => !u.pathname.startsWith("/consimtamant"), { timeout: 20000 });
}
await page.goto(base + route, { waitUntil: "networkidle" }).catch(() => {});
await page.screenshot({ path: out, fullPage: process.env.FULL !== "0" });
console.log("URL:", page.url());
if (errors.length) console.log("ERORI CONSOLĂ:\n" + errors.slice(0, 10).join("\n"));
await browser.close();
