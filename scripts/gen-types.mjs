// Generează packages/shared/src/database.types.ts din schema bazei de date (DATABASE_URL).
// Echivalent cu `supabase gen types typescript`, pentru medii fără Docker.
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
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const enums = (await db.query(`
  select t.typname as name, array_agg(e.enumlabel order by e.enumsortorder)::text[] as labels
  from pg_type t join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' group by 1 order by 1`)).rows;
const enumNames = new Set(enums.map((e) => e.name));

function tsType(udt, isArray) {
  let base;
  const u = udt.replace(/^_/, "");
  if (enumNames.has(u)) base = `Database["public"]["Enums"]["${u}"]`;
  else if (["int2", "int4", "int8", "float4", "float8", "numeric", "oid"].includes(u)) base = "number";
  else if (u === "bool") base = "boolean";
  else if (["json", "jsonb"].includes(u)) base = "Json";
  else if (u === "void") base = "undefined";
  else base = "string";
  return isArray || udt.startsWith("_") ? `${base}[]` : base;
}

const cols = (await db.query(`
  select c.table_name, c.column_name, c.udt_name, c.is_nullable, c.column_default, c.is_generated, c.is_identity
  from information_schema.columns c
  join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
  where c.table_schema = 'public' and t.table_type = 'BASE TABLE' and c.table_name <> '_migrations'
  order by c.table_name, c.ordinal_position`)).rows;

const fks = (await db.query(`
  select con.conname, cl.relname as tbl, fcl.relname as ftbl,
    (select array_agg(a.attname order by k.ord)::text[] from unnest(con.conkey) with ordinality k(attnum, ord)
       join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum) as cols,
    (select array_agg(a.attname order by k.ord)::text[] from unnest(con.confkey) with ordinality k(attnum, ord)
       join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.attnum) as fcols,
    exists (select 1 from pg_constraint u where u.conrelid = con.conrelid and u.contype in ('p','u') and u.conkey = con.conkey) as one
  from pg_constraint con
  join pg_class cl on cl.oid = con.conrelid join pg_namespace n on n.oid = cl.relnamespace
  join pg_class fcl on fcl.oid = con.confrelid join pg_namespace fn on fn.oid = fcl.relnamespace
  where con.contype = 'f' and n.nspname = 'public' and fn.nspname = 'public'
  order by cl.relname, con.conname`)).rows;

const fns = (await db.query(`
  select p.proname, p.proretset, rt.typname as rettype, rt.typtype as rettyptype,
    coalesce(p.proargnames, '{}')::text[] as argnames, coalesce(p.proargmodes::text[], '{}') as argmodes,
    (select array_agg(t.typname order by a.ord)::text[] from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[])) with ordinality a(oid, ord) join pg_type t on t.oid = a.oid) as argtypes,
    p.pronargdefaults, p.pronargs
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace join pg_type rt on rt.oid = p.prorettype
  where n.nspname = 'public' and p.prokind = 'f' order by p.proname`)).rows;

const tables = {};
for (const c of cols) (tables[c.table_name] ??= []).push(c);

let out = `// FIȘIER GENERAT — nu edita manual. Regenerare: npm run db:types
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
`;
for (const [name, cs] of Object.entries(tables)) {
  out += `      ${name}: {\n        Row: {\n`;
  for (const c of cs) out += `          ${c.column_name}: ${tsType(c.udt_name)}${c.is_nullable === "YES" ? " | null" : ""};\n`;
  out += `        };\n        Insert: {\n`;
  for (const c of cs) {
    if (c.is_generated === "ALWAYS" || c.is_identity === "YES") { out += `          ${c.column_name}?: never;\n`; continue; }
    const opt = c.is_nullable === "YES" || c.column_default !== null;
    out += `          ${c.column_name}${opt ? "?" : ""}: ${tsType(c.udt_name)}${c.is_nullable === "YES" ? " | null" : ""};\n`;
  }
  out += `        };\n        Update: {\n`;
  for (const c of cs) {
    if (c.is_generated === "ALWAYS" || c.is_identity === "YES") { out += `          ${c.column_name}?: never;\n`; continue; }
    out += `          ${c.column_name}?: ${tsType(c.udt_name)}${c.is_nullable === "YES" ? " | null" : ""};\n`;
  }
  out += `        };\n        Relationships: [\n`;
  for (const f of fks.filter((f) => f.tbl === name)) {
    out += `          { foreignKeyName: "${f.conname}"; columns: ${JSON.stringify(f.cols)}; isOneToOne: ${f.one}; referencedRelation: "${f.ftbl}"; referencedColumns: ${JSON.stringify(f.fcols)} },\n`;
  }
  out += `        ];\n      };\n`;
}
out += `    };\n    Views: { [_ in never]: never };\n    Functions: {\n`;
for (const f of fns) {
  const inArgs = [];
  const outCols = [];
  const n = f.argtypes?.length ?? 0;
  const firstDefault = f.pronargs - f.pronargdefaults;
  let inIdx = 0;
  for (let i = 0; i < n; i++) {
    const mode = f.argmodes[i] ?? "i";
    if (mode === "t" || mode === "o") outCols.push(`${f.argnames[i]}: ${tsType(f.argtypes[i])}`);
    else {
      inArgs.push(`${f.argnames[i]}${inIdx >= firstDefault ? "?" : ""}: ${tsType(f.argtypes[i])} | null`);
      inIdx++;
    }
  }
  let ret = outCols.length ? `{ ${outCols.join("; ")} }` : tsType(f.rettype);
  if (f.proretset) ret += "[]";
  out += `      ${f.proname}: { Args: ${inArgs.length ? `{ ${inArgs.join("; ")} }` : "Record<PropertyKey, never>"}; Returns: ${ret} };\n`;
}
out += `    };\n    Enums: {\n`;
for (const e of enums) out += `      ${e.name}: ${e.labels.map((l) => JSON.stringify(l)).join(" | ")};\n`;
out += `    };\n    CompositeTypes: { [_ in never]: never };\n  };\n};\n
type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
`;
fs.writeFileSync(path.join(root, "packages/shared/src/database.types.ts"), out);
await db.end();
console.log(`Tipuri generate: ${Object.keys(tables).length} tabele, ${fns.length} funcții.`);
