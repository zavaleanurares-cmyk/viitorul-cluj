/**
 * Strat REST compatibil cu PostgREST, executat în proces.
 *
 * Primește o cerere în formatul PostgREST (cel generat de `@supabase/postgrest-js`:
 * `GET /players?select=id,groups(name)&is_active=eq.true&order=display_name`) și o traduce într-o
 * singură interogare SQL parametrizată. Cererea rulează într-o tranzacție în care rolul și
 * identitatea utilizatorului sunt setate ca la PostgREST (`role` + `request.jwt.claims`), deci
 * Row Level Security din Postgres decide ce se vede și ce se poate modifica.
 *
 * Acoperă subsetul folosit de aplicație: selecții cu relații imbricate (`rel(...)`, `rel!inner(...)`,
 * `alias:rel!fk(...)`), filtre (eq, neq, gt, gte, lt, lte, like, ilike, is, in, cs, cd, ov, not.*,
 * or/and), ordonare, limit/offset, count=exact, obiect unic, insert / upsert / update / delete cu
 * `return=representation`, și apeluri de funcții (`/rpc/<nume>`). Orice altceva întoarce o eroare
 * explicită, nu un rezultat aproximativ.
 */
import type { ForeignKey, FunctionMeta, SchemaMeta, TableMeta } from "./meta";

