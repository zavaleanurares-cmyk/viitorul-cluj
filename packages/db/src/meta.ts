/**
 * Metadatele schemei `public`, citite o singură dată pe proces: coloane, chei, relații, funcții.
 * Stratul REST le folosește ca să valideze numele și să construiască îmbinările dintre tabele.
 */
export type Query = (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;

export type ColumnMeta = {
  name: string;
  type: string;
  /** rolurile Postgres ale cererilor care NU o pot citi (ex. coloanele medicale de pe `players` pentru `authenticated`) */
  deniedFor: string[];
};
export type TableMeta = {
  name: string;
  columns: Map<string, ColumnMeta>;
  primaryKey: string[];
  /** seturi de coloane cu constrângere de unicitate (inclusiv cheia primară) */
  unique: string[][];
};
export type ForeignKey = { name: string; table: string; columns: string[]; refTable: string; refColumns: string[] };
export type FunctionMeta = {
  name: string;
  args: Array<{ name: string; type: string; hasDefault: boolean }>;
  returnsSet: boolean;
  returnType: string;
  /** 'void' | 'scalar' | 'record' (tip compus sau TABLE(...)) */
  returnKind: "void" | "scalar" | "record";
};
export type SchemaMeta = {
  tables: Map<string, TableMeta>;
  foreignKeys: ForeignKey[];
  functions: Map<string, FunctionMeta>;
};

export async function loadSchemaMeta(query: Query): Promise<SchemaMeta> {
  const [cols, cons, fks, fns, viewBases] = await Promise.all([
    query(`
      select c.relname as table, a.attname as name, format_type(a.atttypid, a.atttypmod) as type,
        array_remove(array[
          case when not has_column_privilege('authenticated', c.oid, a.attnum, 'SELECT') then 'authenticated' end,
          case when exists (select 1 from pg_roles where rolname = 'lr_health')
                and not has_column_privilege('lr_health', c.oid, a.attnum, 'SELECT') then 'lr_health' end,
          case when not has_column_privilege('anon', c.oid, a.attnum, 'SELECT') then 'anon' end
        ], null)::text[] as denied_for
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid and c.relkind in ('r', 'p', 'v')
      join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
      where a.attnum > 0 and not a.attisdropped
      order by c.relname, a.attnum`),
    query(`
      select c.relname as table, con.contype as kind,
        (select array_agg(a.attname order by k.ord)::text[]
           from unnest(con.conkey) with ordinality k(attnum, ord)
           join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum) as columns
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
      where con.contype in ('p', 'u')
      union all
      -- indecși unici simpli (fără expresii și fără condiție), care nu sunt constrângeri
      select c.relname, 'u',
        (select array_agg(a.attname order by k.ord)::text[]
           from unnest(i.indkey::int2[]) with ordinality k(attnum, ord)
           join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum)
      from pg_index i
      join pg_class c on c.oid = i.indrelid
      join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
      where i.indisunique and not i.indisprimary and i.indpred is null and i.indexprs is null
        and not exists (select 1 from pg_constraint x where x.conindid = i.indexrelid)`),
    query(`
      select con.conname as name, c.relname as table, fc.relname as ref_table,
        (select array_agg(a.attname order by k.ord)::text[]
           from unnest(con.conkey) with ordinality k(attnum, ord)
           join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum) as columns,
        (select array_agg(a.attname order by k.ord)::text[]
           from unnest(con.confkey) with ordinality k(attnum, ord)
           join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.attnum) as ref_columns
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
      join pg_class fc on fc.oid = con.confrelid
      join pg_namespace fn on fn.oid = fc.relnamespace and fn.nspname = 'public'
      where con.contype = 'f'`),
    query(`
      select p.proname as name, p.proretset as returns_set, p.pronargs as nargs, p.pronargdefaults as ndefaults,
        format_type(p.prorettype, null) as return_type, rt.typtype as return_typtype,
        coalesce(p.proargnames, '{}')::text[] as arg_names,
        coalesce(p.proargmodes::text[], '{}') as arg_modes,
        (select array_agg(format_type(t.oid, null) order by a.ord)::text[]
           from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[])) with ordinality a(oid, ord)
           join pg_type t on t.oid = a.oid) as arg_types
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
      join pg_type rt on rt.oid = p.prorettype
      where p.prokind = 'f'`),
    // vederile și tabelele din care citesc (pentru îmbinări: o vedere moștenește cheile străine ale tabelelor ei)
    query(`
      select distinct v.relname as view, t.relname as base
      from pg_depend d
      join pg_rewrite r on r.oid = d.objid
      join pg_class v on v.oid = r.ev_class and v.relkind = 'v'
      join pg_namespace vn on vn.oid = v.relnamespace and vn.nspname = 'public'
      join pg_class t on t.oid = d.refobjid and t.relkind in ('r', 'p') and t.oid <> v.oid
      join pg_namespace tn on tn.oid = t.relnamespace and tn.nspname = 'public'
      where d.classid = 'pg_rewrite'::regclass`),
  ]);

  const tables = new Map<string, TableMeta>();
  for (const r of cols.rows as Array<{ table: string; name: string; type: string; denied_for: string[] }>) {
    if (r.table.startsWith("_")) continue; // tabele interne (ex. _migrations)
    let t = tables.get(r.table);
    if (!t) tables.set(r.table, (t = { name: r.table, columns: new Map(), primaryKey: [], unique: [] }));
    t.columns.set(r.name, { name: r.name, type: r.type, deniedFor: r.denied_for ?? [] });
  }
  for (const r of cons.rows as Array<{ table: string; kind: string; columns: string[] | null }>) {
    const t = tables.get(r.table);
    if (!t || !r.columns) continue;
    if (r.kind === "p") t.primaryKey = r.columns;
    t.unique.push(r.columns);
  }
  const foreignKeys: ForeignKey[] = (fks.rows as Array<{ name: string; table: string; ref_table: string; columns: string[]; ref_columns: string[] }>)
    .filter((f) => tables.has(f.table) && tables.has(f.ref_table))
    .map((f) => ({ name: f.name, table: f.table, columns: f.columns, refTable: f.ref_table, refColumns: f.ref_columns }));

  // Cheile străine ale unei vederi: cele ale tabelelor de bază ale căror coloane apar, cu același nume, în vedere.
  // Ca la PostgREST, o vedere se poate îmbina cu tabelele la care trimit coloanele ei.
  const bases = new Map<string, string[]>();
  for (const r of viewBases.rows as Array<{ view: string; base: string }>) bases.set(r.view, [...(bases.get(r.view) ?? []), r.base]);
  for (const [view, baseTables] of bases) {
    const v = tables.get(view);
    if (!v) continue;
    const seen = new Set<string>();
    for (const f of foreignKeys.filter((x) => baseTables.includes(x.table))) {
      if (!f.columns.every((c) => v.columns.has(c))) continue;
      const key = `${f.columns.join(",")}>${f.refTable}`;
      if (seen.has(key)) continue;
      seen.add(key);
      foreignKeys.push({ name: `${view}_${f.columns.join("_")}_fkey`, table: view, columns: f.columns, refTable: f.refTable, refColumns: f.refColumns });
    }
  }

  const functions = new Map<string, FunctionMeta>();
  for (const r of fns.rows as Array<{
    name: string; returns_set: boolean; nargs: number; ndefaults: number; return_type: string; return_typtype: string;
    arg_names: string[]; arg_modes: string[]; arg_types: string[] | null;
  }>) {
    const args: FunctionMeta["args"] = [];
    let hasTable = false;
    const types = r.arg_types ?? [];
    let inIndex = 0;
    for (let i = 0; i < types.length; i++) {
      const mode = r.arg_modes[i] ?? "i";
      if (mode === "t" || mode === "o") {
        hasTable = true;
        continue;
      }
      args.push({ name: r.arg_names[i] ?? `$${i + 1}`, type: types[i], hasDefault: inIndex >= r.nargs - r.ndefaults });
      inIndex++;
    }
    functions.set(r.name, {
      name: r.name,
      args,
      returnsSet: r.returns_set,
      returnType: r.return_type,
      returnKind: r.return_type === "void" ? "void" : hasTable || r.return_typtype === "c" ? "record" : "scalar",
    });
  }
  return { tables, foreignKeys, functions };
}
