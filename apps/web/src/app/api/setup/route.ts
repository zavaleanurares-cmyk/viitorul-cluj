import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createServiceDb } from "@club/db";
import { seedClub, seedDemo } from "@club/seed";

export const maxDuration = 300;

/**
 * Inițializarea unei instalări noi (o singură dată, după primul deploy):
 *   /api/setup?pas=stare   — ce există în baza de date
 *   /api/setup?pas=club    — clubul Viitorul Cluj: grupe, stări, bibliotecă, conturi de staff
 *   /api/setup?pas=demo    — clubul demonstrativ, cu date inventate și conturi pentru toate rolurile
 * Activă DOAR cât timp există variabila SETUP_SECRET; secretul se trimite în antetul
 * `x-setup-secret` (sau în parametrul `s`). După inițializare, șterge variabila din Vercel:
 * ruta răspunde din nou 404. Parolele generate apar o singură dată, în răspuns.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.SETUP_SECRET;
  const given = request.headers.get("x-setup-secret") ?? request.nextUrl.searchParams.get("s") ?? "";
  const a = crypto.createHash("sha256").update(secret ?? "").digest();
  const b = crypto.createHash("sha256").update(given).digest();
  if (!secret || secret.length < 24 || !crypto.timingSafeEqual(a, b)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const step = request.nextUrl.searchParams.get("pas") ?? "stare";
  const admin = createServiceDb();
  const headers = { "Cache-Control": "private, no-store" };
  try {
    if (step === "club") return NextResponse.json(await seedClub(admin), { headers });
    if (step === "demo") return NextResponse.json(await seedDemo(admin, { reset: request.nextUrl.searchParams.get("reset") === "1" }), { headers });
    const [clubs, players, profiles, exercises] = await Promise.all([
      admin.from("clubs").select("slug, name"),
      admin.from("players").select("id", { count: "exact", head: true }),
      admin.from("profiles").select("id", { count: "exact", head: true }),
      admin.from("exercises").select("id", { count: "exact", head: true }),
    ]);
    return NextResponse.json(
      { clubs: clubs.data, players: players.count, accounts: profiles.count, exercises: exercises.count, error: clubs.error?.message ?? null },
      { headers },
    );
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500, headers });
  }
}
