// Captură de ecran a unei pagini, autentificat cu un cont demo.
//   node tools/shot.mjs <email> <cale> <fișier.png> [--mobile] [--full]
// Parola se citește din conturi-demo.local.md.
import { chromium } from "playwright";
import fs from "node:fs";

const [email, path, out, ...flags] = process.argv.slice(2);
const base = process.env.BASE_URL ?? "http://localhost:3000";
const line = fs.readFileSync(new URL("../conturi-demo.local.md", import.meta.url), "utf8").split("\n").find((l) => l.includes(`| ${email} |`));
const password = /`([^`]+)`/.exec(line ?? "")?.[1];
if (!password) throw new Error("Nu găsesc parola pentru " + email);

const mobile = flags.includes("--mobile");
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined) });
const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 860 }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(base + "/autentificare");
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', password);
await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/autentificare"), { timeout: 30000 }), page.click('button[type="submit"]')]);
if (path) await page.goto(base + path, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.screenshot({ path: out, fullPage: flags.includes("--full") });
console.log("URL:", page.url(), "| titlu:", await page.title());
if (errors.length) console.log("ERORI CONSOLĂ:\n" + errors.slice(0, 8).join("\n"));
await browser.close();
