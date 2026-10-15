/**
 * Rulat la build-ul de producție (Vercel), după migrări: reface clubul demo dacă versiunea
 * conținutului demo s-a schimbat (DEMO_VERSION din packages/seed/src/demo.ts).
 *   node --import tsx ../../scripts/demo-build.ts            # doar în producție
 *   npx tsx scripts/demo-build.ts --force                   # local, oricând
 * Nu oprește niciodată build-ul: o eroare se scrie în jurnal, iar site-ul pleacă oricum.
 */
const force = process.argv.includes("--force");
if (!force && process.env.VERCEL_ENV !== "production") {
  console.log("[demo] nu e build de producție; sar peste.");
  process.exit(0);
}
if (!process.env.DATABASE_URL) {
  console.log("[demo] lipsește DATABASE_URL; sar peste.");
  process.exit(0);
}

try {
  const { closePool, serviceClient } = await import("./lib");
  const { DEMO_SLUG, DEMO_VERSION, seedDemo } = await import("../packages/seed/src");
  const admin = serviceClient();
  const { data: club } = await admin.from("clubs").select("settings").eq("slug", DEMO_SLUG).maybeSingle();
  const current = (club?.settings as Record<string, unknown> | null)?.demo_version;
  if (current === DEMO_VERSION && !force) {
    console.log(`[demo] clubul demo e la zi (${DEMO_VERSION}).`);
  } else {
    const started = Date.now();
    console.log(`[demo] refac clubul demo: ${String(current ?? "—")} → ${DEMO_VERSION}`);
    const res = await seedDemo(admin, { reset: true, domain: process.env.DEMO_EMAIL_DOMAIN });
    console.log(`[demo] gata în ${Math.round((Date.now() - started) / 1000)} s: ${res.players} jucători, ${res.accounts.length} conturi.`);
  }
  await closePool();
} catch (e) {
  console.error(`[demo] nu s-a putut reface clubul demo: ${(e as Error).message}`);
}
process.exit(0);
