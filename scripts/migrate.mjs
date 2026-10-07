// Aplică migrările din db/migrations. Rulează automat la fiecare build de producție pe Vercel
// (vezi scriptul „build" din apps/web/package.json) și manual local: `npm run db:migrate`.
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
// Pe Vercel, integrarea Neon injectează DATABASE_URL_UNPOOLED (conexiune directă, potrivită pentru DDL).
const url = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
if (!url) {
  if (process.argv.includes("--if-configured")) {
    console.log("Migrări: nicio bază de date configurată (DATABASE_URL) — pas sărit.");
    process.exit(0);
  }
  throw new Error("Lipsește DATABASE_URL.");
}
// La build-urile de previzualizare nu atingem baza de date de producție.
if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
  console.log(`Migrări: mediu „${process.env.VERCEL_ENV}" — pas sărit.`);
  process.exit(0);
}
const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query(`create table if not exists public._migrations (name text primary key, applied_at timestamptz default now())`);
await client.query(`alter table public._migrations enable row level security`);
await client.query(`revoke all on public._migrations from anon, authenticated`).catch(() => {});
const dir = path.join(root, "db/migrations");
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
await client.end();
console.log("Migrări aplicate.");
