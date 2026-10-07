// Stivă locală minimă, compatibilă cu API-ul Supabase, pentru dezvoltare și teste
// acolo unde Docker / `supabase start` nu sunt disponibile.
//
//   Postgres (embedded-postgres)  : 54322
//   GoTrue  (supabase/auth)       : 9999   -> expus la  http://localhost:54321/auth/v1
//   PostgREST                     : 3001   -> expus la  http://localhost:54321/rest/v1
//   Storage (emulare minimă)      :           expus la  http://localhost:54321/storage/v1
//
// Folosire:  node tools/local-stack/start.mjs [--reset]
// Varianta oficială rămâne `supabase start` (vezi README.md).

import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const dataDir = path.join(here, ".data");
const binDir = path.join(here, "bin");
const reset = process.argv.includes("--reset");

const PG_PORT = 54322;
const API_PORT = 54321;
const GOTRUE_PORT = 9999;
const PGRST_PORT = 3001;
const JWT_SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";
const PG_PASSWORD = "postgres";

const PGRST_URL =
  "https://github.com/PostgREST/postgrest/releases/download/v13.0.7/postgrest-v13.0.7-linux-static-x86-64.tar.xz";
const GOTRUE_URL =
  "https://github.com/supabase/auth/releases/download/v2.180.0/auth-v2.180.0-x86.tar.gz";

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}
function signJwt(payload) {
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}
function verifyJwt(token) {
  try {
    const [h, b, s] = token.split(".");
    const sig = crypto.createHmac("sha256", JWT_SECRET).update(`${h}.${b}`).digest("base64url");
    if (sig !== s) return null;
    return JSON.parse(Buffer.from(b, "base64url").toString());
  } catch {
    return null;
  }
}
const exp = Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 3600;
const ANON_KEY = signJwt({ role: "anon", iss: "supabase-local", iat: 1700000000, exp });
const SERVICE_KEY = signJwt({ role: "service_role", iss: "supabase-local", iat: 1700000000, exp });

function ensureBinaries() {
  fs.mkdirSync(binDir, { recursive: true });
  if (!fs.existsSync(path.join(binDir, "postgrest"))) {
    console.log("↓ PostgREST…");
    execSync(`curl -sSL -o pgrst.tar.xz ${PGRST_URL} && tar xf pgrst.tar.xz && rm pgrst.tar.xz`, {
      cwd: binDir,
      stdio: "inherit",
    });
  }
  if (!fs.existsSync(path.join(binDir, "auth"))) {
    console.log("↓ GoTrue…");
    execSync(`curl -sSL -o auth.tar.gz ${GOTRUE_URL} && tar xzf auth.tar.gz && rm auth.tar.gz`, {
      cwd: binDir,
      stdio: "inherit",
    });
  }
}

const children = [];
function run(name, cmd, args, env) {
  const log = fs.createWriteStream(path.join(dataDir, `${name}.log`), { flags: "a" });
  const child = spawn(cmd, args, { env: { ...process.env, ...env }, cwd: binDir });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  child.on("exit", (code) => console.log(`[${name}] s-a oprit (cod ${code})`));
  children.push(child);
  return child;
}

