/**
 * Încarcă biblioteca de exerciții și șabloanele de programe într-un club.
 *   npx tsx scripts/seed-library.ts --club viitorul-cluj [--force]
 */
import { closePool, serviceClient } from "./lib";
import { seedLibrary } from "../packages/seed/src";

const i = process.argv.indexOf("--club");
if (i < 0) throw new Error("Folosire: npx tsx scripts/seed-library.ts --club <slug> [--force]");
const by = await seedLibrary(serviceClient(), process.argv[i + 1], process.argv.includes("--force"));
console.log(`Bibliotecă încărcată: ${by.size} exerciții în club.`);
await closePool();
