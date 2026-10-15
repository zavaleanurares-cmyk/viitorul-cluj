/**
 * Test de acces pentru Locker Room faza 4 (Performanță și Club).
 *
 *   npx tsx scripts/test-rls-perf.ts
 *
 * Creează două cluburi temporare, rulează verificările și șterge tot. Nu atinge cluburile reale.
 * Fiecare modul al fazei 4 își adaugă aici secțiunea.
 */
import crypto from "node:crypto";
import { anonClient, closePool, deleteUser, ensureAccount, must, randomPassword, serviceClient, userClient } from "./lib";

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
  // -------------------------------------------------------------------------
  console.log("\nVideo");
  const vpath = `${clubA}/${crypto.randomUUID()}-meci.mp4`;
  check("antrenorul poate încărca un fișier video", await access(coach, "videos", vpath, "write"));
  check("biroul NU încarcă video", !(await access(secretary, "videos", vpath, "write")));
  const vid = await coach.from("videos").insert({ club_id: clubA, group_id: G1, title: "Meci U13", source: "upload", storage_path: vpath, recorded_on: day(-1) }).select("id").single();
  check("antrenorul adaugă video pentru echipa lui", !vid.error, vid.error);
  check("antrenorul NU adaugă video pentru altă echipă", await errored(coach.from("videos").insert({ club_id: clubA, group_id: G2, title: "X", source: "veo", url: "https://app.veo.co/x", recorded_on: day(-1) }).select("id")));
  const vid2 = must(await director.from("videos").insert({ club_id: clubA, group_id: G2, title: "Meci U15", source: "youtube", url: "https://youtu.be/abc", recorded_on: day(-1) }).select("id").single(), "video U15").id;
  check("antrenorul NU vede video-ul altei echipe", (await rows(coach.from("videos").select("id").eq("id", vid2))) === 0);
  check("biroul NU vede video", (await rows(secretary.from("videos").select("id"))) === 0);
  check("adresele fără https sunt refuzate", await errored(director.from("videos").insert({ club_id: clubA, title: "X", source: "other", url: "http://x.ro", recorded_on: day(-1) }).select("id")));
  const vId = vid.data!.id;
  const mk = must(await coach.from("video_markers").insert({ video_id: vId, t_sec: 30, end_sec: 50, tag: "goal", label: "Gol" }).select("id").single(), "marcaj").id;
  const mk2 = must(await coach.from("video_markers").insert({ video_id: vId, t_sec: 70, end_sec: 80, tag: "mistake" }).select("id").single(), "marcaj 2").id;
  check("partajarea cere un jucător etichetat", await errored(coach.rpc("share_video_marker", { p_marker: mk, p_share: true })));
  must(await coach.from("video_marker_players").insert([{ marker_id: mk, player_id: p1 }, { marker_id: mk, player_id: p2 }]).select("marker_id"), "etichete");
  must(await coach.from("video_marker_players").insert({ marker_id: mk2, player_id: p1 }).select("marker_id"), "etichete 2");
  check("nu se etichetează jucători din alt club", await errored(coach.from("video_marker_players").insert({ marker_id: mk2, player_id: pB }).select("marker_id")));
  check("jucătorul NU vede clipurile nepartajate", ((await player1.rpc("my_clips")).data as unknown[]).length === 0
    && (await rows(player1.from("video_markers").select("id"))) === 0);
  const shareRes = await coach.rpc("share_video_marker", { p_marker: mk, p_share: true });
  check("antrenorul partajează clipul și anunță familia", !shareRes.error && (shareRes.data as number) >= 2, shareRes);
  const clips1 = (await player1.rpc("my_clips")).data as Array<{ marker_id: string }>;
  check("jucătorul vede doar clipul partajat", clips1.length === 1 && clips1[0].marker_id === mk);
  check("jucătorul NU vede înregistrarea întreagă", (await rows(player1.from("videos").select("id"))) === 0);
  check("jucătorul își vede doar propria etichetă pe clip", (await rows(player1.from("video_marker_players").select("player_id").eq("marker_id", mk))) === 1);
  check("jucătorul citește fișierul clipului", await access(player1, "videos", vpath, "read"));
  check("alt părinte NU citește fișierul", !(await access(guardian, "videos", vpath, "read")));
  check("părintele copilului etichetat vede clipul", ((await guardian2.rpc("my_clips")).data as unknown[]).length === 1);
  check("oprirea partajării ascunde clipul", !(await errored(coach.rpc("share_video_marker", { p_marker: mk, p_share: false })))
    && ((await player1.rpc("my_clips")).data as unknown[]).length === 0);
  check("antrenorul NU partajează clipuri din video-ul altei echipe", await errored(coach.rpc("share_video_marker", { p_marker: must(await director.from("video_markers").insert({ video_id: vid2, t_sec: 1, end_sec: 5, tag: "goal" }).select("id").single(), "m3").id, p_share: true })));
  // -------------------------------------------------------------------------
  console.log("\nMesaje");
  const audG1 = { audiences: ["guardians", "players"], group_ids: [G1], exclude_user_ids: [] };
  const prev = await coach.rpc("preview_message_audience", { p_audience: audG1 });
  const prevRows = (prev.data ?? []) as Array<{ user_id: string; role: string }>;
  check("previzualizarea arată părinții și jucătorii echipei", !prev.error && prevRows.some((r) => r.role === "guardian") && prevRows.some((r) => r.role === "player"), prev);
  check("părintele altei echipe NU apare", !prevRows.some((r) => r.user_id === uGuardian));
  check("antrenorul NU trimite altei echipe", await errored(coach.rpc("send_message", { p: { title: "Test", body: "x", audience: { audiences: ["guardians"], group_ids: [G2] } } })));
  check("antrenorul NU trimite fără echipă", await errored(coach.rpc("send_message", { p: { title: "Test", body: "x", audience: { audiences: ["guardians"], group_ids: [] } } })));
  check("antrenorul NU trimite către tot staff-ul", await errored(coach.rpc("send_message", { p: { title: "Test", body: "x", audience: { audiences: ["staff"], group_ids: [G1] } } })));
  check("părintele NU trimite mesaje", await errored(guardian.rpc("send_message", { p: { title: "Test", body: "x", audience: { audiences: ["guardians"], group_ids: [G1] } } })));
  const sentMsg = await coach.rpc("send_message", { p: { title: "Antrenament anulat", body: "Azi nu avem antrenament.", audience: { ...audG1, exclude_user_ids: [] } } });
  check("antrenorul trimite echipei lui", !sentMsg.error && (sentMsg.data as { recipients: number }).recipients >= 2, sentMsg);
  const msgId = (sentMsg.data as { id: string }).id;
  check("părintele din echipă primește mesajul", (await rows(guardian2.from("message_recipients").select("message_id").eq("message_id", msgId))) === 1
    && (await rows(guardian2.from("messages").select("id").eq("id", msgId))) === 1);
  check("părintele altei echipe NU vede mesajul", (await rows(guardian.from("messages").select("id").eq("id", msgId))) === 0);
  check("destinatarul nu vede lista celorlalți destinatari", (await rows(guardian2.from("message_recipients").select("user_id").eq("message_id", msgId))) === 1);
  check("secretariatul vede mesajul și statistica", (await rows(secretary.from("message_recipients").select("user_id").eq("message_id", msgId))) >= 2);
  check("contabilul NU vede mesajele altora", (await rows(accountant.from("messages").select("id"))) === 0);
  await guardian2.rpc("mark_message_read", { p_id: msgId });
  check("citirea se vede la expeditor", (await rows(coach.from("message_recipients").select("user_id").eq("message_id", msgId).not("read_at", "is", null))) === 1);
  const excl = await secretary.rpc("send_message", { p: { title: "Doar părinții U13", body: "x", audience: { audiences: ["guardians"], group_ids: [G1], exclude_user_ids: [uGuardian2] } } });
  check("excluderea scoate destinatarul", !!excl.error || (excl.data as { recipients: number }).recipients === 0, excl);
  const later = await secretary.rpc("send_message", { p: { title: "Programat", body: "x", audience: { audiences: ["staff"], group_ids: [] }, scheduled_at: new Date(Date.now() + 3600e3).toISOString() } });
  check("secretariatul programează un mesaj", !later.error && (later.data as { recipients: number }).recipients === 0, later);
  check("mesajul programat nu ajunge încă", (await rows(coach.from("message_recipients").select("message_id").eq("message_id", (later.data as { id: string }).id))) === 0);
  check("rularea mesajelor e doar a sarcinii programate", await errored(secretary.rpc("run_scheduled_messages")));
  check("mesajul programat se poate anula", !(await errored(secretary.rpc("cancel_message", { p_id: (later.data as { id: string }).id }))));
  check("antrenorul NU salvează șabloane pentru club", await errored(coach.from("message_templates").insert({ club_id: clubA, name: "X", title: "Xx", body: "x" }).select("id")));
  check("alt club nu vede mesajele", (await rows(secretaryB.from("messages").select("id"))) === 0);
  // -------------------------------------------------------------------------
  console.log("\nContracte");
  const body = "Subsemnatul {{parinte}}, pentru {{jucator}} ({{echipa}}), la {{club}}, sezonul {{sezon}}. Data: {{data}}";
  check("antrenorul NU creează modele de contract", await errored(coach.rpc("save_contract_template", { p: { name: "Acord", kind: "other", body } })));
  check("contabilul NU creează modele de contract", await errored(accountant.rpc("save_contract_template", { p: { name: "Acord", kind: "other", body } })));
  const tplRes = await secretary.rpc("save_contract_template", { p: { name: "Acord foto", kind: "photo_consent", body } });
  check("secretariatul creează un model", !tplRes.error, tplRes);
  const tplId = tplRes.data as string;
  await secretary.rpc("save_contract_template", { p: { id: tplId, name: "Acord foto", kind: "photo_consent", body } });
  const vers1 = await rows(secretary.from("contract_template_versions").select("id").eq("template_id", tplId));
  await secretary.rpc("save_contract_template", { p: { id: tplId, name: "Acord foto", kind: "photo_consent", body: body + " Modificat." } });
  check("același text nu face versiune nouă; textul schimbat face", vers1 === 1 && (await rows(secretary.from("contract_template_versions").select("id").eq("template_id", tplId))) === 2);
  check("părintele NU vede modelele", (await rows(guardian.from("contract_templates").select("id"))) === 0);
  check("antrenorul NU trimite contracte", await errored(coach.rpc("send_contracts", { p_template: tplId, p_players: [p1, p2, p3] })));
  const sentC = await secretary.rpc("send_contracts", { p_template: tplId, p_players: [p1, p2, p3, pB], p_due_on: day(7) });
  check("trimiterea ajunge la cei trei semnatari, fără jucătorul altui club", !sentC.error && (sentC.data as { sent: number }).sent === 3, sentC);
  const again = await secretary.rpc("send_contracts", { p_template: tplId, p_players: [p2] });
  check("nu se trimite de două ori aceeași versiune", (again.data as { sent: number }).sent === 0, again);
  const cs = must(await admin.from("contracts").select("id, player_id, signer_user_id, body").eq("club_id", clubA), "contracte");
  const c2 = cs.find((c) => c.player_id === p2)!, c3 = cs.find((c) => c.player_id === p3)!, c1 = cs.find((c) => c.player_id === p1)!;
  check("semnatarul copilului e părintele plătitor; al jucătorului fără părinte e jucătorul", c2.signer_user_id === uGuardian2 && c3.signer_user_id === uGuardian && c1.signer_user_id !== uGuardian && c1.signer_user_id !== uGuardian2);
  check("textul trimis are câmpurile completate", c2.body.includes("Părinte Doi") && c2.body.includes("DOI") && c2.body.includes("Perf A") && !c2.body.includes("{{"));
  check("părintele vede doar documentul lui", (await rows(guardian2.from("contracts").select("id"))) === 1 && (await rows(guardian2.from("contracts").select("id").eq("id", c3.id))) === 0);
  check("antrenorul NU vede contractele", (await rows(coach.from("contracts").select("id"))) === 0);
  check("contabilul NU vede contractele", (await rows(accountant.from("contracts").select("id"))) === 0);
  check("alt club NU vede contractele", (await rows(secretaryB.from("contracts").select("id"))) === 0);
  check("semnatarul NU modifică direct documentul", await errored(guardian2.from("contracts").update({ status: "signed" }).eq("id", c2.id).select("id"))
    || (await admin.from("contracts").select("status").eq("id", c2.id).single()).data?.status === "sent");
  const sigOk = `${clubA}/${c2.id}/semnatura-${crypto.randomUUID()}.png`;
  check("semnatarul poate încărca semnătura", await access(guardian2, "contracts", sigOk, "write"));
  check("alt părinte NU încarcă semnătura pe documentul altuia", !(await access(guardian, "contracts", sigOk, "write")));
  check("semnătura cu cale greșită e respinsă", await errored(guardian2.rpc("sign_contract", { p_id: c2.id, p_name: "Părinte Doi", p_signature_path: `${clubA}/${c3.id}/semnatura-x.png` })));
  check("alt părinte NU semnează documentul", await errored(guardian.rpc("sign_contract", { p_id: c2.id, p_name: "Părinte Trei", p_signature_path: sigOk })));
  check("biroul NU semnează în locul părintelui", await errored(secretary.rpc("sign_contract", { p_id: c2.id, p_name: "Secretariat", p_signature_path: sigOk })));
  await guardian2.rpc("view_contract", { p_id: c2.id, p_ip: "203.0.113.5" });
  const signed = await guardian2.rpc("sign_contract", { p_id: c2.id, p_name: "Părinte Doi", p_signature_path: sigOk, p_ip: "203.0.113.5", p_user_agent: "test" });
  check("părintele semnează și primește amprenta", !signed.error && /^[0-9a-f]{64}$/.test(signed.data as string), signed);
  check("a doua semnare e respinsă", await errored(guardian2.rpc("sign_contract", { p_id: c2.id, p_name: "Părinte Doi", p_signature_path: sigOk })));
  const ev = must(await secretary.from("contract_events").select("action, ip").eq("contract_id", c2.id).order("at"), "urma");
  check("urma de audit: trimis, deschis, semnat (cu IP)", ev.map((e) => e.action).join(",") === "sent,viewed,signed" && ev[2].ip === "203.0.113.5", ev);
  check("după semnare nu se mai încarcă semnături", !(await access(guardian2, "contracts", `${clubA}/${c2.id}/semnatura-${crypto.randomUUID()}.png`, "write")));
  check("biroul citește semnătura", await access(secretary, "contracts", sigOk, "read"));
  check("semnatarul își citește semnătura", await access(guardian2, "contracts", sigOk, "read"));
  check("alt părinte NU citește semnătura", !(await access(guardian, "contracts", sigOk, "read")));
  check("antrenorul NU citește semnătura", !(await access(coach, "contracts", sigOk, "read")));
  check("documentul semnat nu se poate anula", await errored(secretary.rpc("void_contract", { p_id: c2.id, p_reason: "test" })));
  check("refuzul cere un motiv", await errored(guardian.rpc("decline_contract", { p_id: c3.id, p_reason: " " })));
  check("părintele refuză documentul lui", !(await errored(guardian.rpc("decline_contract", { p_id: c3.id, p_reason: "Numele copilului e greșit" }))));
  check("biroul e anunțat de refuz", (await rows(admin.from("notifications").select("id").eq("dedupe_key", `contract_declined:${c3.id}`))) >= 1);
  check("antrenorul NU anulează", await errored(coach.rpc("void_contract", { p_id: c3.id, p_reason: "x" })));
  check("secretariatul anulează documentul refuzat", !(await errored(secretary.rpc("void_contract", { p_id: c3.id, p_reason: "Retrimis corectat" }))));
  const rem = await secretary.rpc("remind_contracts", { p_ids: [c1.id, c2.id, c3.id] });
  check("reamintirea merge doar la cele nesemnate", rem.data === 1, rem);
  check("a doua reamintire în aceeași zi nu pleacă", (await secretary.rpc("remind_contracts", { p_ids: [c1.id] })).data === 0);
  check("contabilul NU trimite reamintiri", await errored(accountant.rpc("remind_contracts", { p_ids: [c1.id] })));
  check("reamintirile automate sunt doar ale sarcinii programate", await errored(secretary.rpc("run_contract_reminders")));
  must(await admin.from("contracts").update({ last_reminded_at: new Date(Date.now() - 4 * 86400e3).toISOString() }).eq("id", c1.id).select("id"), "vechime");
  const auto = await admin.rpc("run_contract_reminders");
  check("sarcina programată reamintește după 3 zile", !auto.error && (auto.data as number) >= 1, auto);
  // -------------------------------------------------------------------------
  console.log("\nÎnscrieri");
  const anon = anonClient();
  const slugA = `perf-a-${run}`;
  const form = (over: Record<string, unknown> = {}) => ({ child_name: "Copil Nou", birth_date: "2014-05-06", parent_name: "Mama Copilului", parent_email: `mama-${run}@example.com`, parent_phone: "0722000111", consent: true, ...over });
  check("formularul public cere acordul", await errored(anon.rpc("submit_enrolment_request", { p_slug: slugA, p: form({ consent: false }), p_ip: "198.51.100.1" })));
  check("formularul public cere un contact", await errored(anon.rpc("submit_enrolment_request", { p_slug: slugA, p: form({ parent_email: "", parent_phone: "" }), p_ip: "198.51.100.1" })));
  const pubReq = await anon.rpc("submit_enrolment_request", { p_slug: slugA, p: form(), p_ip: "198.51.100.1" });
  check("vizitatorul fără cont trimite o cerere", !pubReq.error && pubReq.data === true, pubReq);
  check("vizitatorul NU citește cererile", (await rows(anon.from("enrolment_requests").select("id"))) === 0 || await errored(anon.from("enrolment_requests").select("id")));
  for (let i = 0; i < 5; i++) await anon.rpc("submit_enrolment_request", { p_slug: slugA, p: form({ child_name: `Copil Spam ${i}` }), p_ip: "198.51.100.2" });
  check("după 5 trimiteri pe oră de pe același IP, a șasea e oprită", await errored(anon.rpc("submit_enrolment_request", { p_slug: slugA, p: form({ child_name: "Copil Spam 5" }), p_ip: "198.51.100.2" }))
    && !(await errored(anon.rpc("submit_enrolment_request", { p_slug: slugA, p: form({ child_name: "Alt IP" }), p_ip: "198.51.100.3" }))));
  check("clubul inexistent e refuzat", await errored(anon.rpc("submit_enrolment_request", { p_slug: "nu-exista-" + run, p: form(), p_ip: "198.51.100.4" })));
  check("datele publice ale clubului nu conțin date personale", !JSON.stringify((await anon.rpc("public_club", { p_slug: slugA })).data).includes("@"));
  const req = must(await admin.from("enrolment_requests").select("id, group_id, status").eq("club_id", clubA).eq("child_name", "Copil Nou").single(), "cererea");
  check("cererea primește echipa după anul nașterii (sau niciuna)", req.status === "new");
  check("secretariatul vede cererea", (await rows(secretary.from("enrolment_requests").select("id").eq("id", req.id))) === 1);
  check("directorul sportiv vede cererea", (await rows(director.from("enrolment_requests").select("id").eq("id", req.id))) === 1);
  check("antrenorul NU vede cererile (date de contact)", (await rows(coach.from("enrolment_requests").select("id"))) === 0);
  check("contabilul NU vede cererile", (await rows(accountant.from("enrolment_requests").select("id"))) === 0);
  check("părintele NU vede cererile", (await rows(guardian.from("enrolment_requests").select("id"))) === 0);
  check("alt club NU vede cererea", (await rows(secretaryB.from("enrolment_requests").select("id"))) === 0);
  check("biroul este anunțat de cererea nouă", (await rows(admin.from("notifications").select("id").eq("dedupe_key", `enrolment:${req.id}`))) >= 2);
  const evStart = new Date(Date.now() + 3 * 86400e3).toISOString();
  const evId = must(await admin.from("events").insert({ club_id: clubA, kind: "training", title: "Antrenament U13", starts_at: evStart, ends_at: new Date(Date.parse(evStart) + 90 * 60e3).toISOString() }).select("id").single(), "antrenament").id;
  must(await admin.from("event_teams").insert({ event_id: evId, group_id: G1 }).select("event_id"), "echipa antrenamentului");
  const evOther = must(await admin.from("events").insert({ club_id: clubA, kind: "training", title: "Antrenament U15", starts_at: evStart, ends_at: new Date(Date.parse(evStart) + 90 * 60e3).toISOString() }).select("id").single(), "antrenament 2").id;
  must(await admin.from("event_teams").insert({ event_id: evOther, group_id: G2 }).select("event_id"), "echipa 2");
  check("antrenorul NU programează probe", await errored(coach.rpc("book_trial", { p_id: req.id, p_event: evId })));
  check("secretariatul programează proba pe antrenamentul U13", !(await errored(secretary.rpc("book_trial", { p_id: req.id, p_event: evId }))));
  check("antrenorul echipei e anunțat de probă", (await rows(admin.from("notifications").select("id").like("dedupe_key", `trial:${req.id}:%`))) === 1);
  const myTrials = (await coach.rpc("my_trials", { p_event: evId })).data as Array<Record<string, unknown>> | null;
  check("antrenorul vede proba, fără contactele familiei", myTrials?.length === 1 && !("parent_email" in myTrials[0]) && !("parent_phone" in myTrials[0]), myTrials);
  check("antrenorul notează proba echipei lui", !(await errored(coach.rpc("record_trial", { p_id: req.id, p_rating: 4, p_note: "Bun cu mingea" }))));
  must(await admin.from("enrolment_requests").update({ trial_event_id: evOther }).eq("id", req.id).select("id"), "mutare");
  check("antrenorul NU notează proba altei echipe", await errored(coach.rpc("record_trial", { p_id: req.id, p_rating: 2, p_note: "x" })));
  must(await admin.from("enrolment_requests").update({ trial_event_id: evId }).eq("id", req.id).select("id"), "înapoi");
  check("antrenorul NU înscrie", await errored(coach.rpc("enrol_request", { p_id: req.id, p: { group_id: G1 } })));
  check("înscrierea cere echipa clubului", await errored(secretary.rpc("enrol_request", { p_id: req.id, p: { group_id: H1 } })));
  must(await admin.from("fee_plans").insert({ club_id: clubA, group_id: G1, amount: 20000, valid_from: new Date().toISOString().slice(0, 7) + "-01" }).select("id"), "taxa U13");
  const en = await secretary.rpc("enrol_request", { p_id: req.id, p: { group_id: G1, first_month: true, enrol_fee: 5000 } });
  check("secretariatul înscrie: jucător, părinte plătitor, două taxe", !en.error && (en.data as { charges: number }).charges === 2, en);
  const newPlayer = (en.data as { player_id: string; guardian_id: string }).player_id;
  const pl = must(await admin.from("players").select("full_name, display_name, group_id, enrolled_on").eq("id", newPlayer).single(), "jucătorul");
  check("jucătorul are numele, echipa și numele scurt", pl.full_name === "Copil Nou" && pl.group_id === G1 && pl.display_name === "COPIL N.", pl);
  const gp = must(await admin.from("guardian_players").select("is_billing, guardians(email)").eq("player_id", newPlayer), "legătura");
  check("părintele e legat ca plătitor", gp.length === 1 && gp[0].is_billing && (gp[0].guardians as { email: string }).email === `mama-${run}@example.com`);
  check("cererea înscrisă nu se mai înscrie o dată", await errored(secretary.rpc("enrol_request", { p_id: req.id, p: { group_id: G1 } })));
  const sib = await secretary.rpc("create_enrolment_request", { p: form({ child_name: "Frate Nou", birth_date: "2016-02-02" }) });
  check("biroul adaugă o cerere primită la telefon", !sib.error, sib);
  const en2 = await secretary.rpc("enrol_request", { p_id: sib.data, p: { group_id: G2, first_month: false, enrol_fee: 0 } });
  check("fratele cu aceeași adresă intră în aceeași familie", !en2.error && (en2.data as { guardian_id: string }).guardian_id === (en.data as { guardian_id: string }).guardian_id, en2);
  const dec = await secretary.rpc("create_enrolment_request", { p: form({ child_name: "Refuzat Nou" }) });
  check("cererea se refuză și se redeschide", !(await errored(secretary.rpc("decline_enrolment", { p_id: dec.data, p_reason: "Lot complet", p_withdrawn: false })))
    && !(await errored(secretary.rpc("reopen_enrolment", { p_id: dec.data }))));
  check("istoricul păstrează pașii", (await rows(secretary.from("enrolment_events").select("id").eq("request_id", dec.data))) === 3);
  check("antrenorul NU vede istoricul", (await rows(coach.from("enrolment_events").select("id"))) === 0);
  check("ștergerea automată e doar a sarcinii programate", await errored(secretary.rpc("purge_enrolment_requests")));
  check("părintele își trece mărimea echipamentului copilului", !(await errored(guardian.rpc("set_kit_size", { p_player: p3, p_size: "140" })))
    && (await admin.from("players").select("kit_size").eq("id", p3).single()).data?.kit_size === "140");
  check("părintele NU schimbă mărimea altui copil", await errored(guardian.rpc("set_kit_size", { p_player: p2, p_size: "152" })));
  // -------------------------------------------------------------------------
  console.log("\nTabere");
  const campBody = { title: "Tabăra de iarnă", starts_on: day(30), ends_on: day(34), price: 30000, capacity: 2, birth_year_from: 2011, birth_year_to: 2013, status: "open", is_public: true };
  check("antrenorul NU organizează tabere", await errored(coach.rpc("save_camp", { p: campBody })));
  check("contabilul NU organizează tabere", await errored(accountant.rpc("save_camp", { p: campBody })));
  const campRes = await secretary.rpc("save_camp", { p: campBody });
  check("secretariatul creează tabăra", !campRes.error, campRes);
  const campId = campRes.data as string;
  const draft = (await secretary.rpc("save_camp", { p: { ...campBody, title: "Ciornă", status: "draft" } })).data as string;
  check("părintele vede tabăra deschisă, nu și ciorna", (await rows(guardian.from("camps").select("id").eq("id", campId))) === 1 && (await rows(guardian.from("camps").select("id").eq("id", draft))) === 0);
  check("părintele NU înscrie copilul altcuiva", await errored(guardian.rpc("register_camp", { p_camp: campId, p_player: p2 })));
  check("jucătorul minor NU se înscrie singur", await errored(player1.rpc("register_camp", { p_camp: campId, p_player: p1 })));
  const r3 = await guardian.rpc("register_camp", { p_camp: campId, p_player: p3, p_notes: "Alergic la arahide" });
  check("părintele înscrie copilul: loc confirmat", r3.data === "confirmed", r3);
  const reg3 = must(await admin.from("camp_registrations").select("id, charge_id").eq("camp_id", campId).eq("player_id", p3).single(), "înscrierea 3");
  const ch3 = must(await admin.from("charges").select("kind, amount, guardian_id, status").eq("id", reg3.charge_id!).single(), "taxa 3");
  check("taxa taberei intră în registrul familiei", ch3.kind === "camp" && ch3.amount === 30000 && ch3.guardian_id === gId && ch3.status === "open", ch3);
  check("a doua înscriere a aceluiași copil e refuzată", await errored(guardian.rpc("register_camp", { p_camp: campId, p_player: p3 })));
  check("al doilea părinte ocupă ultimul loc", (await guardian2.rpc("register_camp", { p_camp: campId, p_player: p2 })).data === "confirmed");
  check("biroul înscrie un al treilea: listă de așteptare", (await secretary.rpc("register_camp", { p_camp: campId, p_player: p1 })).data === "waitlist");
  check("părintele vede doar înscrierea lui (cu nota)", (await rows(guardian.from("camp_registrations").select("id"))) === 1
    && (await guardian.from("camp_registrations").select("notes").single()).data?.notes === "Alergic la arahide");
  check("antrenorul NU vede înscrierile (note medicale)", (await rows(coach.from("camp_registrations").select("id"))) === 0);
  check("contabilul NU vede înscrierile", (await rows(accountant.from("camp_registrations").select("id"))) === 0);
  check("alt club NU vede taberele", (await rows(secretaryB.from("camps").select("id"))) === 0);
  check("vizitatorul vede tabăra publică fără nume", ((await anon.rpc("public_camps", { p_slug: slugA })).data as Array<{ spots_left: number }>)?.[0]?.spots_left === 0);
  check("vizitatorul NU citește înscrierile", (await rows(anon.from("camp_registrations").select("id"))) === 0 || await errored(anon.from("camp_registrations").select("id")));
  check("de pe site: vârsta din afara intervalului e refuzată", await errored(anon.rpc("submit_camp_registration", { p_slug: slugA, p_camp: campId, p: { child_name: "Copil Mare", birth_date: "2005-01-01", parent_name: "Părinte X", parent_phone: "0700000000", consent: true }, p_ip: "198.51.100.20" })));
  const pubCamp = await anon.rpc("submit_camp_registration", { p_slug: slugA, p_camp: campId, p: { child_name: "Copil Din Oraș", birth_date: "2012-06-01", parent_name: "Părinte Oraș", parent_phone: "0711222333", consent: true }, p_ip: "198.51.100.20" });
  check("de pe site: înscrierea așteaptă confirmarea", !pubCamp.error, pubCamp);
  check("de pe site: tabăra ciornă nu primește înscrieri", await errored(anon.rpc("submit_camp_registration", { p_slug: slugA, p_camp: draft, p: { child_name: "Copil Ciornă", birth_date: "2012-06-01", parent_name: "Părinte X", parent_phone: "0711222333", consent: true }, p_ip: "198.51.100.21" })));
  const pubReg = must(await admin.from("camp_registrations").select("id, status").eq("camp_id", campId).eq("child_name", "Copil Din Oraș").single(), "înscrierea publică");
  check("biroul NU confirmă peste numărul de locuri", pubReg.status === "pending" && await errored(secretary.rpc("confirm_camp_registration", { p_id: pubReg.id })));
  check("locurile nu scad sub cele confirmate", await errored(secretary.rpc("save_camp", { p: { ...campBody, id: campId, capacity: 1 } })));
  check("prețul nu se schimbă după confirmări", await errored(secretary.rpc("save_camp", { p: { ...campBody, id: campId, price: 1 } })));
  check("alt părinte NU anulează înscrierea", await errored(guardian2.rpc("cancel_camp_registration", { p_id: reg3.id })));
  check("părintele renunță înainte de tabără", !(await errored(guardian.rpc("cancel_camp_registration", { p_id: reg3.id, p_reason: "Plecăm în vacanță" }))));
  check("taxa neplătită se anulează", (await admin.from("charges").select("status").eq("id", reg3.charge_id!).single()).data?.status === "cancelled");
  const promoted = must(await admin.from("camp_registrations").select("status, charge_id").eq("camp_id", campId).eq("player_id", p1).single(), "promovat");
  check("primul de pe lista de așteptare urcă, cu taxa lui", promoted.status === "confirmed" && !!promoted.charge_id, promoted);
  check("plata directă nu se marchează pe o înscriere cu taxă în registru", await errored(secretary.rpc("set_camp_paid", { p_id: reg3.id, p_paid: true })));
  check("plata directă se marchează pe înscrierea de pe site", !(await errored(secretary.rpc("set_camp_paid", { p_id: pubReg.id, p_paid: true, p_note: "numerar" }))));
  check("curățarea datelor e doar a sarcinii programate", await errored(secretary.rpc("purge_camp_data")));
  // -------------------------------------------------------------------------
  console.log("\nSite și știri");
  const blocks = [{ type: "paragraph", text: "Echipa U13 a câștigat turneul." }, { type: "script", text: "<x>" }, { type: "image", path: `${clubB}/post/x.jpg` }, { type: "image", path: `${clubA}/post/ok.jpg`, alt: "Echipa" }];
  check("antrenorul NU publică știri", await errored(coach.rpc("save_site_post", { p: { title: "Victorie", blocks } })));
  const postRes = await secretary.rpc("save_site_post", { p: { title: "Victorie la turneu!", blocks, to_site: true, to_app: true, app_group_ids: [G1] } });
  check("secretariatul scrie o știre", !postRes.error, postRes);
  const postId = postRes.data as string;
  const saved = must(await admin.from("site_posts").select("slug, blocks, status").eq("id", postId).single(), "știrea");
  check("blocurile necunoscute și imaginile altui club se aruncă", (saved.blocks as unknown[]).length === 2 && saved.slug === "victorie-la-turneu", saved);
  check("ciorna nu e vizibilă familiilor", (await rows(guardian2.from("site_posts").select("id").eq("id", postId))) === 0);
  check("ciorna nu e pe site", ((await anon.rpc("public_posts", { p_slug: slugA })).data as unknown[]).length === 0);
  const pubN = await secretary.rpc("publish_site_post", { p_id: postId, p_publish: true });
  check("publicarea anunță familiile echipei", !pubN.error && (pubN.data as number) >= 1, pubN);
  check("părintele din echipă primește notificarea", (await rows(admin.from("notifications").select("id").eq("user_id", uGuardian2).eq("dedupe_key", `news:${postId}`))) === 1);
  check("părintele altei echipe nu e anunțat și nu vede știrea", (await rows(admin.from("notifications").select("id").eq("user_id", uGuardian).eq("dedupe_key", `news:${postId}`))) === 0
    && (await rows(guardian.from("site_posts").select("id").eq("id", postId))) === 0);
  check("părintele din echipă vede știrea", (await rows(guardian2.from("site_posts").select("id").eq("id", postId))) === 1);
  check("republicarea nu mai trimite notificări", (await secretary.rpc("publish_site_post", { p_id: postId, p_publish: true })).data === 0);
  check("vizitatorul vede știrea pe site, cu rezumat", ((await anon.rpc("public_posts", { p_slug: slugA })).data as Array<{ excerpt: string }>)?.[0]?.excerpt === "Echipa U13 a câștigat turneul.");
  check("imaginea știrii se servește public", (await anon.rpc("site_public_file", { p_slug: slugA, p_path: `${clubA}/post/ok.jpg` })).data === true);
  check("o imagine nefolosită NU se servește public", (await anon.rpc("site_public_file", { p_slug: slugA, p_path: `${clubA}/post/alta.jpg` })).data === false);
  check("părintele din echipă citește imaginea în aplicație", await access(guardian2, "site", `${clubA}/post/ok.jpg`, "read"));
  check("părintele NU încarcă fișiere pe site", !(await access(guardian2, "site", `${clubA}/post/nou.jpg`, "write")));
  check("secretariatul încarcă fișiere pe site", await access(secretary, "site", `${clubA}/post/nou.jpg`, "write"));
  check("alt club NU vede știrea", (await rows(secretaryB.from("site_posts").select("id"))) === 0);
  // galerie și acord foto (acordul lui DOI vine mai jos; îl pornise deja semnarea din secțiunea Contracte)
  check("acordul semnat la Contracte e pe fișă", (await admin.from("players").select("photo_consent").eq("id", p2).single()).data?.photo_consent === true);
  must(await admin.from("players").update({ photo_consent: false }).eq("id", p2).select("id"), "acord oprit");
  const album = (await secretary.rpc("save_album", { p: { title: "Turneu", taken_on: day(-1) } })).data as string;
  const ph1 = (await secretary.rpc("save_photo", { p: { album_id: album, path: `${clubA}/foto/a.jpg`, player_ids: [p2] } })).data as string;
  const ph2 = (await secretary.rpc("save_photo", { p: { album_id: album, path: `${clubA}/foto/b.jpg`, player_ids: [] } })).data as string;
  check("fotografia cu cale greșită e refuzată", await errored(secretary.rpc("save_photo", { p: { album_id: album, path: `${clubB}/foto/c.jpg` } })));
  check("albumul nepublicat nu e pe site", ((await anon.rpc("public_albums", { p_slug: slugA })).data as unknown[]).length === 0);
  await secretary.rpc("save_album", { p: { id: album, title: "Turneu", taken_on: day(-1), status: "published" } });
  const pubPhotos = () => anon.rpc("public_album", { p_slug: slugA, p_album: album }).then((r) => ((r.data ?? []) as Array<{ path: string }>).map((x) => x.path));
  check("fotografia cu un copil fără acord rămâne ascunsă", !(await pubPhotos()).includes(`${clubA}/foto/a.jpg`) && (await pubPhotos()).includes(`${clubA}/foto/b.jpg`));
  check("fișierul ascuns nu se servește public", (await anon.rpc("site_public_file", { p_slug: slugA, p_path: `${clubA}/foto/a.jpg` })).data === false);
  // acordul vine din semnarea documentului de tip „Fotografii și video"
  const tplPhoto = (await secretary.rpc("save_contract_template", { p: { name: "Acord foto sezon", kind: "photo_consent", body: "Acordul lui {{parinte}} pentru {{jucator}}, sezonul {{sezon}}." } })).data as string;
  await secretary.rpc("send_contracts", { p_template: tplPhoto, p_players: [p2] });
  const cPhoto = must(await admin.from("contracts").select("id").eq("player_id", p2).eq("title", "Acord foto sezon").single(), "contract foto");
  const sigPhoto = `${clubA}/${cPhoto.id}/semnatura-${crypto.randomUUID()}.png`;
  await guardian2.rpc("sign_contract", { p_id: cPhoto.id, p_name: "Părinte Doi", p_signature_path: sigPhoto });
  check("semnarea acordului foto îl pornește pe fișă", (await admin.from("players").select("photo_consent").eq("id", p2).single()).data?.photo_consent === true);
  check("după acord, fotografia devine publică", (await pubPhotos()).includes(`${clubA}/foto/a.jpg`));
  check("datele publice ale albumului nu conțin nume de copii", !JSON.stringify((await anon.rpc("public_album", { p_slug: slugA, p_album: album })).data).includes("DOI"));
  check("alt părinte NU retrage acordul copilului altcuiva", await errored(guardian.rpc("withdraw_photo_consent", { p_player: p2 })));
  check("părintele retrage acordul", !(await errored(guardian2.rpc("withdraw_photo_consent", { p_player: p2 }))));
  check("retragerea ascunde imediat fotografia", !(await pubPhotos()).includes(`${clubA}/foto/a.jpg`));
  check("părintele NU vede albumele din birou", (await rows(guardian2.from("site_photos").select("id"))) === 0);
  void ph1; void ph2;
  // setări și politică
  check("antrenorul NU schimbă setările site-ului", await errored(coach.rpc("save_site_settings", { p: { news: false } })));
  const st = await secretary.rpc("save_site_settings", { p: { news: false, tagline: "Din 1990", facebook: "https://facebook.com/club", hacker: "x", roster_groups: [G1, H1] } });
  check("setările se salvează și intră în jurnal", !st.error && st.data === 4, st);
  const site = (await admin.from("clubs").select("settings").eq("id", clubA).single()).data?.settings as { site: Record<string, unknown> };
  check("cheile necunoscute și echipele altui club se ignoră", !("hacker" in site.site) && JSON.stringify(site.site.roster_groups) === JSON.stringify([G1]));
  check("adresele fără https sunt refuzate", await errored(secretary.rpc("save_site_settings", { p: { instagram: "http://x" } })));
  const teams = (await anon.rpc("public_teams", { p_slug: slugA })).data as Array<{ id: string; roster: unknown[] }>;
  check("lotul public nu conține copii (toți jucătorii U13 sunt minori)", teams.find((x) => x.id === G1)?.roster.length === 0);
  check("politica de confidențialitate are versiuni", (await secretary.rpc("publish_site_policy", { p_body: "x".repeat(60) })).data === 1
    && (await secretary.rpc("publish_site_policy", { p_body: "y".repeat(60) })).data === 2
    && ((await anon.rpc("public_policy", { p_slug: slugA })).data as Array<{ version: number }>)[0].version === 2);
  check("politica neschimbată nu face versiune nouă", await errored(secretary.rpc("publish_site_policy", { p_body: "y".repeat(60) })));
  check("ștergerea știrii scoate și notificările", !(await errored(secretary.rpc("delete_site_post", { p_id: postId })))
    && (await rows(admin.from("notifications").select("id").eq("dedupe_key", `news:${postId}`))) === 0);
  // -------------------------------------------------------------------------
  console.log("\nMagazin");
  const jersey = { name: "Tricou de joc", category: "kit", price: 12000, kind: "item", size_kind: "apparel", is_active: true, variants: [{ size: "140", stock: 2 }, { size: "152", stock: 1 }] };
  check("antrenorul NU administrează magazinul", await errored(coach.rpc("save_product", { p: jersey })));
  const jId = (await accountant.rpc("save_product", { p: jersey })).data as string;
  check("contabilul adaugă un produs cu mărimi", !!jId && (await rows(admin.from("shop_variants").select("id").eq("product_id", jId))) === 2);
  const shorts = (await secretary.rpc("save_product", { p: { ...jersey, name: "Șort de joc", price: 6000, variants: [{ size: "140", stock: 5 }] } })).data as string;
  const kitB = await secretary.rpc("save_product", { p: { name: "Pachet echipament", category: "kit", price: 15000, kind: "bundle", size_kind: "none", bundle_items: [jId, shorts] } });
  check("secretariatul face un pachet", !kitB.error, kitB);
  check("pachetul fără produse e refuzat", await errored(secretary.rpc("save_product", { p: { name: "Pachet gol", price: 100, kind: "bundle", size_kind: "none", bundle_items: [] } })));
  const hidden = (await secretary.rpc("save_product", { p: { ...jersey, name: "Ascuns", is_active: false } })).data as string;
  check("familia vede catalogul activ, nu și produsele ascunse", (await rows(guardian.from("shop_products").select("id").eq("id", jId))) === 1 && (await rows(guardian.from("shop_products").select("id").eq("id", hidden))) === 0);
  const v140 = must(await admin.from("shop_variants").select("id").eq("product_id", jId).eq("size", "140").single(), "140").id;
  const v152 = must(await admin.from("shop_variants").select("id").eq("product_id", jId).eq("size", "152").single(), "152").id;
  const s140 = must(await admin.from("shop_variants").select("id").eq("product_id", shorts).eq("size", "140").single(), "șort").id;
  check("părintele NU comandă pentru copilul altcuiva", await errored(guardian.rpc("place_order", { p_player: p2, p_items: [{ product_id: jId, variant_id: v140, qty: 1 }] })));
  check("jucătorul minor NU comandă singur", await errored(player1.rpc("place_order", { p_player: p1, p_items: [{ product_id: jId, variant_id: v140, qty: 1 }] })));
  check("nu se comandă peste stoc", await errored(guardian.rpc("place_order", { p_player: p3, p_items: [{ product_id: jId, variant_id: v152, qty: 2 }] })));
  check("produsul ascuns nu se comandă", await errored(guardian.rpc("place_order", { p_player: p3, p_items: [{ product_id: hidden, variant_id: v140, qty: 1 }] })));
  check("pachetul cere mărime pentru fiecare produs", await errored(guardian.rpc("place_order", { p_player: p3, p_items: [{ product_id: kitB.data, qty: 1, components: [{ product_id: jId, variant_id: v140 }] }] })));
  const ord = await guardian.rpc("place_order", { p_player: p3, p_items: [{ product_id: jId, variant_id: v152, qty: 1 }, { product_id: kitB.data, qty: 1, components: [{ product_id: jId, variant_id: v140 }, { product_id: shorts, variant_id: s140 }] }], p_note: "Mulțumim" });
  check("părintele comandă tricou și pachet", !ord.error && (ord.data as { total: number }).total === 27000, ord);
  const ordId = (ord.data as { id: string }).id;
  const stock = async (id: string) => (await admin.from("shop_variants").select("stock").eq("id", id).single()).data?.stock;
  check("stocul scade pe fiecare mărime", (await stock(v152)) === 0 && (await stock(v140)) === 1 && (await stock(s140)) === 4);
  const och = must(await admin.from("shop_orders").select("charge_id, guardian_id, number").eq("id", ordId).single(), "comanda");
  const oc = must(await admin.from("charges").select("kind, amount, guardian_id").eq("id", och.charge_id!).single(), "taxa comenzii");
  check("suma intră în registrul familiei", oc.kind === "equipment" && oc.amount === 27000 && oc.guardian_id === gId, oc);
  check("părintele își vede comanda și produsele", (await rows(guardian.from("shop_orders").select("id"))) === 1 && (await rows(guardian.from("shop_order_items").select("id").eq("order_id", ordId))) === 4);
  check("alt părinte NU vede comanda", (await rows(guardian2.from("shop_orders").select("id"))) === 0 && (await rows(guardian2.from("shop_order_items").select("id"))) === 0);
  check("antrenorul NU vede comenzile", (await rows(coach.from("shop_orders").select("id"))) === 0);
  check("contabilul vede comenzile și jurnalul de stoc", (await rows(accountant.from("shop_orders").select("id"))) === 1 && (await rows(accountant.from("shop_stock_moves").select("id").eq("order_id", ordId))) === 3);
  check("părintele NU vede jurnalul de stoc", (await rows(guardian.from("shop_stock_moves").select("id"))) === 0);
  check("părintele NU marchează comanda gata", await errored(guardian.rpc("set_order_status", { p_id: ordId, p_status: "ready" })));
  check("biroul marchează comanda gata, familia e anunțată", !(await errored(secretary.rpc("set_order_status", { p_id: ordId, p_status: "ready" })))
    && (await rows(admin.from("notifications").select("id").eq("user_id", uGuardian).eq("dedupe_key", `shop_ready:${ordId}`))) === 1);
  check("familia NU anulează comanda pregătită", await errored(guardian.rpc("cancel_order", { p_id: ordId })));
  check("biroul anulează: stocul revine, taxa se anulează", !(await errored(secretary.rpc("cancel_order", { p_id: ordId, p_reason: "test" })))
    && (await stock(v152)) === 1 && (await stock(v140)) === 2 && (await stock(s140)) === 5
    && (await admin.from("charges").select("status").eq("id", och.charge_id!).single()).data?.status === "cancelled");
  const ord2 = (await guardian.rpc("place_order", { p_player: p3, p_items: [{ product_id: jId, variant_id: v140, qty: 1 }] })).data as { id: string; number: number };
  check("numerele comenzilor cresc", ord2.number === och.number + 1);
  check("familia își anulează comanda nouă", !(await errored(guardian.rpc("cancel_order", { p_id: ord2.id }))));
  check("stocul modificat de birou intră în jurnal", !(await errored(secretary.rpc("save_product", { p: { ...jersey, id: jId, variants: [{ size: "140", stock: 10 }, { size: "152", stock: 1 }] } })))
    && (await rows(admin.from("shop_stock_moves").select("id").eq("variant_id", v140).eq("reason", "restock"))) >= 2);
  check("fotografiile produselor: le vede clubul, le încarcă doar biroul", await access(guardian, "shop", `${clubA}/x.jpg`, "read") && !(await access(guardian, "shop", `${clubA}/x.jpg`, "write")) && await access(accountant, "shop", `${clubA}/x.jpg`, "write"));
  check("alt club NU vede produsele", (await rows(secretaryB.from("shop_products").select("id"))) === 0);
  // -------------------------------------------------------------------------
  console.log("\nSuporteri");
  const pledge = (over: Record<string, unknown> = {}) => (anon.rpc("record_support_pledge", { p_slug: slugA, p: { full_name: "Ion Popescu", email: "ion@example.com", phone: "0722111222", two_years: true, keep_contact: false, ...over }, p_ip: "198.51.100.30" }));
  check("fără campanie, formularul de pe site e închis", await errored(pledge()));
  check("antrenorul NU creează campanii", await errored(coach.rpc("save_campaign", { p: { income_year: 2025, title: "Campania 2025" } })));
  const camp = await accountant.rpc("save_campaign", { p: { income_year: 2025, title: "Campania 2025", goal: 100, deadline: "2026-05-25" } });
  check("contabilul creează campania", !camp.error, camp);
  must(await admin.from("finance_settings").update({ fiscal_code: null, iban: null }).eq("club_id", clubA).select("club_id"), "fără date fiscale");
  check("fără CIF și IBAN, formularul nu se generează", await errored(pledge()));
  must(await admin.from("finance_settings").update({ fiscal_code: "RO12345678", iban: "RO49AAAA1B31007593840000", beneficiary: "Asociația Perf A" }).eq("club_id", clubA).select("club_id"), "date fiscale");
  const pl230 = await pledge();
  check("vizitatorul primește datele entității pentru PDF", !pl230.error && (pl230.data as { fiscal_code: string }).fiscal_code === "RO12345678" && (pl230.data as { name: string }).name === "Asociația Perf A", pl230);
  const stored = must(await admin.from("support_pledges").select("full_name, email, phone, status").eq("club_id", clubA).single(), "formular");
  check("fără acord, contactul nu se păstrează (și nici CNP-ul: tabela nu are coloane pentru el)", stored.email === null && stored.phone === null && stored.status === "started", stored);
  await pledge({ full_name: "Maria Ionescu", keep_contact: true });
  check("cu acord, contactul se păstrează", (await admin.from("support_pledges").select("email").eq("full_name", "Maria Ionescu").single()).data?.email === "ion@example.com");
  check("biroul e anunțat (o dată pe zi)", (await rows(admin.from("notifications").select("id").like("dedupe_key", `support230:${camp.data}:%`))) >= 1);
  check("secretariatul vede formularele", (await rows(secretary.from("support_pledges").select("id"))) === 2);
  check("antrenorul și părintele NU văd formularele", (await rows(coach.from("support_pledges").select("id"))) === 0 && (await rows(guardian.from("support_pledges").select("id"))) === 0);
  check("vizitatorul NU citește formularele", (await rows(anon.from("support_pledges").select("id"))) === 0 || await errored(anon.from("support_pledges").select("id")));
  const ids = ((await secretary.from("support_pledges").select("id")).data ?? []).map((x) => x.id);
  check("biroul marchează formularele depuse", (await secretary.rpc("set_pledges_status", { p_ids: ids, p_status: "submitted" })).data === 2);
  check("biroul adaugă un formular primit pe hârtie", !(await errored(secretary.rpc("save_pledge", { p: { full_name: "Vasile Pop", status: "received" } }))));
  check("antrenorul NU adaugă sponsori", await errored(coach.rpc("save_sponsor", { p: { name: "Firma X" } })));
  const sp1 = (await secretary.rpc("save_sponsor", { p: { name: "Firma Semnată", status: "signed", show_on_site: true, logo_path: `${clubA}/sponsor/a.png`, amount: 500000 } })).data as string;
  await secretary.rpc("save_sponsor", { p: { name: "Firma În Discuții", status: "negotiating", show_on_site: true, logo_path: `${clubA}/sponsor/b.png` } });
  await secretary.rpc("save_sponsor", { p: { name: "Firma Ascunsă", status: "paid", show_on_site: false } });
  const ps = (await anon.rpc("public_support", { p_slug: slugA })).data as { sponsors: Array<{ name: string }> };
  check("pe site apar doar sponsorii cu contract și cu acordul afișării", ps.sponsors.length === 1 && ps.sponsors[0].name === "Firma Semnată", ps);
  check("datele publice nu conțin sumele sau contactele", !JSON.stringify(ps).includes("500000"));
  check("sigla sponsorului afișat se servește public; a celorlalți nu", (await anon.rpc("site_public_file", { p_slug: slugA, p_path: `${clubA}/sponsor/a.png` })).data === true
    && (await anon.rpc("site_public_file", { p_slug: slugA, p_path: `${clubA}/sponsor/b.png` })).data === false);
  check("contabilul încarcă sigle; antrenorul nu", await access(accountant, "site", `${clubA}/sponsor/c.png`, "write") && !(await access(coach, "site", `${clubA}/sponsor/c.png`, "write")));
  check("părintele NU vede sponsorii (sume, contacte)", (await rows(guardian.from("sponsors").select("id"))) === 0);
  check("sponsorul se șterge", !(await errored(secretary.rpc("delete_sponsor", { p_id: sp1 }))));
  check("alt club NU vede campaniile", (await rows(secretaryB.from("support_campaigns").select("id"))) === 0);
  void adminU; void player1;
} finally {
  await cleanup();
  await closePool();
}

console.log(`\n${passed} verificări trecute, ${failures.length} eșuate.`);
if (failures.length) process.exit(1);
