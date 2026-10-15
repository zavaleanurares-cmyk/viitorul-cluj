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
  // -------------------------------------------------------------------------
  console.log("\nBaterii de teste");
  const bat = await physio.rpc("create_fitness_battery", { p: { name: "Viteză", tests: [
    { code: "sprint_10", name: "Sprint 10 m", unit: "s", lower_is_better: true }, { code: "cmj", name: "CMJ", unit: "cm", lower_is_better: false }] } });
  check("preparatorul creează o baterie (cu testele lipsă)", !bat.error, bat.error);
  check("a doua baterie refolosește testul existent după cod", !(await errored(physio.rpc("create_fitness_battery", { p: { name: "Sprint", tests: [{ code: "sprint_10", name: "x", unit: "s" }] } })))
    && (await rows(physio.from("fitness_tests").select("id").eq("code", "sprint_10"))) === 1);
  check("antrenorul NU creează baterii", await errored(coach.rpc("create_fitness_battery", { p: { name: "X", tests: [{ code: "x1", name: "X", unit: "s" }] } })));
  check("antrenorul vede bateriile", (await rows(coach.from("fitness_batteries").select("id"))) === 2);
  const tSprint = must(await physio.from("fitness_tests").select("id").eq("code", "sprint_10").single(), "test").id;
  const tCmj = must(await physio.from("fitness_tests").select("id").eq("code", "cmj").single(), "test cmj").id;
  check("grila salvează jucători × teste", (await physio.rpc("save_test_grid", { p_date: day(0), p_rows: [
    { player_id: p1, test_id: tSprint, value: 1.92 }, { player_id: p1, test_id: tCmj, value: 34 }, { player_id: p2, test_id: tSprint, value: 2.01 }] })).data === 3);
  check("o valoare goală șterge rezultatul zilei", (await physio.rpc("save_test_grid", { p_date: day(0), p_rows: [{ player_id: p2, test_id: tSprint, value: null }] })).data === 1
    && (await rows(admin.from("fitness_test_results").select("id").eq("player_id", p2))) === 0);
  check("antrenorul NU introduce rezultate", await errored(coach.rpc("save_test_grid", { p_date: day(0), p_rows: [{ player_id: p1, test_id: tSprint, value: 3 }] })));
  const tB = must(await admin.from("fitness_tests").insert({ club_id: clubB, code: "b1", name: "B", unit: "s" }).select("id").single(), "test B").id;
  check("testul altui club e refuzat în grilă", await errored(physio.rpc("save_test_grid", { p_date: day(0), p_rows: [{ player_id: p1, test_id: tB, value: 1 }] })));

  // -------------------------------------------------------------------------
  console.log("\nEvaluări");
  const tpl = await director.rpc("save_evaluation_template", { p: { name: "Dezvoltare", criteria: [
    { category: "technical", name: "Pasa" }, { category: "mental", name: "Atitudine" }] } });
  check("directorul creează un model", !tpl.error, tpl.error);
  check("antrenorul NU creează modele", await errored(coach.rpc("save_evaluation_template", { p: { name: "X", criteria: [{ category: "technical", name: "Y" }] } })));
  const crits = must(await director.from("evaluation_criteria").select("id, name").eq("template_id", tpl.data as string), "criterii");
  const cPass = crits.find((c) => c.name === "Pasa")!.id;
  const cAtt = crits.find((c) => c.name === "Atitudine")!.id;
  const rnd = await director.rpc("start_evaluation_round", { p: { name: "Toamna", template_id: tpl.data, group_ids: [G1, G2], due_on: day(14) } });
  check("directorul pornește runda", !rnd.error, rnd.error);
  const roundId = rnd.data as string;
  check("antrenorul primește anunțul rundei", (await rows(coach.from("notifications").select("id").eq("kind", "evaluation_round"))) === 1);
  check("antrenorul NU pornește runde", await errored(coach.rpc("start_evaluation_round", { p: { name: "X", template_id: tpl.data, group_ids: [G1] } })));
  check("antrenorul notează un jucător din echipa lui (ciornă)", !(await errored(coach.rpc("save_evaluation", { p_round: roundId, p_player: p1, p_scores: { [cPass]: 4 } }))));
  check("trimiterea cere toate criteriile", await errored(coach.rpc("save_evaluation", { p_round: roundId, p_player: p1, p_scores: { [cPass]: 4 }, p_submit: true })));
  check("notele sunt de la 1 la 5", await errored(coach.rpc("save_evaluation", { p_round: roundId, p_player: p1, p_scores: { [cPass]: 7, [cAtt]: 3 } })));
  const sent = await coach.rpc("save_evaluation", { p_round: roundId, p_player: p1, p_scores: { [cPass]: 4, [cAtt]: 5 }, p_next_goals: "Pasa cu stângul", p_comment: "intern: discuție cu părinții", p_submit: true });
  check("antrenorul trimite evaluarea", !sent.error, sent.error);
  const evalId = sent.data as string;
  check("antrenorul NU notează jucători din alte echipe", await errored(coach.rpc("save_evaluation", { p_round: roundId, p_player: p3, p_scores: { [cPass]: 3, [cAtt]: 3 } })));
  check("antrenorul NU vede evaluările altor echipe", (await rows(coach.from("evaluations").select("id").eq("player_id", p3))) === 0);
  check("directorul notează orice jucător din rundă", !(await errored(director.rpc("save_evaluation", { p_round: roundId, p_player: p3, p_scores: { [cPass]: 3, [cAtt]: 3 }, p_submit: true }))));
  check("jucătorul din afara rundei e refuzat", await errored(director.rpc("save_evaluation", { p_round: roundId, p_player: pB, p_scores: {} })));
  check("nota internă NU se citește direct din tabel", await errored(director.from("evaluations").select("comment").eq("id", evalId)));
  check("nota internă se citește prin funcție de staff", (await coach.rpc("evaluation_comment", { p_eval: evalId })).data === "intern: discuție cu părinții");
  check("jucătorul NU vede evaluarea înainte de publicare", (await rows(player1.from("evaluations").select("id"))) === 0);
  check("părintele NU vede evaluarea înainte de publicare", (await rows(guardian.from("evaluations").select("id"))) === 0);
  check("biroul NU vede evaluările", (await rows(secretary.from("evaluations").select("id"))) === 0);
  check("antrenorul NU publică", await errored(coach.rpc("publish_evaluation_round", { p_round: roundId })));
  const pub = await director.rpc("publish_evaluation_round", { p_round: roundId });
  check("directorul publică și anunță familiile", !pub.error && (pub.data as number) >= 2, pub);
  check("jucătorul își vede evaluarea publicată", (await rows(player1.from("evaluations").select("id"))) === 1);
  check("jucătorul vede notele pe criterii", (await rows(player1.from("evaluation_scores").select("score").eq("evaluation_id", evalId))) === 2);
  check("jucătorul vede runda publicată", (await rows(player1.from("evaluation_rounds").select("id"))) === 1);
  check("jucătorul NU citește nota internă", (await player1.rpc("evaluation_comment", { p_eval: evalId })).data === null);
  check("părintele vede doar evaluarea copilului lui", (await rows(guardian.from("evaluations").select("player_id"))) === 1
    && (await guardian.from("evaluations").select("player_id").single()).data?.player_id === p3);
  check("alt părinte nu vede nimic (copilul lui nu a fost evaluat)", (await rows(guardian2.from("evaluations").select("id"))) === 0);
  check("după publicare evaluările nu se mai modifică", await errored(director.rpc("save_evaluation", { p_round: roundId, p_player: p1, p_scores: { [cPass]: 1, [cAtt]: 1 } })));
  check("runda cu evaluări nu se șterge", await errored(director.rpc("delete_evaluation_round", { p_round: roundId })));
  check("alt club nu vede runda", (await rows(secretaryB.from("evaluation_rounds").select("id"))) === 0);
  void adminU; void player1;
} finally {
  await cleanup();
  await closePool();
}

console.log(`\n${passed} verificări trecute, ${failures.length} eșuate.`);
if (failures.length) process.exit(1);
