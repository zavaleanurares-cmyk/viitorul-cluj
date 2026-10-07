import pg from "pg";

/**
 * Conexiunea la Postgres. Pe Vercel, integrarea Neon injectează `DATABASE_URL` (prin pooler,
 * potrivit pentru cereri scurte) și `DATABASE_URL_UNPOOLED` (direct, pentru migrări).
 * Local, aceeași variabilă indică spre Postgres-ul de dezvoltare.
 */
const globalForPool = globalThis as unknown as { __clubPool?: pg.Pool };

// numeric / bigint ajung în aplicație doar prin JSON; date-le rămân text (AAAA-LL-ZZ)
pg.types.setTypeParser(1082, (v) => v);

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL lipsește din variabilele de mediu.");
  return url;
}

export function isLocalUrl(url: string): boolean {
  return /@(127\.0\.0\.1|localhost)[:/]/.test(url);
}

export function getPool(): pg.Pool {
  if (!globalForPool.__clubPool) {
    const url = databaseUrl();
    const pool = new pg.Pool({
      connectionString: url,
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
    pool.on("error", (e) => console.error("[db] eroare de conexiune inactivă:", e.message));
    globalForPool.__clubPool = pool;
  }
  return globalForPool.__clubPool;
}

export async function closePool(): Promise<void> {
  await globalForPool.__clubPool?.end();
  globalForPool.__clubPool = undefined;
}
