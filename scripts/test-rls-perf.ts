/**
 * Test de acces pentru Locker Room faza 4 (Performanță și Club).
 *
 *   npx tsx scripts/test-rls-perf.ts
 *
 * Creează două cluburi temporare, rulează verificările și șterge tot. Nu atinge cluburile reale.
 * Fiecare modul al fazei 4 își adaugă aici secțiunea.
 */
import crypto from "node:crypto";
import { closePool, deleteUser, ensureAccount, must, randomPassword, serviceClient, userClient } from "./lib";

const admin = serviceClient();
const run = crypto.randomBytes(3).toString("hex");
const pw = randomPassword();
const mail = (k: string) => `perf-${run}-${k}@example.com`;

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
  const { data: stale } = await admin.from("clubs").select("id").like("slug", "perf-%");
  for (const c of stale ?? []) {
    const { data: us } = await admin.from("profiles").select("id").eq("club_id", c.id);
    await admin.from("clubs").delete().eq("id", c.id);
    for (const u of us ?? []) await deleteUser(u.id);
  }
}

const day = (n: number) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

try {
  const clubA = must(await admin.rpc("setup_club", { p_slug: `perf-a-${run}`, p_name: "Perf A", p_short_name: "A", p_groups: ["U13", "U15"], p_settings: {} }), "club A");
  const clubB = must(await admin.rpc("setup_club", { p_slug: `perf-b-${run}`, p_name: "Perf B", p_short_name: "B", p_groups: ["U11"], p_settings: {} }), "club B");
  clubIds.push(clubA, clubB);
  const [G1, G2] = must(await admin.from("groups").select("id").eq("club_id", clubA).order("sort"), "grupe").map((g) => g.id);
  const H1 = must(await admin.from("groups").select("id").eq("club_id", clubB).single(), "grupa B").id;

  const mkPlayer = async (club: string, group: string, name: string, visa: string | null) =>
    must(await admin.from("players").insert({ club_id: club, group_id: group, full_name: name, display_name: name, birth_date: "2012-03-03", medical_visa_expires_on: visa }).select("id").single(), name).id;
  const p1 = await mkPlayer(clubA, G1, "UNU", day(200));
  const p2 = await mkPlayer(clubA, G1, "DOI", day(5));
  const p3 = await mkPlayer(clubA, G2, "TREI", day(-3));
  const pB = await mkPlayer(clubB, H1, "ALTCLUB", null);

  const acc = async (k: string, role: Parameters<typeof ensureAccount>[1]["role"], club: string, extra: { group_ids?: string[]; player_id?: string } = {}) => {
    const id = await ensureAccount(admin, { email: mail(k), password: pw, full_name: k, role, club_id: club, ...extra });
    userIds.push(id);
    return id;
  };
  await acc("admin", "admin", clubA);
  await acc("secretary", "secretary", clubA);
  await acc("accountant", "accountant", clubA);
  await acc("owner", "owner", clubA);
  await acc("director", "sporting_director", clubA);
  await acc("physio", "physio", clubA);
  await acc("coach", "coach", clubA, { group_ids: [G1] });
  await acc("player1", "player", clubA, { player_id: p1 });
  const uGuardian = await acc("guardian", "guardian", clubA);
  const uGuardian2 = await acc("guardian2", "guardian", clubA);
  await acc("secretaryb", "secretary", clubB);
  const gId = must(await admin.from("guardians").insert({ club_id: clubA, full_name: "Părinte Trei", user_id: uGuardian }).select("id").single(), "părinte").id;
  must(await admin.from("guardian_players").insert({ guardian_id: gId, player_id: p3, is_billing: true }).select("guardian_id"), "legătură");
  const g2Id = must(await admin.from("guardians").insert({ club_id: clubA, full_name: "Părinte Doi", user_id: uGuardian2 }).select("id").single(), "părinte 2").id;
  must(await admin.from("guardian_players").insert({ guardian_id: g2Id, player_id: p2, is_billing: true }).select("guardian_id"), "legătură 2");

  const [adminU, secretary, accountant, owner, director, physio, coach, player1, guardian, guardian2, secretaryB] = await Promise.all(
    ["admin", "secretary", "accountant", "owner", "director", "physio", "coach", "player1", "guardian", "guardian2", "secretaryb"].map((k) => userClient(mail(k))));

  // -------------------------------------------------------------------------
  console.log("\nVize medicale");
  const path3 = `${p3}/${crypto.randomUUID()}-aviz.pdf`;
  const access = async (c: typeof admin, b: string, p: string, a: string) => (await c.rpc("file_access", { p_bucket: b, p_path: p, p_action: a })).data === true;
  check("părintele poate încărca fișierul pentru copilul lui", await access(guardian, "visas", path3, "write"));
  check("părintele NU poate încărca pentru alt copil", !(await access(guardian, "visas", `${p1}/${crypto.randomUUID()}-x.pdf`, "write")));
  check("antrenorul NU încarcă vize", !(await access(coach, "visas", `${p1}/${crypto.randomUUID()}-x.pdf`, "write")));
  check("secretariatul din alt club NU încarcă", !(await access(secretaryB, "visas", `${p1}/${crypto.randomUUID()}-x.pdf`, "write")));
  const sub = await guardian.rpc("submit_visa_document", { p_player: p3, p_path: path3, p_file_name: "aviz.pdf", p_mime: "application/pdf", p_size: 1000, p_issued_on: day(-1) });
  check("părintele trimite documentul", !sub.error, sub.error);
  const docId = sub.data as string;
  check("calea trebuie să fie a jucătorului", await errored(guardian.rpc("submit_visa_document", { p_player: p3, p_path: `${p1}/x-a.pdf`, p_file_name: "a", p_mime: "application/pdf", p_size: 1 })));
  check("părintele NU trimite pentru alt copil", await errored(guardian.rpc("submit_visa_document", { p_player: p1, p_path: `${p1}/${crypto.randomUUID()}-a.pdf`, p_file_name: "a", p_mime: "application/pdf", p_size: 1 })));
  check("aceeași cale nu se poate refolosi", await errored(guardian.rpc("submit_visa_document", { p_player: p3, p_path: path3, p_file_name: "a", p_mime: "application/pdf", p_size: 1 })));
  check("data emiterii nu poate fi în viitor", await errored(guardian.rpc("submit_visa_document", { p_player: p3, p_path: `${p3}/${crypto.randomUUID()}-b.pdf`, p_file_name: "b", p_mime: "application/pdf", p_size: 1, p_issued_on: day(3) })));
  check("secretariatul primește notificarea", (await rows(secretary.from("notifications").select("id").eq("kind", "visa_document"))) === 1);
  check("secretariatul vede documentul", (await rows(secretary.from("visa_documents").select("id"))) === 1);
  check("preparatorul vede documentul", (await rows(physio.from("visa_documents").select("id"))) === 1);
  check("directorul vede documentul", (await rows(director.from("visa_documents").select("id"))) === 1);
  check("antrenorul NU vede documentul altei echipe", (await rows(coach.from("visa_documents").select("id"))) === 0);
  check("contabilul NU vede vizele", (await rows(accountant.from("visa_documents").select("id"))) === 0);
  check("patronul NU vede vizele", (await rows(owner.from("visa_documents").select("id"))) === 0);
  check("alt părinte NU vede documentul", (await rows(guardian2.from("visa_documents").select("id"))) === 0);
  check("alt club NU vede documentul", (await rows(secretaryB.from("visa_documents").select("id"))) === 0);
  check("părintele își citește fișierul", await access(guardian, "visas", path3, "read"));
  check("alt părinte NU citește fișierul", !(await access(guardian2, "visas", path3, "read")));
  check("nimeni nu scrie direct în tabel", await errored(secretary.from("visa_documents").update({ status: "approved", valid_until: day(300) }).eq("id", docId).select("id"))
    && (await rows(admin.from("visa_documents").select("id").eq("id", docId).eq("status", "pending"))) === 1);
  check("părintele NU aprobă", await errored(guardian.rpc("decide_visa_document", { p_id: docId, p_approve: true, p_valid_until: day(300) })));
  check("antrenorul NU aprobă", await errored(coach.rpc("decide_visa_document", { p_id: docId, p_approve: true, p_valid_until: day(300) })));
  check("directorul NU aprobă (biroul și preparatorul o fac)", await errored(director.rpc("decide_visa_document", { p_id: docId, p_approve: true, p_valid_until: day(300) })));
  check("aprobarea cere o dată în viitor", await errored(secretary.rpc("decide_visa_document", { p_id: docId, p_approve: true, p_valid_until: day(-1) })));
  check("respingerea cere motiv", await errored(secretary.rpc("decide_visa_document", { p_id: docId, p_approve: false, p_reason: " " })));
  check("secretariatul aprobă", !(await errored(secretary.rpc("decide_visa_document", { p_id: docId, p_approve: true, p_valid_until: day(364) }))));
  const after = must(await admin.from("players").select("medical_visa_expires_on").eq("id", p3).single(), "viza după");
  check("aprobarea actualizează data vizei", after.medical_visa_expires_on === day(364), after);
  check("documentul nu se verifică de două ori", await errored(secretary.rpc("decide_visa_document", { p_id: docId, p_approve: false, p_reason: "x" })));
  check("părintele primește rezultatul", (await rows(guardian.from("notifications").select("id").eq("kind", "visa_document"))) === 1);

  // mementouri
  check("biroul trimite reamintiri (părintele cu cont)", (await secretary.rpc("send_visa_reminders", { p_players: [p2] })).data === 1);
  check("reamintirea de azi nu se dublează", (await secretary.rpc("send_visa_reminders", { p_players: [p2] })).data === 0);
  check("antrenorul NU trimite reamintiri", await errored(coach.rpc("send_visa_reminders", { p_players: [p2] })));
  check("rularea zilnică e doar a sarcinii programate", await errored(secretary.rpc("run_visa_reminders")));
  const daily = await admin.rpc("run_visa_reminders");
  check("rularea zilnică anunță viza care expiră în 5 zile", !daily.error && (daily.data as number) >= 1, daily);
  check("rularea zilnică nu se repetă pentru același prag", ((await admin.rpc("run_visa_reminders")).data as number) === 0);
  check("jucătorul din alt club nu primește reamintirea biroului A", (await secretary.rpc("send_visa_reminders", { p_players: [pB] })).data === 0);

  // GDPR
  const files = await physio.rpc("player_file_paths", { p_player: p3 });
  check("preparatorul vede fișierele de șters ale jucătorului", !files.error && (files.data as unknown[]).length === 1, files);
  check("secretariatul NU listează fișierele pentru ștergere", await errored(secretary.rpc("player_file_paths", { p_player: p3 })));
  // -------------------------------------------------------------------------
  console.log("\nÎncărcare și greutate");
  check("cererile de RPE sunt doar ale sarcinii programate", await errored(secretary.rpc("run_rpe_requests")));
  check("sarcina programată trimite cererile de RPE", !(await errored(admin.rpc("run_rpe_requests"))));
  const grid = [{ player_id: p1, weight_kg: 61.5, height_cm: 168 }, { player_id: p2, weight_kg: 58 }];
  check("preparatorul salvează grila de greutate", (await physio.rpc("save_body_measurements", { p_date: day(0), p_rows: grid })).data === 2);
  check("a doua salvare în aceeași zi înlocuiește, nu dublează",
    (await physio.rpc("save_body_measurements", { p_date: day(0), p_rows: [{ player_id: p1, weight_kg: 62 }] })).data === 1
    && (await rows(admin.from("anthropometrics").select("id").eq("player_id", p1).eq("measured_on", day(0)))) === 1);
  check("antrenorul NU scrie greutatea", await errored(coach.rpc("save_body_measurements", { p_date: day(0), p_rows: [{ player_id: p1, weight_kg: 70 }] }))
    && (await admin.from("anthropometrics").select("weight_kg").eq("player_id", p1).eq("measured_on", day(0)).single()).data?.weight_kg === 62);
  check("data din viitor e refuzată", await errored(physio.rpc("save_body_measurements", { p_date: day(2), p_rows: grid })));
  check("valorile absurde sunt refuzate", await errored(physio.rpc("save_body_measurements", { p_date: day(0), p_rows: [{ player_id: p1, weight_kg: 900 }] })));
  check("antrenorul vede greutatea echipei lui", (await rows(coach.from("anthropometrics").select("id").eq("player_id", p1))) === 1);
  check("antrenorul NU vede greutatea altei echipe", (await rows(coach.from("anthropometrics").select("id").eq("player_id", p3))) === 0);
  check("biroul NU vede greutatea", (await rows(secretary.from("anthropometrics").select("id"))) === 0);
  check("rândul gol șterge măsurătoarea zilei", (await physio.rpc("save_body_measurements", { p_date: day(0), p_rows: [{ player_id: p2 }] })).data === 1
    && (await rows(admin.from("anthropometrics").select("id").eq("player_id", p2))) === 0);
  void adminU; void player1;
} finally {
  await cleanup();
  await closePool();
}

console.log(`\n${passed} verificări trecute, ${failures.length} eșuate.`);
if (failures.length) process.exit(1);