export type RestRequest = {
  method: string;
  /** calea după rădăcină: `/players` sau `/rpc/club_overview` */
  path: string;
  query: URLSearchParams;
  headers: Headers;
  body: unknown;
};
export type RestResponse = { status: number; headers: Record<string, string>; body: string | null };
export type Exec = (sql: string, params: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;

export class RestError extends Error {
  constructor(public status: number, public code: string, message: string, public details: string | null = null, public hint: string | null = null) {
    super(message);
  }
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const q = (name: string) => {
  if (!IDENT.test(name)) throw new RestError(400, "PGRST100", `Nume invalid: ${name}`);
  return `"${name}"`;
};

// ---------------------------------------------------------------------------
// Analiza parametrului `select`
// ---------------------------------------------------------------------------
type ColumnField = { kind: "column"; name: string; alias: string | null; cast: string | null; path: JsonStep[] };
type EmbedField = { kind: "embed"; relation: string; alias: string | null; hint: string | null; inner: boolean; fields: Field[] };
type Field = { kind: "star" } | { kind: "count" } | ColumnField | EmbedField;
type JsonStep = { op: "->" | "->>"; key: string };

/** Împarte la separatorul dat, ignorând ce este între paranteze sau ghilimele. */
function splitTop(input: string, sep = ","): string[] {
  const out: string[] = [];
  let depth = 0;
  let quoted = false;
  let cur = "";
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') quoted = !quoted;
    if (!quoted) {
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      else if (ch === sep && depth === 0) {
        out.push(cur);
        cur = "";
        continue;
      }
    }
    cur += ch;
  }
  if (cur.trim() !== "" || out.length) out.push(cur);
  return out;
}

function parseColumnRef(raw: string): { name: string; path: JsonStep[] } {
  const parts = raw.split(/(->>|->)/);
  const name = parts[0].trim();
  const path: JsonStep[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const key = (parts[i + 1] ?? "").trim().replace(/^"(.*)"$/, "$1");
    if (!/^[A-Za-z0-9_ .-]+$/.test(key)) throw new RestError(400, "PGRST100", `Cale JSON invalidă: ${raw}`);
    path.push({ op: parts[i] as JsonStep["op"], key });
  }
  return { name, path };
}

export function parseSelect(input: string): Field[] {
  const fields: Field[] = [];
  for (const rawItem of splitTop(input)) {
    const item = rawItem.replace(/\s+/g, "");
    if (!item) continue;
    const open = item.indexOf("(");
    if (open >= 0) {
      if (!item.endsWith(")")) throw new RestError(400, "PGRST100", `Selecție invalidă: ${item}`);
      let head = item.slice(0, open);
      let alias: string | null = null;
      const colon = head.indexOf(":");
      if (colon >= 0) {
        alias = head.slice(0, colon);
        head = head.slice(colon + 1);
      }
      const [relation, ...mods] = head.split("!");
      let inner = false;
      let hint: string | null = null;
      for (const m of mods) {
        if (m === "inner") inner = true;
        else if (m === "left") inner = false;
        else hint = m;
      }
      fields.push({ kind: "embed", relation, alias, hint, inner, fields: parseSelect(item.slice(open + 1, -1)) });
      continue;
    }
    if (item === "*") {
      fields.push({ kind: "star" });
      continue;
    }
    if (item === "count" || item === "count()") {
      fields.push({ kind: "count" });
      continue;
    }
    let rest = item;
    let alias: string | null = null;
    // `alias:col` (dar nu `col::cast`)
    const m = /^([A-Za-z_][A-Za-z0-9_]*):(?!:)(.*)$/.exec(rest);
    if (m) {
      alias = m[1];
      rest = m[2];
    }
    let cast: string | null = null;
    const c = rest.indexOf("::");
    if (c >= 0) {
      cast = rest.slice(c + 2);
      rest = rest.slice(0, c);
      if (!/^[a-z0-9_ ]+(\[\])?$/i.test(cast)) throw new RestError(400, "PGRST100", `Conversie invalidă: ${cast}`);
    }
    const ref = parseColumnRef(rest);
    fields.push({ kind: "column", name: ref.name, alias, cast, path: ref.path });
  }
  return fields;
}

// ---------------------------------------------------------------------------
// Construirea interogării
// ---------------------------------------------------------------------------
/** `role` = rolul Postgres al cererii; sub `authenticated`, `*` înseamnă doar coloanele pe care le poate citi. */
type Ctx = { meta: SchemaMeta; params: unknown[]; aliasSeq: number; query: URLSearchParams; role: string };

/**
 * Coloanele pe care rolul cererii le poate citi, ca listă SQL; null = toate (`*`).
 * Pentru tabelele fără restricții pe coloane rămâne `*` (aceeași interogare ca înainte).
 */
function readableColumns(ctx: Ctx, t: TableMeta, alias: string | null): string | null {
  const cols = [...t.columns.values()];
  if (!cols.some((c) => (c.deniedFor ?? []).includes(ctx.role))) return null;
  const allowed = cols.filter((c) => !(c.deniedFor ?? []).includes(ctx.role));
  // fără nicio coloană permisă lăsăm `*`, ca Postgres să refuze cererea (permission denied), nu să întoarcă rânduri goale
  if (!allowed.length) return null;
  return allowed.map((c) => (alias ? `${alias}.${q(c.name)}` : q(c.name))).join(", ");
}

const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns", "and", "or", "not.and", "not.or"]);

function table(ctx: Ctx, name: string): TableMeta {
  const t = ctx.meta.tables.get(name);
  if (!t) throw new RestError(404, "PGRST205", `Could not find the table 'public.${name}' in the schema cache`);
  return t;
}

function column(t: TableMeta, name: string) {
  const c = t.columns.get(name);
  if (!c) throw new RestError(400, "42703", `column ${t.name}.${name} does not exist`);
  return c;
}

function param(ctx: Ctx, value: unknown): string {
  ctx.params.push(value);
  return `$${ctx.params.length}`;
}

function columnExpr(t: TableMeta, alias: string, name: string, path: JsonStep[]): { sql: string; type: string } {
  const c = column(t, name);
  let sql = `${alias}.${q(name)}`;
  let type = c.type;
  for (const step of path) {
    sql += `${step.op}'${step.key.replace(/'/g, "''")}'`;
    type = step.op === "->>" ? "text" : "jsonb";
  }
  return { sql, type };
}

function parseInList(value: string): string[] {
  const m = /^\((.*)\)$/s.exec(value);
  if (!m) throw new RestError(400, "PGRST100", `Listă invalidă pentru „in": ${value}`);
  if (m[1] === "") return [];
  return splitTop(m[1]).map((v) => {
    const s = v.trim();
    return s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1).replace(/\\"/g, '"') : s;
  });
}

const COMPARISON: Record<string, string> = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" };

function filterSql(ctx: Ctx, t: TableMeta, alias: string, key: string, expr: string): string {
  const ref = parseColumnRef(key);
  const lhs = columnExpr(t, alias, ref.name, ref.path);
  let negate = false;
  let rest = expr;
  if (rest.startsWith("not.")) {
    negate = true;
    rest = rest.slice(4);
  }
  const dot = rest.indexOf(".");
  const op = dot < 0 ? rest : rest.slice(0, dot);
  const value = dot < 0 ? "" : rest.slice(dot + 1);
  let sql: string;
  if (op in COMPARISON) {
    sql = `${lhs.sql} ${COMPARISON[op]} ${param(ctx, value)}::${lhs.type}`;
  } else if (op === "like" || op === "ilike") {
    sql = `${lhs.sql}::text ${op} ${param(ctx, value.replace(/\*/g, "%"))}`;
  } else if (op === "is") {
    const v = value.toLowerCase();
    if (!["null", "true", "false", "unknown"].includes(v)) throw new RestError(400, "PGRST100", `Valoare invalidă pentru „is": ${value}`);
    sql = `${lhs.sql} is ${v}`;
  } else if (op === "in") {
    sql = `${lhs.sql} = any(${param(ctx, parseInList(value))}::${lhs.type}[])`;
  } else if (op === "cs" || op === "cd" || op === "ov") {
    const operator = op === "cs" ? "@>" : op === "cd" ? "<@" : "&&";
    sql = `${lhs.sql} ${operator} ${param(ctx, value)}::${lhs.type}`;
  } else if (op === "match" || op === "imatch") {
    sql = `${lhs.sql}::text ${op === "match" ? "~" : "~*"} ${param(ctx, value)}`;
  } else {
    throw new RestError(400, "PGRST100", `Operator nesuportat: ${op}`);
  }
  return negate ? `not (${sql})` : `(${sql})`;
}

/** `(a.eq.1,b.is.null,and(c.gt.2,d.lt.3))` */
function logicSql(ctx: Ctx, t: TableMeta, alias: string, joiner: "and" | "or", value: string): string {
  const m = /^\((.*)\)$/s.exec(value.trim());
  if (!m) throw new RestError(400, "PGRST100", `Expresie logică invalidă: ${value}`);
  const parts = splitTop(m[1]).map((raw) => {
    const item = raw.trim();
    const nested = /^(not\.)?(and|or)(\(.*\))$/s.exec(item);
    if (nested) {
      const inner = logicSql(ctx, t, alias, nested[2] as "and" | "or", nested[3]);
      return nested[1] ? `not ${inner}` : inner;
    }
    const dot = item.indexOf(".");
    if (dot < 0) throw new RestError(400, "PGRST100", `Filtru invalid: ${item}`);
    return filterSql(ctx, t, alias, item.slice(0, dot), item.slice(dot + 1));
  });
  if (!parts.length) throw new RestError(400, "PGRST100", "Expresie logică goală");
  return `(${parts.join(` ${joiner} `)})`;
}

/** Filtrele din parametrii cererii pentru un anumit nivel (rădăcină: prefix gol; relație: `rel.`). */
function conditions(ctx: Ctx, t: TableMeta, alias: string, prefix: string): string[] {
  const out: string[] = [];
  for (const [key, value] of ctx.query) {
    if (prefix) {
      if (!key.startsWith(prefix + ".")) continue;
    }
    const local = prefix ? key.slice(prefix.length + 1) : key;
    if (local === "or" || local === "and") out.push(logicSql(ctx, t, alias, local, value));
    else if (local === "not.or" || local === "not.and") out.push(`not ${logicSql(ctx, t, alias, local.slice(4) as "and" | "or", value)}`);
    else if (RESERVED.has(local)) continue;
    else if (!prefix && local.includes(".")) continue; // filtru al unei relații
    else if (prefix && local.includes(".")) continue; // filtru al unei relații mai adânci
    else out.push(filterSql(ctx, t, alias, local, value));
  }
  return out;
}

function orderSql(ctx: Ctx, t: TableMeta, alias: string, prefix: string): string {
  const raw = ctx.query.get(prefix ? `${prefix}.order` : "order");
  if (!raw) return "";
  const terms = splitTop(raw).map((term) => {
    const [ref, ...mods] = term.trim().split(".");
    const expr = columnExpr(t, alias, parseColumnRef(ref).name, parseColumnRef(ref).path).sql;
    let sql = expr;
    for (const m of mods) {
      if (m === "asc" || m === "desc") sql += ` ${m}`;
      else if (m === "nullsfirst") sql += " nulls first";
      else if (m === "nullslast") sql += " nulls last";
      else throw new RestError(400, "PGRST100", `Ordonare invalidă: ${term}`);
    }
    return sql;
  });
  return terms.length ? ` order by ${terms.join(", ")}` : "";
}

function limitSql(ctx: Ctx, prefix: string): string {
  let sql = "";
  const limit = ctx.query.get(prefix ? `${prefix}.limit` : "limit");
  const offset = ctx.query.get(prefix ? `${prefix}.offset` : "offset");
  if (limit !== null) {
    if (!/^\d+$/.test(limit)) throw new RestError(400, "PGRST100", "limit invalid");
    sql += ` limit ${limit}`;
  }
  if (offset !== null) {
    if (!/^\d+$/.test(offset)) throw new RestError(400, "PGRST100", "offset invalid");
    sql += ` offset ${offset}`;
  }
  return sql;
}

type Relationship = { fk: ForeignKey; kind: "many-to-one" | "one-to-many" | "one-to-one"; target: TableMeta };

function resolveRelationship(ctx: Ctx, from: TableMeta, e: EmbedField): Relationship {
  const target = table(ctx, e.relation);
  const matchesHint = (fk: ForeignKey) => !e.hint || fk.name === e.hint || fk.columns.includes(e.hint);
  const candidates: Relationship[] = [];
  for (const fk of ctx.meta.foreignKeys) {
    if (fk.table === from.name && fk.refTable === target.name && matchesHint(fk)) {
      candidates.push({ fk, kind: "many-to-one", target });
    }
    if (fk.table === target.name && fk.refTable === from.name && matchesHint(fk) && !(fk.table === fk.refTable && candidates.some((c) => c.fk === fk))) {
      const unique = target.unique.some((u) => u.length === fk.columns.length && u.every((c) => fk.columns.includes(c)));
      candidates.push({ fk, kind: unique ? "one-to-one" : "one-to-many", target });
    }
  }
  if (!candidates.length) {
    throw new RestError(400, "PGRST200", `Could not find a relationship between '${from.name}' and '${e.relation}' in the schema cache`);
  }
  if (candidates.length > 1) {
    throw new RestError(300, "PGRST201", `Could not embed because more than one relationship was found for '${from.name}' and '${e.relation}'`,
      candidates.map((c) => `${c.kind} via ${c.fk.name}`).join("; "), `Indică relația: ${e.relation}!<constrângere>(...)`);
  }
  return candidates[0];
}

function joinCondition(rel: Relationship, parentAlias: string, childAlias: string): string {
  const { fk } = rel;
  return fk.columns
    .map((c, i) =>
      rel.kind === "many-to-one"
        ? `${childAlias}.${q(fk.refColumns[i])} = ${parentAlias}.${q(c)}`
        : `${childAlias}.${q(c)} = ${parentAlias}.${q(fk.refColumns[i])}`)
    .join(" and ");
}

/** Lista de coloane (cu sub-interogări pentru relații) + condițiile `exists` cerute de `!inner`. */
function projection(ctx: Ctx, t: TableMeta, alias: string, fields: Field[], path: string): { columns: string[]; inner: string[] } {
  const columns: string[] = [];
  const inner: string[] = [];
  for (const f of fields) {
    if (f.kind === "star") columns.push(readableColumns(ctx, t, alias) ?? `${alias}.*`);
    else if (f.kind === "count") columns.push(`count(*) as "count"`);
    else if (f.kind === "column") {
      const e = columnExpr(t, alias, f.name, f.path);
      const name = f.alias ?? (f.path.length ? f.path[f.path.length - 1].key : f.name);
      columns.push(`${e.sql}${f.cast ? `::${f.cast}` : ""} as ${q(name)}`);
    } else {
      const rel = resolveRelationship(ctx, t, f);
      const child = `t${++ctx.aliasSeq}`;
      const name = f.alias ?? f.relation;
      const childPath = path ? `${path}.${name}` : name;
      const sub = projection(ctx, rel.target, child, f.fields, childPath);
      const where = [joinCondition(rel, alias, child), ...conditions(ctx, rel.target, child, childPath), ...sub.inner];
      const isCount = f.fields.length === 1 && f.fields[0].kind === "count";
      const from = `from public.${q(rel.target.name)} ${child} where ${where.join(" and ")}`;
      if (isCount) {
        columns.push(`(select json_build_array(json_build_object('count', count(*))) ${from}) as ${q(name)}`);
      } else {
        const body = `select ${sub.columns.join(", ") || "null"} ${from}${orderSql(ctx, rel.target, child, childPath)}${limitSql(ctx, childPath)}`;
        columns.push(
          rel.kind === "one-to-many"
            ? `(select coalesce(json_agg(row_to_json(s)), '[]'::json) from (${body}) s) as ${q(name)}`
            : `(select row_to_json(s) from (${body} limit 1) s) as ${q(name)}`,
        );
      }
      if (f.inner) inner.push(`exists (select 1 ${from})`);
    }
  }
  return { columns, inner };
}

// ---------------------------------------------------------------------------
// Operațiuni
// ---------------------------------------------------------------------------
function prefer(headers: Headers): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of (headers.get("prefer") ?? "").split(",")) {
    const [k, v] = part.trim().split("=");
    if (k) out.set(k, v ?? "");
  }
  return out;
}

