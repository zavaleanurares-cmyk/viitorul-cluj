// Aplică migrările din supabase/migrations pe baza de date din DATABASE_URL.
// (Pe un proiect Supabase real se folosește `supabase db push`; acest script este pentru stiva locală.)
import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(root, "tools/local-stack/.data/env");
if (!process.env.DATABASE_URL && fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const i = line.indexOf("=");
    if (i > 0) process.env[line.slice(0, i)] ??= line.slice(i + 1);
  }
}
// Pe Vercel, integrarea Supabase injectează POSTGRES_URL_NON_POOLING (conexiune directă, potrivită pentru DDL).
const url = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
if (!url) {
  if (process.argv.includes("--if-configured")) {
    console.log("Migrări: nicio bază de date configurată (POSTGRES_URL_NON_POOLING / DATABASE_URL) — pas sărit.");
    process.exit(0);
  }
  throw new Error("Lipsește POSTGRES_URL_NON_POOLING sau DATABASE_URL.");
}
// La build-urile de previzualizare nu atingem baza de date de producție.
if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
  console.log(`Migrări: mediu „${process.env.VERCEL_ENV}" — pas sărit.`);
  process.exit(0);
}
const local = /@(127\.0\.0\.1|localhost)[:/]/.test(url);
const client = new pg.Client({
  connectionString: url.replace(/[?&]sslmode=[^&]*/g, ""),
  // certificatul Supabase este semnat de o autoritate proprie; conexiunea rămâne criptată
  ssl: local ? undefined : { rejectUnauthorized: false },
});
await client.connect();
await client.query(`create table if not exists public._migrations (name text primary key, applied_at timestamptz default now())`);
await client.query(`alter table public._migrations enable row level security`);
await client.query(`revoke all on public._migrations from anon, authenticated`).catch(() => {});
const dir = path.join(root, "supabase/migrations");
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  const done = await client.query("select 1 from public._migrations where name = $1", [f]);
  if (done.rowCount) continue;
  process.stdout.write(`→ ${f} … `);
  try {
    await client.query("begin");
    await client.query(fs.readFileSync(path.join(dir, f), "utf8"));
    await client.query("insert into public._migrations (name) values ($1)", [f]);
    await client.query("commit");
    console.log("ok");
  } catch (e) {
    await client.query("rollback");
    console.log("EROARE");
    console.error(e.message, e.where ? "\n" + e.where : "", e.position ? `(poziția ${e.position})` : "");
    process.exit(1);
  }
}
await client.query("notify pgrst, 'reload schema'");
await client.end();
console.log("Migrări aplicate.");
