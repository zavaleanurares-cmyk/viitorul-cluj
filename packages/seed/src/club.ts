/**
 * Creează clubul Viitorul Cluj (dacă nu există) cu cele 5 grupe, biblioteca de exerciții și conturile de staff.
 * Jucătorii NU se creează aici: vin din importul tabelelor clubului (ecranul Importuri).
 */
import type { Db } from "@club/db";
import { ensureAccount, must, randomPassword, type SeededAccount } from "./common";
import { seedLibrary } from "./library";

export async function seedClub(admin: Db, opts: { slug?: string; domain?: string; password?: string } = {}): Promise<{ clubName: string; created: boolean; accounts: SeededAccount[] }> {
  const slug = opts.slug ?? "viitorul-cluj";
  const domain = opts.domain ?? "example.com";
  let { data: club } = await admin.from("clubs").select("*").eq("slug", slug).maybeSingle();
  const created = !club;
  if (!club) {
    const id = must(
      await admin.rpc("setup_club", {
        p_slug: slug, p_name: "Viitorul Cluj", p_short_name: "Viitorul",
        p_groups: ["Liga 3", "U21", "U17", "U16", "U15"], p_settings: {},
      }),
      "setup_club",
    );
    club = must(await admin.from("clubs").select("*").eq("id", id).single(), "club");
  }
  await seedLibrary(admin, slug);
  const groups = must(await admin.from("groups").select("*").eq("club_id", club.id).order("sort"), "grupe");
  const g = (name: string) => groups.find((x) => x.name === name)!.id;
  const defs = [
    { key: "patron", full_name: "Patron Demo", role: "owner" as const },
    { key: "director", full_name: "Director Sportiv Demo", role: "sporting_director" as const },
    { key: "preparator", full_name: "Preparator Fizic Demo", role: "physio" as const },
    { key: "antrenor.l3", full_name: "Antrenor Liga 3 Demo", role: "coach" as const, group_ids: [g("Liga 3")] },
    { key: "antrenor.juniori", full_name: "Antrenor U17 + U16 Demo", role: "coach" as const, group_ids: [g("U17"), g("U16")] },
    { key: "partener", full_name: "Partener Medical Demo", role: "medical_partner" as const },
  ];
  const accounts: SeededAccount[] = [];
  for (const a of defs) {
    const email = `${a.key}.viitorul@${domain}`;
    const password = opts.password ?? randomPassword();
    await ensureAccount(admin, { email, password, full_name: a.full_name, role: a.role, club_id: club.id, group_ids: a.group_ids });
    accounts.push({ label: a.full_name, email, password });
  }
  return { clubName: club.name, created, accounts };
}
