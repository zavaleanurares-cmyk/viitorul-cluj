import { PostgrestClient } from "@supabase/postgrest-js";
import type { PoolClient } from "pg";
import type { Database } from "@club/shared";
import { getPool } from "./pool";
import { loadSchemaMeta, type SchemaMeta } from "./meta";
import { handleRest, type Exec } from "./rest";

export type Claims = {
  /** id-ul utilizatorului (app_auth.users.id); lipsă pentru apeluri de sistem */
  sub?: string;
  /** rolul Postgres sub care rulează cererea */
  role: "authenticated" | "anon" | "service_role";
};

/** Clientul de date al aplicației: constructorul de interogări PostgREST, executat direct pe Postgres. */
export type Db = PostgrestClient<Database>;

const globalForMeta = globalThis as unknown as { __clubMeta?: Promise<SchemaMeta> };

export function schemaMeta(): Promise<SchemaMeta> {
  globalForMeta.__clubMeta ??= loadSchemaMeta((sql, params) => getPool().query(sql, params as unknown[])).catch((e) => {
    globalForMeta.__clubMeta = undefined;
    throw e;
  });
  return globalForMeta.__clubMeta;
}

/** După migrări, metadatele trebuie recitite. */
export function resetSchemaMeta() {
  globalForMeta.__clubMeta = undefined;
}

/**
 * Rulează `fn` într-o tranzacție cu identitatea dată, exact cum face PostgREST:
 *   - `role` devine rolul cererii (authenticated / anon), deci se aplică GRANT-urile și RLS;
 *   - `request.jwt.claims` poartă id-ul utilizatorului, citit de `app_auth.uid()` în politici.
 * Pentru un utilizator autentificat, rolul Postgres se alege din rolul lui în club (`private.db_role_for`):
 * personalul medical și sportiv rulează ca `lr_health` (vede și coloanele medicale), restul ca `authenticated`.
 * Pentru `service_role` nu schimbăm rolul: conexiunea aplicației este proprietara tabelelor și ocolește RLS.
 */
export async function withIdentity<T>(claims: Claims, fn: (client: PoolClient, role: string) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const claimsJson = JSON.stringify(claims);
    const r =
      claims.role === "service_role"
        ? await client.query("select set_config('request.jwt.claims', $1, true), set_config('role', 'none', true) as role", [claimsJson])
        : claims.role === "authenticated" && claims.sub
          ? await client.query("select set_config('request.jwt.claims', $1, true), set_config('role', private.db_role_for($2::uuid), true) as role", [claimsJson, claims.sub])
          : await client.query("select set_config('request.jwt.claims', $1, true), set_config('role', $2, true) as role", [claimsJson, claims.role]);
    const out = await fn(client, (r.rows[0]?.role as string) ?? claims.role);
    await client.query("commit");
    return out;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

function restFetch(claims: Claims): typeof fetch {
  return async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = (init?.method ?? "GET").toUpperCase();
    const headers = new Headers(init?.headers);
    let body: unknown = undefined;
    if (typeof init?.body === "string" && init.body !== "") body = JSON.parse(init.body);
    const attempt = async () => {
      const meta = await schemaMeta();
      return withIdentity(claims, async (client, role) => {
        const exec: Exec = (sql, params) => client.query(sql, params) as ReturnType<Exec>;
        const out = await handleRest({ method, path: url.pathname.replace(/^\/rest/, ""), query: url.searchParams, headers, body }, exec, meta, role);
        // o eroare întoarsă ca răspuns trebuie totuși să anuleze tranzacția
        if (out.status >= 400) await client.query("rollback").then(() => client.query("begin"));
        return out;
      });
    };
    let res = await attempt();
    // tabel / funcție / relație necunoscută: schema s-a schimbat după pornire (o migrare nouă) → recitim o dată
    if (res.status === 404 || res.status === 400) {
      const code = (() => { try { return (JSON.parse(res.body ?? "{}") as { code?: string }).code; } catch { return undefined; } })();
      if (code === "PGRST205" || code === "PGRST202" || code === "PGRST200" || code === "PGRST204") {
        resetSchemaMeta();
        res = await attempt();
      }
    }
    // 204 / 205 / 304 nu pot avea corp
    const noBody = res.body === null || [204, 205, 304].includes(res.status) || method === "HEAD";
    return new Response(noBody ? null : res.body, { status: res.status, headers: res.headers });
  };
}

/**
 * Client de date pentru un utilizator. Toate interogările trec prin RLS.
 *
 *   const db = createDb({ sub: userId, role: "authenticated" });
 *   const { data, error } = await db.from("players").select("id, display_name, groups(name)").eq("is_active", true);
 */
export function createDb(claims: Claims): Db {
  return new PostgrestClient<Database>("http://db.local/rest", { fetch: restFetch(claims), retry: false });
}

/**
 * Client care OCOLEȘTE RLS (rulează ca proprietar al tabelelor). Doar pentru:
 * crearea conturilor, sarcini programate, scripturi de seed. Niciodată pentru cereri ale utilizatorilor.
 */
export function createServiceDb(): Db {
  return createDb({ role: "service_role" });
}

export function createAnonDb(): Db {
  return createDb({ role: "anon" });
}