const wantsObject = (headers: Headers) => (headers.get("accept") ?? "").includes("application/vnd.pgrst.object+json");

function ok(status: number, body: string | null, extra: Record<string, string> = {}): RestResponse {
  return { status, headers: { "content-type": "application/json; charset=utf-8", ...extra }, body };
}

function single(rowsJson: string, n: number): RestResponse {
  if (n !== 1) {
    throw new RestError(406, "PGRST116", "JSON object requested, multiple (or no) rows returned", `The result contains ${n} rows`);
  }
  // rowsJson este un tablou cu un singur element
  return ok(200, rowsJson.replace(/^\[/, "").replace(/\]$/, ""));
}

async function read(req: RestRequest, exec: Exec, meta: SchemaMeta, tableName: string, role: string): Promise<RestResponse> {
  const ctx: Ctx = { meta, params: [], aliasSeq: 0, query: req.query, role };
  const t = table(ctx, tableName);
  const fields = parseSelect(req.query.get("select") ?? "*");
  const proj = projection(ctx, t, "t0", fields, "");
  const where = [...conditions(ctx, t, "t0", ""), ...proj.inner];
  const whereSql = where.length ? ` where ${where.join(" and ")}` : "";
  const base = `from public.${q(t.name)} t0${whereSql}`;
  const head = req.method === "HEAD";
  const pref = prefer(req.headers);
  const headers: Record<string, string> = {};

  let total: number | null = null;
  if (pref.get("count") === "exact") {
    const r = await exec(`select count(*)::int as n ${base}`, ctx.params);
    total = r.rows[0].n as number;
  }
  if (head) {
    headers["content-range"] = `${total ? `0-${total - 1}` : "*"}/${total ?? "*"}`;
    return ok(200, null, headers);
  }
  const sql = `select ${proj.columns.join(", ")} ${base}${orderSql(ctx, t, "t0", "")}${limitSql(ctx, "")}`;
  const r = await exec(`select coalesce(json_agg(row_to_json(r)), '[]'::json)::text as body, count(*)::int as n from (${sql}) r`, ctx.params);
  const n = r.rows[0].n as number;
  const body = r.rows[0].body as string;
  const offset = Number(req.query.get("offset") ?? 0);
  headers["content-range"] = `${n ? `${offset}-${offset + n - 1}` : "*"}/${total ?? "*"}`;
  if (wantsObject(req.headers)) return single(body, n);
  return ok(200, body, headers);
}

