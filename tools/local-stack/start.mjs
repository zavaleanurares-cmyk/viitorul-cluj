// Postgres local pentru dezvoltare și teste (fără Docker): pornește un server Postgres în
// tools/local-stack/.data și scrie DATABASE_URL în tools/local-stack/.data/env.
//
//   node tools/local-stack/start.mjs [--reset]
//
// Alternativ, orice Postgres 15+ merge: pune DATABASE_URL în apps/web/.env.local și rulează `npm run db:migrate`.
import EmbeddedPostgres from "embedded-postgres";
import pgClient from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, ".data");
const PORT = 54322;
const PASSWORD = "postgres";

if (process.argv.includes("--reset")) fs.rmSync(path.join(dataDir, "pg"), { recursive: true, force: true });
fs.mkdirSync(dataDir, { recursive: true });
const pgDir = path.join(dataDir, "pg");
const fresh = !fs.existsSync(path.join(pgDir, "PG_VERSION"));

const pg = new EmbeddedPostgres({
  databaseDir: pgDir,
  user: "postgres",
  password: PASSWORD,
  port: PORT,
  persistent: true,
  createPostgresUser: process.getuid?.() === 0,
  onLog: () => {},
  onError: () => {},
});
if (fresh) await pg.initialise();
await pg.start();

// Ca la furnizorul de producție (Neon), aplicația NU se conectează ca superuser, ci cu un rol
// proprietar al bazei de date, cu drept de a crea roluri și de a ocoli RLS ca proprietar.
const admin = new pgClient.Client({ host: "127.0.0.1", port: PORT, user: "postgres", password: PASSWORD, database: "postgres" });
await admin.connect();
if (!(await admin.query("select 1 from pg_roles where rolname = 'app_owner'")).rowCount) {
  await admin.query(`create role app_owner login createrole bypassrls password '${PASSWORD}'`);
}
if (!(await admin.query("select 1 from pg_database where datname = 'club'")).rowCount) {
  await admin.query("create database club owner app_owner");
}
await admin.end();

const url = `postgres://app_owner:${PASSWORD}@127.0.0.1:${PORT}/club`;
fs.writeFileSync(path.join(dataDir, "env"), `DATABASE_URL=${url}\n`);
console.log(`Postgres local pornit.\nDATABASE_URL=${url}\n(scris și în tools/local-stack/.data/env)`);

const stop = async () => {
  await pg.stop().catch(() => {});
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
