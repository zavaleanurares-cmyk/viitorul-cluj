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
  void adminU; void player1;
} finally {
  await cleanup();
  await closePool();
}

console.log(`\n${passed} verificări trecute, ${failures.length} eșuate.`);
if (failures.length) process.exit(1);