function payloadColumns(req: RestRequest, t: TableMeta, rows: Record<string, unknown>[]): string[] {
  const explicit = req.query.get("columns");
  const names = explicit
    ? splitTop(explicit).map((c) => c.trim().replace(/^"(.*)"$/, "$1"))
    : [...new Set(rows.flatMap((r) => Object.keys(r)))];
  for (const n of names) {
    if (!t.columns.has(n)) {
      throw new RestError(400, "PGRST204", `Could not find the '${n}' column of '${t.name}' in the schema cache`);
    }
  }
  return names;
}

/** Rulează o modificare și, dacă se cere, întoarce rândurile afectate cu selecția dată. */
async function mutate(req: RestRequest, exec: Exec, ctx: Ctx, t: TableMeta, statement: string, successStatus: number): Promise<RestResponse> {
  const pref = prefer(req.headers);
  if (pref.get("return") !== "representation") {
    await exec(statement, ctx.params);
    return ok(successStatus === 200 ? 204 : successStatus, null);
  }
  const fields = parseSelect(req.query.get("select") ?? "*");
  const proj = projection(ctx, t, "t0", fields, "");
  const sql =
    `with m as (${statement} returning ${readableColumns(ctx, t, null) ?? "*"}) ` +
    `select coalesce(json_agg(row_to_json(r)), '[]'::json)::text as body, count(*)::int as n ` +
    `from (select ${proj.columns.join(", ")} from m t0${orderSql(ctx, t, "t0", "")}) r`;
  const r = await exec(sql, ctx.params);
  const body = r.rows[0].body as string;
  const n = r.rows[0].n as number;
  if (wantsObject(req.headers)) {
    const res = single(body, n);
    return { ...res, status: successStatus };
  }
  return ok(successStatus, body);
}

