/**
 * Test de acces pentru secțiunile de antrenament și planul antrenamentului.
 *
 *   npx tsx scripts/test-rls-sectiuni.ts
 *
 * Creează două cluburi temporare, rulează verificările și șterge tot. Nu atinge cluburile reale.
 */
import crypto from "node:crypto";
import { closePool, deleteUser, ensureAccount, must, randomPassword, serviceClient, userClient } from "./lib";

const admin = serviceClient();
const run = crypto.randomBytes(3).toString("hex");
const pw = randomPassword();
const mail = (k: string) => `sect-${run}-${k}@example.com`;

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else { failures.push(name); console.log(`  ✗ ${name}${detail !== undefined ? " — " + JSON.stringify(detail) : ""}`); }
}
const rows = async (q: PromiseLike<{ data: unknown[] | null; error: unknown }>) => ((await q).data ?? []).length;
const errored = async (q: PromiseLike<{ error: { message: string } | null }>) => !!(await q).error;

const userIds: string[] = [];
const clubIds: string[] = [];
async function cleanup() {
  for (const c of clubIds) await admin.from("clubs").delete().eq("id", c);
  for (const u of userIds) await deleteUser(u);
}
{
  const { data: stale } = await admin.from("clubs").select("id").like("slug", "sect-%");
  for (const c of stale ?? []) {
    const { data: us } = await admin.from("profiles").select("id").eq("club_id", c.id);
    await admin.from("clubs").delete().eq("id", c.id);
    for (const u of us ?? []) await deleteUser(u.id);
  }
}

const inDays = (n: number, h = 17) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); d.setUTCHours(h, 0, 0, 0); return d.toISOString(); };