async function waitFor(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timeout: ${url}`);
}

async function main() {
  ensureBinaries();
  if (reset) fs.rmSync(dataDir, { recursive: true, force: true });
  fs.mkdirSync(dataDir, { recursive: true });
  const pgDir = path.join(dataDir, "pg");
  const fresh = !fs.existsSync(path.join(pgDir, "PG_VERSION"));

  const epg = new EmbeddedPostgres({
    databaseDir: pgDir,
    user: "postgres",
    password: PG_PASSWORD,
    port: PG_PORT,
    persistent: true,
    createPostgresUser: process.getuid?.() === 0,
    onLog: () => {},
    onError: () => {},
  });
  if (fresh) await epg.initialise();
  await epg.start();

  const admin = new pg.Client({
    host: "127.0.0.1",
    port: PG_PORT,
    user: "postgres",
    password: PG_PASSWORD,
    database: "postgres",
  });
  await admin.connect();

  if (fresh) {
    // Roluri și scheme pe care o instanță Supabase le are din start.
    await admin.query(`
      create role anon nologin noinherit;
      create role authenticated nologin noinherit;
      create role service_role nologin noinherit bypassrls;
      create role authenticator login noinherit password '${PG_PASSWORD}';
      grant anon, authenticated, service_role to authenticator;
      create role supabase_auth_admin login noinherit createrole password '${PG_PASSWORD}';
      create role supabase_storage_admin login noinherit password '${PG_PASSWORD}';
      create schema if not exists auth authorization supabase_auth_admin;
      create schema if not exists extensions;
      create extension if not exists pgcrypto with schema extensions;
      grant usage on schema public, extensions to anon, authenticated, service_role;
      grant usage on schema auth to anon, authenticated, service_role, postgres;
      alter role supabase_auth_admin set search_path = auth;
      alter role authenticator set search_path = public, extensions;
      alter database postgres set search_path = public, extensions;
      grant all on database postgres to supabase_auth_admin;

      -- Emulare minimă a schemei storage (doar ce folosesc politicile RLS).
      create schema if not exists storage;
      grant usage on schema storage to anon, authenticated, service_role;
      create table storage.buckets (
        id text primary key, name text not null, public boolean default false,
        file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now()
      );
      create table storage.objects (
        id uuid primary key default gen_random_uuid(),
        bucket_id text references storage.buckets(id),
        name text not null,
        owner uuid, owner_id text,
        metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now(),
        unique (bucket_id, name)
      );
      alter table storage.objects enable row level security;
      alter table storage.buckets enable row level security;
      grant all on storage.objects, storage.buckets to authenticated, service_role;
      create or replace function storage.foldername(name text) returns text[]
        language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
      create or replace function storage.filename(name text) returns text
        language sql immutable as $$ select (string_to_array(name, '/'))[array_length(string_to_array(name,'/'),1)] $$;
    `);
  }

  // GoTrue rulează propriile migrări (creează auth.users, auth.uid() etc.).
  const gotrueEnv = {
    GOTRUE_DB_DRIVER: "postgres",
    DATABASE_URL: `postgres://supabase_auth_admin:${PG_PASSWORD}@127.0.0.1:${PG_PORT}/postgres`,
    GOTRUE_DB_NAMESPACE: "auth",
    GOTRUE_DB_MIGRATIONS_PATH: path.join(binDir, "migrations"),
    GOTRUE_SITE_URL: "http://localhost:3000",
    GOTRUE_URI_ALLOW_LIST: "http://localhost:3000/**",
    API_EXTERNAL_URL: `http://localhost:${API_PORT}/auth/v1`,
    GOTRUE_API_HOST: "127.0.0.1",
    PORT: String(GOTRUE_PORT),
    GOTRUE_JWT_SECRET: JWT_SECRET,
    GOTRUE_JWT_EXP: "3600",
    GOTRUE_JWT_AUD: "authenticated",
    GOTRUE_JWT_DEFAULT_GROUP_NAME: "authenticated",
    GOTRUE_JWT_ADMIN_ROLES: "service_role",
    GOTRUE_DISABLE_SIGNUP: "true",
    GOTRUE_EXTERNAL_EMAIL_ENABLED: "true",
    GOTRUE_MAILER_AUTOCONFIRM: "true",
    GOTRUE_RATE_LIMIT_EMAIL_SENT: "1000",
    GOTRUE_RATE_LIMIT_TOKEN_REFRESH: "10000",
    GOTRUE_RATE_LIMIT_VERIFY: "10000",
    GOTRUE_PASSWORD_MIN_LENGTH: "8",
    GOTRUE_LOG_LEVEL: "warn",
  };
  run("gotrue", path.join(binDir, "auth"), [], gotrueEnv);
  await waitFor(`http://127.0.0.1:${GOTRUE_PORT}/health`);

  // După migrările GoTrue: drepturi pe funcțiile auth.* pentru rolurile API.
  await admin.query(`
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on all functions in schema auth to anon, authenticated, service_role;
    grant select on auth.users to service_role, postgres;
    grant references on auth.users to postgres;
  `).catch((e) => console.log("grant auth:", e.message));
  // Pe Supabase, `postgres` poate referi auth.users; aici îi dăm drepturi complete.
  await admin.query(`grant all on all tables in schema auth to postgres;`).catch(() => {});

  run("postgrest", path.join(binDir, "postgrest"), [], {
    PGRST_DB_URI: `postgres://authenticator:${PG_PASSWORD}@127.0.0.1:${PG_PORT}/postgres`,
    PGRST_DB_SCHEMAS: "public",
    PGRST_DB_ANON_ROLE: "anon",
    PGRST_JWT_SECRET: JWT_SECRET,
    PGRST_SERVER_PORT: String(PGRST_PORT),
    PGRST_SERVER_HOST: "127.0.0.1",
    PGRST_DB_EXTRA_SEARCH_PATH: "public, extensions",
    PGRST_DB_CHANNEL_ENABLED: "true",
  });
  await waitFor(`http://127.0.0.1:${PGRST_PORT}/`);

  // ---- Gateway (rolul Kong) + emulare storage -------------------------------
  const storageDir = path.join(dataDir, "storage");
  fs.mkdirSync(storageDir, { recursive: true });
  const storagePool = new pg.Pool({
    host: "127.0.0.1", port: PG_PORT, user: "postgres", password: PG_PASSWORD, database: "postgres", max: 4,
  });

  async function withRls(claims, fn) {
    const c = await storagePool.connect();
    try {
      await c.query("begin");
      await c.query(`select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)`, [
        JSON.stringify(claims), claims.sub ?? "",
      ]);
      await c.query(`set local role ${claims.role === "service_role" ? "service_role" : claims.role === "authenticated" ? "authenticated" : "anon"}`);
      const out = await fn(c);
      await c.query("commit");
      return out;
    } catch (e) {
      await c.query("rollback").catch(() => {});
      throw e;
    } finally {
      c.release();
    }
  }

  function readBody(req) {
    return new Promise((resolve) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => resolve(Buffer.concat(chunks)));
    });
  }
  function json(res, status, obj) {
    res.writeHead(status, { "content-type": "application/json", ...cors });
    res.end(JSON.stringify(obj));
  }
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD",
    "access-control-expose-headers": "*",
  };
  const diskPath = (bucket, name) =>
    path.join(storageDir, bucket, crypto.createHash("sha1").update(name).digest("hex"));

  async function handleStorage(req, res, url) {
    const claims = verifyJwt((req.headers.authorization || "").replace(/^Bearer /i, "")) || { role: "anon" };
    const p = url.pathname.replace(/^\/storage\/v1/, "");
    let m;
    // Descărcare prin link semnat
    if ((m = p.match(/^\/object\/sign\/([^/]+)\/(.+)$/)) && req.method === "GET") {
      const tok = verifyJwt(url.searchParams.get("token") || "");
      const name = decodeURIComponent(m[2]);
      if (!tok || tok.url !== `${m[1]}/${name}` || tok.exp < Date.now() / 1000) return json(res, 400, { error: "InvalidJWT" });
      const f = diskPath(m[1], name);
      if (!fs.existsSync(f)) return json(res, 404, { error: "not_found" });
      const meta = JSON.parse(fs.readFileSync(f + ".json", "utf8"));
      res.writeHead(200, { "content-type": meta.contentType || "application/octet-stream", ...cors });
      return fs.createReadStream(f).pipe(res);
    }
    // Creare link semnat (necesită drept de SELECT prin RLS)
    if ((m = p.match(/^\/object\/sign\/([^/]+)\/(.+)$/)) && req.method === "POST") {
      const body = JSON.parse((await readBody(req)).toString() || "{}");
      const name = decodeURIComponent(m[2]);
      const rows = await withRls(claims, (c) =>
        c.query("select 1 from storage.objects where bucket_id=$1 and name=$2", [m[1], name]));
      if (!rows.rowCount) return json(res, 400, { statusCode: "404", error: "not_found", message: "Object not found" });
      const token = signJwt({ url: `${m[1]}/${name}`, exp: Math.floor(Date.now() / 1000) + (body.expiresIn || 60) });
      return json(res, 200, { signedURL: `/object/sign/${m[1]}/${encodeURI(name)}?token=${token}` });
    }
    if ((m = p.match(/^\/object\/([^/]+)\/(.+)$/))) {
      const bucket = m[1];
      const name = decodeURIComponent(m[2]);
      if (req.method === "POST" || req.method === "PUT") {
        const raw = await readBody(req);
        let data = raw;
        let contentType = req.headers["content-type"] || "application/octet-stream";
        if (contentType.startsWith("multipart/form-data")) {
          // supabase-js trimite FormData în browser/Node; extragem primul fișier.
          const boundary = "--" + contentType.split("boundary=")[1];
          const start = raw.indexOf("\r\n\r\n") + 4;
          const end = raw.lastIndexOf("\r\n" + boundary);
          const head = raw.subarray(0, start).toString();
          const ct = head.match(/content-type:\s*([^\r\n]+)/i);
          contentType = ct ? ct[1] : "application/octet-stream";
          data = raw.subarray(start, end);
        }
        try {
          await withRls(claims, (c) =>
            c.query(
              `insert into storage.objects (bucket_id, name, owner, owner_id, metadata) values ($1,$2,$3,$4,$5)
               ${req.headers["x-upsert"] === "true" ? "on conflict (bucket_id, name) do update set updated_at = now(), metadata = excluded.metadata" : ""}`,
              [bucket, name, claims.sub ?? null, claims.sub ?? null, { size: data.length, mimetype: contentType }]));
        } catch (e) {
          return json(res, 400, { statusCode: "403", error: "Unauthorized", message: e.message });
        }
        fs.mkdirSync(path.join(storageDir, bucket), { recursive: true });
        fs.writeFileSync(diskPath(bucket, name), data);
        fs.writeFileSync(diskPath(bucket, name) + ".json", JSON.stringify({ contentType }));
        return json(res, 200, { Key: `${bucket}/${name}`, Id: crypto.randomUUID() });
      }
      if (req.method === "GET") {
        const rows = await withRls(claims, (c) =>
          c.query("select 1 from storage.objects where bucket_id=$1 and name=$2", [bucket.replace(/^authenticated\//, ""), name]));
        const f = diskPath(bucket, name);
        if (!rows.rowCount || !fs.existsSync(f)) return json(res, 400, { statusCode: "404", error: "not_found", message: "Object not found" });
        const meta = JSON.parse(fs.readFileSync(f + ".json", "utf8"));
        res.writeHead(200, { "content-type": meta.contentType, ...cors });
        return fs.createReadStream(f).pipe(res);
      }
    }
    if ((m = p.match(/^\/object\/([^/]+)$/)) && req.method === "DELETE") {
      const body = JSON.parse((await readBody(req)).toString() || "{}");
      const out = await withRls(claims, (c) =>
        c.query("delete from storage.objects where bucket_id=$1 and name = any($2) returning name", [m[1], body.prefixes || []]));
      for (const r of out.rows) fs.rmSync(diskPath(m[1], r.name), { force: true });
      return json(res, 200, out.rows);
    }
    return json(res, 404, { error: "storage: rută neimplementată în emulare", path: p });
  }

  function proxy(req, res, port, pathname, search) {
    const headers = { ...req.headers, host: `127.0.0.1:${port}` };
    // Ca la Kong: dacă lipsește Authorization, folosim apikey.
    if (!headers.authorization && headers.apikey) headers.authorization = `Bearer ${headers.apikey}`;
    const up = http.request({ host: "127.0.0.1", port, path: pathname + search, method: req.method, headers }, (ur) => {
      res.writeHead(ur.statusCode, { ...ur.headers, ...cors });
      ur.pipe(res);
    });
    up.on("error", (e) => json(res, 502, { error: e.message }));
    req.pipe(up);
  }

  http
    .createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${API_PORT}`);
      if (req.method === "OPTIONS") {
        res.writeHead(204, cors);
        return res.end();
      }
      try {
        if (url.pathname.startsWith("/auth/v1")) return proxy(req, res, GOTRUE_PORT, url.pathname.replace("/auth/v1", "") || "/", url.search);
        if (url.pathname.startsWith("/rest/v1")) return proxy(req, res, PGRST_PORT, url.pathname.replace("/rest/v1", "") || "/", url.search);
        if (url.pathname.startsWith("/storage/v1")) return await handleStorage(req, res, url);
        json(res, 404, { error: "not found" });
      } catch (e) {
        json(res, 500, { error: String(e.message || e) });
      }
    })
    .listen(API_PORT, "127.0.0.1");

  const env = [
    `NEXT_PUBLIC_SUPABASE_URL=http://localhost:${API_PORT}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}`,
    `SUPABASE_SERVICE_ROLE_KEY=${SERVICE_KEY}`,
    `DATABASE_URL=postgres://postgres:${PG_PASSWORD}@127.0.0.1:${PG_PORT}/postgres`,
  ].join("\n");
  fs.writeFileSync(path.join(dataDir, "env"), env + "\n");
  console.log("\nStiva locală rulează:\n" + env + "\n");
  console.log("(valorile sunt scrise și în tools/local-stack/.data/env)");
  await admin.end();

  const stop = async () => {
    for (const c of children) c.kill();
    await epg.stop().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((e) => {
  console.error(e);
  for (const c of children) c.kill();
  process.exit(1);
});