async function insert(req: RestRequest, exec: Exec, meta: SchemaMeta, tableName: string, role: string): Promise<RestResponse> {
  const ctx: Ctx = { meta, params: [], aliasSeq: 0, query: req.query, role };
  const t = table(ctx, tableName);
  const rows = (Array.isArray(req.body) ? req.body : [req.body]) as Record<string, unknown>[];
  if (!rows.length || rows.some((r) => !r || typeof r !== "object")) {
    if (Array.isArray(req.body) && !rows.length) return ok(201, prefer(req.headers).get("return") === "representation" ? "[]" : null);
    throw new RestError(400, "PGRST102", "Corpul cererii trebuie să fie un obiect sau o listă de obiecte");
  }
  const cols = payloadColumns(req, t, rows);
  const pref = prefer(req.headers);
  let statement: string;
  if (!cols.length) {
    statement = `insert into public.${q(t.name)} default values`;
  } else {
    const list = cols.map(q).join(", ");
    statement = `insert into public.${q(t.name)} (${list}) select ${list} from json_populate_recordset(null::public.${q(t.name)}, ${param(ctx, JSON.stringify(rows))}::json)`;
  }
  const resolution = pref.get("resolution");
  if (resolution === "merge-duplicates" || resolution === "ignore-duplicates") {
    const target = (req.query.get("on_conflict") ? splitTop(req.query.get("on_conflict")!) : t.primaryKey).map((c) => c.trim());
    target.forEach((c) => column(t, c));
    const updates = cols.filter((c) => !target.includes(c));
    statement += ` on conflict (${target.map(q).join(", ")}) `;
    statement += resolution === "merge-duplicates" && updates.length
      ? `do update set ${updates.map((c) => `${q(c)} = excluded.${q(c)}`).join(", ")}`
      : "do nothing";
  }
  return mutate(req, exec, ctx, t, statement, 201);
}