try {
  const clubA = must(await admin.rpc("setup_club", { p_slug: `sect-a-${run}`, p_name: "Sect A", p_short_name: "A", p_groups: ["U13", "U15"], p_settings: {} }), "club A");
  const clubB = must(await admin.rpc("setup_club", { p_slug: `sect-b-${run}`, p_name: "Sect B", p_short_name: "B", p_groups: ["U11"], p_settings: {} }), "club B");
  clubIds.push(clubA, clubB);
  const [G1, G2] = must(await admin.from("groups").select("id").eq("club_id", clubA).order("sort"), "grupe").map((g) => g.id);
  const p1 = must(await admin.from("players").insert({ club_id: clubA, group_id: G1, full_name: "UNU", display_name: "UNU", birth_date: "2012-03-03" }).select("id").single(), "jucător").id;

  const acc = async (k: string, role: Parameters<typeof ensureAccount>[1]["role"], club: string, extra: { group_ids?: string[]; player_id?: string } = {}) => {
    const id = await ensureAccount(admin, { email: mail(k), password: pw, full_name: k, role, club_id: club, ...extra });
    userIds.push(id);
    return id;
  };
  const uCoach1 = await acc("coach1", "coach", clubA, { group_ids: [G1] });
  await acc("coach2", "coach", clubA, { group_ids: [G2] });
  await acc("secretary", "secretary", clubA);
  await acc("player", "player", clubA, { player_id: p1 });
  await acc("secretaryb", "secretary", clubB);
  const coach1 = await userClient(mail("coach1"));
  const coach2 = await userClient(mail("coach2"));
  const secretary = await userClient(mail("secretary"));
  const player = await userClient(mail("player"));
  const otherClub = await userClient(mail("secretaryb"));

  console.log("Secțiuni");
  const pub = must(await coach1.from("drills").insert({ club_id: clubA, created_by: uCoach1, name: "Rondo 4v2", visibility: "club",
    diagram: { pitch: "area", items: [{ id: "a", t: "player", x: 5, y: 5, team: "a", label: "1" }] } }).select("id").single(), "secțiune publică").id;
  const priv = must(await coach1.from("drills").insert({ club_id: clubA, created_by: uCoach1, name: "Privată", visibility: "private" }).select("id").single(), "secțiune privată").id;
  check("antrenorul NU poate crea o secțiune în numele altcuiva",
    await errored(coach2.from("drills").insert({ club_id: clubA, created_by: uCoach1, name: "Fals" })));
  check("alt antrenor vede secțiunea clubului", (await rows(coach2.from("drills").select("id").eq("id", pub))) === 1);
  check("alt antrenor NU vede secțiunea privată", (await rows(coach2.from("drills").select("id").eq("id", priv))) === 0);
  check("biroul vede și secțiunea privată", (await rows(secretary.from("drills").select("id").eq("id", priv))) === 1);
  check("alt antrenor NU poate modifica secțiunea", (await rows(coach2.from("drills").update({ name: "X" }).eq("id", pub).select("id"))) === 0);
  check("alt antrenor NU poate șterge secțiunea", (await rows(coach2.from("drills").delete().eq("id", pub).select("id"))) === 0);
  check("biroul poate modifica secțiunea", (await rows(secretary.from("drills").update({ kind: "Rondo" }).eq("id", pub).select("id"))) === 1);
  check("jucătorul NU vede secțiunile", (await rows(player.from("drills").select("id"))) === 0);
  check("alt club NU vede secțiunile", (await rows(otherClub.from("drills").select("id"))) === 0);
  check("o schemă prea mare e refuzată",
    await errored(coach1.from("drills").insert({ club_id: clubA, created_by: uCoach1, name: "Mare", diagram: { pitch: "full", items: [], junk: "x".repeat(70000) } })));

  console.log("\nPlanul antrenamentului");
  const ev = must(await admin.from("events").insert({ club_id: clubA, kind: "training", title: "Antrenament", starts_at: inDays(3), ends_at: inDays(3, 18) }).select("id").single(), "antrenament").id;
  must(await admin.from("event_teams").insert({ event_id: ev, group_id: G1 }).select("event_id"), "echipa antrenamentului");
  const match = must(await admin.from("events").insert({ club_id: clubA, kind: "match", title: "Meci", starts_at: inDays(4), ends_at: inDays(4, 18) }).select("id").single(), "meci").id;
  must(await admin.from("event_teams").insert({ event_id: match, group_id: G1 }).select("event_id"), "echipa meciului");

  const plan = { theme: "Construcție", items: [{ drill_id: pub, title: "Rondo 4v2", duration_min: 15 }, { title: "Joc 7v7", duration_min: 30 }] };
  const ok = await coach1.rpc("save_training_plan", { p_event: ev, p: plan });
  check("antrenorul echipei salvează planul", !ok.error, ok.error);
  check("planul are 2 secțiuni, în ordine", JSON.stringify((await coach1.from("training_plan_items").select("title").eq("event_id", ev).order("position")).data?.map((r) => r.title)) === JSON.stringify(["Rondo 4v2", "Joc 7v7"]));
  check("antrenorul altei echipe NU poate salva planul", await errored(coach2.rpc("save_training_plan", { p_event: ev, p: plan })));
  check("antrenorul altei echipe vede planul (calendar comun)", (await rows(coach2.from("training_plan_items").select("id").eq("event_id", ev))) === 2);
  check("jucătorul NU vede planul", (await rows(player.from("training_plans").select("event_id").eq("event_id", ev))) === 0);
  check("planul nu se face pentru un meci", await errored(coach1.rpc("save_training_plan", { p_event: match, p: plan })));
  check("o secțiune privată a altcuiva NU intră în plan",
    await errored(coach2.rpc("save_training_plan", { p_event: ev, p: { items: [{ drill_id: priv, title: "x" }] } }))
    && await errored(secretary.rpc("save_training_plan", { p_event: ev, p: { items: [{ drill_id: crypto.randomUUID(), title: "x" }] } })));
  check("biroul poate salva planul", !(await secretary.rpc("save_training_plan", { p_event: ev, p: plan })).error);
  check("alt club NU vede planul", (await rows(otherClub.from("training_plans").select("event_id"))) === 0);

  const del = await coach1.from("drills").delete().eq("id", pub).select("id");
  const kept = (await coach1.from("training_plan_items").select("title, drill_id").eq("event_id", ev).order("position")).data ?? [];
  check("ștergerea secțiunii păstrează numele în plan", !del.error && kept[0]?.title === "Rondo 4v2" && kept[0]?.drill_id === null, { del: del.error, kept });
  const empty = await coach1.rpc("save_training_plan", { p_event: ev, p: { items: [] } });
  check("un plan gol se șterge", !empty.error && (await rows(admin.from("training_plans").select("event_id").eq("event_id", ev))) === 0);

  console.log("\nNotele de la antrenament");
  const p2 = must(await admin.from("players").insert({ club_id: clubA, group_id: G2, full_name: "DOI", display_name: "DOI", birth_date: "2012-03-03" }).select("id").single(), "jucător G2").id;
  const r1 = await coach1.rpc("save_training_ratings", { p_event: ev, p_ratings: { [p1]: 4, [p2]: 5 } });
  check("antrenorul echipei dă note (doar jucătorilor echipei)", r1.data === 1, r1);
  check("antrenorul altei echipe NU dă note", await errored(coach2.rpc("save_training_ratings", { p_event: ev, p_ratings: { [p1]: 1 } })));
  check("biroul vede notele", (await rows(secretary.from("training_ratings").select("player_id").eq("event_id", ev))) === 1);
  check("jucătorul NU vede notele", (await rows(player.from("training_ratings").select("player_id"))) === 0);
  check("antrenorul altei echipe NU vede notele", (await rows(coach2.from("training_ratings").select("player_id"))) === 0);
  check("notele nu se dau la meci", await errored(coach1.rpc("save_training_ratings", { p_event: match, p_ratings: { [p1]: 3 } })));
  check("o notă în afara 1–5 e ignorată", (await coach1.rpc("save_training_ratings", { p_event: ev, p_ratings: { [p1]: 9 } })).data === 0
    && (await coach1.from("training_ratings").select("rating").eq("event_id", ev).single()).data?.rating === 4);
  await coach1.rpc("save_training_ratings", { p_event: ev, p_ratings: { [p1]: null } });
  check("null șterge nota", (await rows(coach1.from("training_ratings").select("player_id").eq("event_id", ev))) === 0);

  console.log("\nFișiere");
  const path = `${clubA}/${crypto.randomUUID()}.jpg`;
  check("antrenorul poate încărca o imagine", (await coach1.rpc("file_access", { p_bucket: "drills", p_path: path, p_action: "write" })).data === true);
  check("jucătorul NU poate încărca o imagine", (await player.rpc("file_access", { p_bucket: "drills", p_path: path, p_action: "write" })).data !== true);
  check("alt club NU poate încărca în dosarul clubului", (await otherClub.rpc("file_access", { p_bucket: "drills", p_path: path, p_action: "write" })).data !== true);
  must(await coach1.from("drills").update({ image_paths: [path] }).eq("id", priv).select("id"), "imagine în secțiunea privată");
  check("imaginea secțiunii private: alt antrenor NU o citește", (await coach2.rpc("file_access", { p_bucket: "drills", p_path: path, p_action: "read" })).data !== true);
  check("imaginea secțiunii private: autorul o citește", (await coach1.rpc("file_access", { p_bucket: "drills", p_path: path, p_action: "read" })).data === true);
  check("imaginea secțiunii private: alt antrenor NU o șterge", (await coach2.rpc("file_access", { p_bucket: "drills", p_path: path, p_action: "delete" })).data !== true);
} catch (e) {
  failures.push("EROARE DE EXECUȚIE: " + (e as Error).message);
  console.error(e);
} finally {
  await cleanup();
  await closePool();
}

console.log(`\n${passed} verificări trecute, ${failures.length} eșuate.`);
if (failures.length) {
  console.log("Eșuate:\n" + failures.map((f) => "  - " + f).join("\n"));
  process.exit(1);
}