async function update(req: RestRequest, exec: Exec, meta: SchemaMeta, tableName: string, role: string): Promise<RestResponse> {
  const ctx: Ctx = { meta, params: [], aliasSeq: 0, query: req.query, role };
  const t = table(ctx, tableName);
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    throw new RestError(400, "PGRST102", "Corpul cererii trebuie să fie un obiect");
  }
  const cols = payloadColumns(req, t, [req.body as Record<string, unknown>]);
  if (!cols.length) return ok(prefer(req.headers).get("return") === "representation" ? 200 : 204, prefer(req.headers).get("return") === "representation" ? "[]" : null);
  const list = cols.map(q).join(", ");
  const payload = param(ctx, JSON.stringify(req.body));
  const where = conditions(ctx, t, "t0", "");
  const statement =
    `update public.${q(t.name)} as t0 set (${list}) = (select ${list} from json_populate_record(null::public.${q(t.name)}, ${payload}::json))` +
    (where.length ? ` where ${where.join(" and ")}` : "");
  return mutate(req, exec, ctx, t, statement, 200);
}

async function remove(req: RestRequest, exec: Exec, meta: SchemaMeta, tableName: string, role: string): Promise<RestResponse> {
  const ctx: Ctx = { meta, params: [], aliasSeq: 0, query: req.query, role };
  const t = table(ctx, tableName);
  const where = conditions(ctx, t, "t0", "");
  const statement = `delete from public.${q(t.name)} as t0` + (where.length ? ` where ${where.join(" and ")}` : "");
  return mutate(req, exec, ctx, t, statement, 200);
}

function argumentSql(fn: FunctionMeta, args: Record<string, unknown>, payload: string): string {
  for (const name of Object.keys(args)) {
    if (!fn.args.some((a) => a.name === name)) {
      throw new RestError(404, "PGRST202", `Could not find the function public.${fn.name}(${Object.keys(args).join(", ")}) in the schema cache`);
    }
  }
  const parts: string[] = [];
  for (const a of fn.args) {
    if (!(a.name in args)) {
      if (a.hasDefault) continue;
      throw new RestError(404, "PGRST202", `Could not find the function public.${fn.name}(${Object.keys(args).join(", ")}) in the schema cache`, null, `Lipsește argumentul ${a.name}`);
    }
    const key = `'${a.name.replace(/'/g, "''")}'`;
    let value: string;
    if (a.type === "json" || a.type === "jsonb") value = `(${payload}::jsonb -> ${key})::${a.type}`;
    else if (a.type.endsWith("[]")) {
      value = `(case when jsonb_typeof(${payload}::jsonb -> ${key}) = 'array' then array(select jsonb_array_elements_text(${payload}::jsonb -> ${key}))::${a.type} end)`;
    } else value = `(${payload}::jsonb ->> ${key})::${a.type}`;
    parts.push(`${q(a.name)} => ${value}`);
  }
  return parts.join(", ");
}

async function rpc(req: RestRequest, exec: Exec, meta: SchemaMeta, name: string): Promise<RestResponse> {
  const fn = meta.functions.get(name);
  if (!fn) throw new RestError(404, "PGRST202", `Could not find the function public.${name} in the schema cache`);
  const args =
    req.method === "POST"
      ? ((req.body ?? {}) as Record<string, unknown>)
      : Object.fromEntries([...req.query].filter(([k]) => !RESERVED.has(k)));
  if (typeof args !== "object" || Array.isArray(args)) throw new RestError(400, "PGRST102", "Argumentele trebuie trimise ca obiect");
  const argList = argumentSql(fn, args, "$1");
  const params = argList ? [JSON.stringify(args)] : [];
  const call = `public.${q(fn.name)}(${argList})`;

  if (fn.returnKind === "void") {
    await exec(`select ${call}`, params);
    return ok(204, null);
  }
  if (fn.returnKind === "scalar") {
    const sql = fn.returnsSet
      ? `select coalesce(json_agg(x), '[]'::json)::text as body from ${call} x`
      : `select coalesce(to_json(${call}), 'null'::json)::text as body`;
    const r = await exec(sql, params);
    return ok(200, r.rows[0].body as string);
  }
  const r = await exec(`select coalesce(json_agg(row_to_json(r)), '[]'::json)::text as body, count(*)::int as n from (select * from ${call}) r`, params);
  const body = r.rows[0].body as string;
  const n = r.rows[0].n as number;
  if (wantsObject(req.headers) || !fn.returnsSet) {
    if (!fn.returnsSet && n === 0) return ok(200, "null");
    return single(body, n);
  }
  return ok(200, body);
}

/** Codurile de stare pe care le-ar da PostgREST pentru erorile Postgres. */
function statusForPgError(code: string): number {
  if (code === "42501") return 403;
  if (code === "23505" || code === "23503") return 409;
  if (code === "42883" || code === "42P01") return 404;
  if (code.startsWith("08") || code.startsWith("53") || code.startsWith("57")) return 503;
  return 400;
}

/** `role` = rolul Postgres sub care rulează tranzacția (vezi `withIdentity`). */
export async function handleRest(req: RestRequest, exec: Exec, meta: SchemaMeta, role = "authenticated"): Promise<RestResponse> {
  try {
    const parts = req.path.replace(/^\/+|\/+$/g, "").split("/");
    if (parts[0] === "rpc" && parts.length === 2) {
      if (!["POST", "GET", "HEAD"].includes(req.method)) throw new RestError(405, "PGRST101", "Metodă nepermisă");
      return await rpc(req, exec, meta, parts[1]);
    }
    if (parts.length !== 1 || !parts[0]) throw new RestError(404, "PGRST125", "Cale invalidă");
    switch (req.method) {
      case "GET":
      case "HEAD":
        return await read(req, exec, meta, parts[0], role);
      case "POST":
        return await insert(req, exec, meta, parts[0], role);
      case "PATCH":
        return await update(req, exec, meta, parts[0], role);
      case "DELETE":
        return await remove(req, exec, meta, parts[0], role);
      default:
        throw new RestError(405, "PGRST101", "Metodă nepermisă");
    }
  } catch (e) {
    if (e instanceof RestError) {
      return ok(e.status, JSON.stringify({ code: e.code, details: e.details, hint: e.hint, message: e.message }));
    }
    const pg = e as { code?: string; message?: string; detail?: string; hint?: string };
    if (pg && typeof pg.code === "string" && pg.code.length === 5) {
      return ok(statusForPgError(pg.code), JSON.stringify({ code: pg.code, details: pg.detail ?? null, hint: pg.hint ?? null, message: pg.message ?? "Eroare" }));
    }
    throw e;
  }
}
