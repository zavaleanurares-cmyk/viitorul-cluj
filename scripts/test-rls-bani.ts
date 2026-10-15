/**
 * Test de acces și de corectitudine pentru Locker Room faza 3 (Bani).
 *
 *   npx tsx scripts/test-rls-bani.ts
 *
 * Creează două cluburi temporare, rulează verificările și șterge tot. Nu atinge cluburile reale.
 */
import crypto from "node:crypto";
import { closePool, deleteUser, ensureAccount, must, randomPassword, serviceClient, userClient } from "./lib";

const admin = serviceClient();
const run = crypto.randomBytes(3).toString("hex");
const pw = randomPassword();
const mail = (k: string) => `bani-${run}-${k}@example.com`;

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
  const { data: stale } = await admin.from("clubs").select("id").like("slug", "bani-%");
  for (const c of stale ?? []) {
    const { data: us } = await admin.from("profiles").select("id").eq("club_id", c.id);
    await admin.from("clubs").delete().eq("id", c.id);
    for (const u of us ?? []) await deleteUser(u.id);
  }
}

const OCT = "2026-10-01";
const lei = (n: number) => n * 100;

try {
  const clubA = must(await admin.rpc("setup_club", { p_slug: `bani-a-${run}`, p_name: "Bani A", p_short_name: "A", p_groups: ["U13", "U15"], p_settings: {} }), "club A");
  const clubB = must(await admin.rpc("setup_club", { p_slug: `bani-b-${run}`, p_name: "Bani B", p_short_name: "B", p_groups: ["U11"], p_settings: {} }), "club B");
  clubIds.push(clubA, clubB);
  const [G1, G2] = must(await admin.from("groups").select("id").eq("club_id", clubA).order("sort"), "grupe").map((g) => g.id);
  const H1 = must(await admin.from("groups").select("id").eq("club_id", clubB).single(), "grupa B").id;
  await admin.from("groups").update({ players_on_pitch: 11, half_minutes: 35 }).in("id", [G1, G2]);

  const visa = new Date(Date.now() + 200 * 86400000).toISOString().slice(0, 10);
  const mkPlayer = async (club: string, group: string, name: string, birth: string) =>
    must(await admin.from("players").insert({ club_id: club, group_id: group, full_name: name, display_name: name, birth_date: birth, medical_visa_expires_on: visa }).select("id").single(), name).id;
  const p1 = await mkPlayer(clubA, G1, "MARE", "2012-01-01");
  const p2 = await mkPlayer(clubA, G1, "MIC", "2013-05-05");
  const p3 = await mkPlayer(clubA, G2, "ALTUL", "2011-02-02");
  const pB = await mkPlayer(clubB, H1, "ALTCLUB", "2014-02-02");

  const acc = async (k: string, role: Parameters<typeof ensureAccount>[1]["role"], club: string, extra: { group_ids?: string[]; player_id?: string } = {}) => {
    const id = await ensureAccount(admin, { email: mail(k), password: pw, full_name: k, role, club_id: club, ...extra });
    userIds.push(id);
    return id;
  };
  await acc("admin", "admin", clubA);
  await acc("secretary", "secretary", clubA);
  await acc("accountant", "accountant", clubA);
  await acc("coach", "coach", clubA, { group_ids: [G1] });
  await acc("owner", "owner", clubA);
  await acc("director", "sporting_director", clubA);
  const uGA = await acc("parintea", "guardian", clubA);
  const uGB = await acc("parinteb", "guardian", clubA);
  await acc("secretaryb", "secretary", clubB);
  const gA = must(await admin.from("guardians").insert({ club_id: clubA, full_name: "Familia Mare", user_id: uGA }).select("id, payment_ref").single(), "părinte A");
  const gB = must(await admin.from("guardians").insert({ club_id: clubA, full_name: "Familia Altul", user_id: uGB }).select("id, payment_ref").single(), "părinte B");
  must(await admin.from("guardian_players").insert([
    { guardian_id: gA.id, player_id: p1, is_billing: true },
    { guardian_id: gA.id, player_id: p2, is_billing: true },
    { guardian_id: gB.id, player_id: p3, is_billing: true },
  ]).select("guardian_id"), "legături");

  const [adminU, secretary, accountant, coach, owner, director, parentA, parentB, secretaryB] = await Promise.all(
    ["admin", "secretary", "accountant", "coach", "owner", "director", "parintea", "parinteb", "secretaryb"].map((k) => userClient(mail(k))));

  // -------------------------------------------------------------------------
  console.log("\nSetări și coduri de plată");
  check("fiecare familie primește un cod de plată", /^LR-\d{4}$/.test(gA.payment_ref ?? "") && gA.payment_ref !== gB.payment_ref, [gA, gB]);
  check("plata online e oprită până o pornește biroul", (await rows(admin.from("finance_settings").select("club_id").eq("club_id", clubA).eq("online_enabled", false))) === 1);
  check("contabilul schimbă IBAN-ul", !(await errored(accountant.from("finance_settings").update({ iban: "RO49AAAA1B31007593840000", sibling_discount_pct: 50, online_enabled: true }).eq("club_id", clubA).select("club_id"))));
  check("contabilul NU schimbă cine aprobă referatele", await errored(accountant.from("finance_settings").update({ approver_roles: ["accountant"] }).eq("club_id", clubA).select("club_id"))
    && await errored(accountant.rpc("set_approver_roles", { p_roles: ["accountant"] })));
  check("secretariatul NU schimbă setările financiare", (await rows(secretary.from("finance_settings").update({ iban: "RO49AAAA1B31007593840001" }).eq("club_id", clubA).select("club_id"))) === 0);
  const info = must(await parentA.rpc("family_payment_info"), "info părinte") as { iban: string; refs: Array<{ ref: string }> };
  check("părintele vede IBAN-ul și codul lui", info.iban === "RO49AAAA1B31007593840000" && info.refs.length === 1 && info.refs[0].ref === gA.payment_ref, info);
  check("antrenorul NU vede setările financiare", (await rows(coach.from("finance_settings").select("club_id"))) === 0);

  // -------------------------------------------------------------------------
  console.log("\nTaxe lunare");
  must(await accountant.from("fee_plans").insert({ club_id: clubA, group_id: G1, amount: lei(450), valid_from: "2026-09-01" }).select("id"), "plan U13");
  must(await accountant.from("fee_plans").insert({ club_id: clubA, group_id: G2, amount: lei(300), valid_from: "2026-09-01" }).select("id"), "plan U15");
  must(await accountant.from("fee_plans").insert({ club_id: clubA, player_id: p3, amount: lei(250), valid_from: "2026-10-01" }).select("id"), "plan individual");
  must(await accountant.from("fee_adjustments").insert({ club_id: clubA, player_id: p3, kind: "percent", value: 20, reason: "scholarship", from_month: "2026-10-01" }).select("id"), "bursă");
  check("antrenorul NU creează planuri de taxă", await errored(coach.from("fee_plans").insert({ club_id: clubA, group_id: G1, amount: 1, valid_from: "2026-10-01" })));
  check("antrenorul NU emite taxe", await errored(coach.rpc("issue_monthly_charges", { p_period: OCT })));
  const issued = must(await accountant.rpc("issue_monthly_charges", { p_period: OCT }), "emitere") as { created: number; total: number };
  check("se emit 3 taxe", issued.created === 3, issued);
  const ch = must(await admin.from("charges").select("id, player_id, amount, discount, discount_note, due_on, guardian_id").eq("club_id", clubA).eq("kind", "monthly"), "taxe");
  const byP = (id: string) => ch.find((c) => c.player_id === id)!;
  check("primul copil plătește taxa întreagă", byP(p1).amount === lei(450) && byP(p1).discount === 0, byP(p1));
  check("al doilea copil primește reducerea de frați (50%)", byP(p2).discount === lei(225), byP(p2));
  check("planul individual bate planul echipei, cu bursa aplicată", byP(p3).amount === lei(250) && byP(p3).discount === lei(50), byP(p3));
  check("scadența e ziua setată (10)", byP(p1).due_on === "2026-10-10" && byP(p1).guardian_id === gA.id, byP(p1));
  const again = must(await accountant.rpc("issue_monthly_charges", { p_period: OCT }), "a doua emitere") as { created: number };
  check("a doua emitere nu dublează", again.created === 0, again);
  check("părintele primește un singur anunț pentru doi copii", (await rows(admin.from("notifications").select("id").eq("user_id", uGA).eq("kind", "fee_issued"))) === 1);

  check("părintele A își vede doar taxele copiilor lui", (await rows(parentA.from("charges").select("id"))) === 2);
  check("părintele B își vede doar taxa copilului lui", (await rows(parentB.from("charges").select("id"))) === 1);
  check("antrenorul NU vede taxele", (await rows(coach.from("charges").select("id"))) === 0);
  check("patronul NU vede rânduri de taxe", (await rows(owner.from("charges").select("id"))) === 0);
  check("alt club nu vede nimic", (await rows(secretaryB.from("charges").select("id"))) === 0);

  // -------------------------------------------------------------------------
  console.log("\nPlăți în numerar, chitanțe, alocări");
  const cash = must(await secretary.rpc("record_payment", { p: { method: "cash", amount: lei(500), guardian_id: gA.id, received_on: "2026-10-05", payer_name: "Mama Mare" } }), "numerar") as { payment_id: string; receipt_id: string; unallocated: number };
  const alloc = must(await admin.from("allocations").select("charge_id, amount").eq("payment_id", cash.payment_id), "alocări");
  check("plata se împarte singură pe taxele familiei", alloc.reduce((s, a) => s + a.amount, 0) === lei(500) && cash.unallocated === 0, alloc);
  const rc = must(await admin.from("receipts").select("series, number, amount, description").eq("id", cash.receipt_id).single(), "chitanță");
  check("chitanța are serie pe an și numărul 1", rc.series === "CH2026" && rc.number === 1 && rc.amount === lei(500), rc);
  const cash2 = must(await secretary.rpc("record_payment", { p: { method: "cash", amount: lei(10), player_id: p3, received_on: "2026-10-06" } }), "numerar 2") as { receipt_id: string };
  const rc2 = must(await admin.from("receipts").select("number").eq("id", cash2.receipt_id).single(), "chitanța 2");
  check("chitanța următoare are numărul 2", rc2.number === 2, rc2);
  check("data plății nu poate fi în viitor", await errored(secretary.rpc("record_payment", { p: { method: "cash", amount: lei(10), guardian_id: gA.id, received_on: "2099-01-01" } })));
  const bank = must(await secretary.rpc("record_payment", { p: { method: "bank", amount: lei(100), guardian_id: gA.id } }), "transfer") as { receipt_id: string | null; payment_id: string; unallocated: number };
  check("transferul bancar nu primește chitanță", bank.receipt_id === null);
  check("transferul se împarte pe ce a rămas de plată", bank.unallocated === 0, bank);
  const big = must(await secretary.rpc("record_payment", { p: { method: "bank", amount: lei(1000), guardian_id: gA.id } }), "transfer mare") as { payment_id: string; unallocated: number };
  check("ce depășește taxele rămâne de asociat", big.unallocated === lei(1000) - (lei(675) - lei(600)), big);
  check("o împărțire peste suma plății e refuzată", await errored(secretary.rpc("allocate_payment", { p_payment: bank.payment_id, p_rows: [{ charge_id: byP(p3).id, amount: lei(150) }] })));
  check("o taxă nu se plătește peste suma ei", await errored(secretary.rpc("allocate_payment", { p_payment: big.payment_id, p_rows: [{ charge_id: byP(p1).id, amount: lei(450) }] })));
  const bal = must(await parentA.from("charge_balances").select("id, state, balance"), "solduri părinte");
  check("părintele vede taxele lui achitate", bal.every((b) => b.state === "paid"), bal);
  check("antrenorul NU înregistrează plăți", await errored(coach.rpc("record_payment", { p: { method: "cash", amount: 100, guardian_id: gA.id } })));
  check("taxa cu plăți nu se poate anula", await errored(secretary.rpc("cancel_charge", { p_charge: byP(p1).id, p_reason: "test" })));
  must(await secretary.rpc("void_payment", { p_payment: cash.payment_id, p_reason: "Introdusă de două ori" }), "anulare");
  const voided = must(await admin.from("receipts").select("cancelled_at").eq("id", cash.receipt_id).single(), "chitanță anulată");
  check("anularea plății anulează chitanța și eliberează taxele", !!voided.cancelled_at && (await rows(admin.from("allocations").select("id").eq("payment_id", cash.payment_id))) === 0);

  // -------------------------------------------------------------------------
  console.log("\nPlăți online (operator de test)");
  check("părintele B NU poate plăti taxa altei familii", await errored(parentB.rpc("create_payment_intent", { p_charge_ids: [byP(p2).id] })));
  const intent = must(await parentA.rpc("create_payment_intent", { p_charge_ids: [byP(p2).id], p_save_method: true }), "intenție") as { id: string; amount: number };
  const p2bal = must(await admin.from("charge_balances").select("balance").eq("id", byP(p2).id).single(), "sold p2");
  check("intenția are exact soldul taxei", intent.amount === p2bal.balance && intent.amount > 0, { intent, p2bal });
  check("părintele NU poate aplica singur un eveniment de plată", await errored(parentA.rpc("apply_provider_event", { p: {} })));
  const evt = { provider: "test", event_id: `evt-${run}-1`, type: "payment.succeeded", intent_id: intent.id, payment_ref: `pay-${run}-1`, amount: intent.amount, occurred_at: new Date().toISOString(), method: { ref: `card-${run}`, label: "Card •••• 4242" } };
  const applied = must(await admin.rpc("apply_provider_event", { p: evt }), "eveniment") as { status: string; payment_id: string };
  const dup = must(await admin.rpc("apply_provider_event", { p: evt }), "duplicat") as { status: string };
  check("plata online ajunge în registru, o singură dată", applied.status === "ok" && dup.status === "duplicate" && (await rows(admin.from("payments").select("id").eq("provider_ref", `pay-${run}-1`))) === 1, { applied, dup });
  const p2after = must(await parentA.from("charge_balances").select("state").eq("id", byP(p2).id).single(), "stare p2");
  check("taxa plătită online apare achitată la părinte", p2after.state === "paid", p2after);
  check("cardul se salvează pentru plata automată", (await rows(parentA.from("payment_methods").select("id").is("revoked_at", null))) === 1);
  must(await admin.rpc("apply_provider_event", { p: { provider: "test", event_id: `evt-${run}-2`, type: "refund.succeeded", payment_ref: `pay-${run}-1`, amount: lei(25) } }), "returnare");
  const p2ref = must(await admin.from("charge_balances").select("state, balance").eq("id", byP(p2).id).single(), "după returnare");
  check("returnarea parțială redeschide taxa cu suma returnată", p2ref.state === "partial" && p2ref.balance === lei(25), p2ref);
  check("evenimentul altui operator nu atinge intenția", await errored(admin.rpc("apply_provider_event", { p: { ...evt, provider: "altul", event_id: `evt-${run}-x`, payment_ref: `pay-${run}-x` } })));
  const second = must(await admin.rpc("apply_provider_event", { p: { ...evt, event_id: `evt-${run}-3`, payment_ref: `pay-${run}-3` } }), "a doua încasare") as { payment_id: string };
  const secondBal = must(await admin.from("payment_balances").select("unallocated, amount").eq("id", second.payment_id).single(), "sold a doua");
  check("a doua încasare pe aceeași intenție rămâne de asociat", secondBal.unallocated === secondBal.amount, secondBal);
  const method = must(await parentA.from("payment_methods").select("id").is("revoked_at", null).single(), "metoda").id;
  check("părintele pornește plata automată", !(await errored(parentA.rpc("set_auto_pay", { p_method: method, p_on: true }))));
  check("părintele B NU poate porni plata automată pe cardul altuia", await errored(parentB.rpc("set_auto_pay", { p_method: method, p_on: false })));

  // -------------------------------------------------------------------------
  console.log("\nCereri de plată");
  const req = must(await secretary.rpc("save_charge_request", { p: { title: "Cantonament iarnă", amount: lei(800), due_on: "2026-12-01", kind: "camp", player_ids: [p1, p3] } }), "cerere") as { id: string; created: number };
  check("cererea creează câte o taxă pe jucător", req.created === 2, req);
  check("părintele B vede titlul cererii care îl privește", (await rows(parentB.from("charge_requests").select("id"))) === 1);
  const req2 = must(await secretary.rpc("save_charge_request", { p: { id: req.id, title: "Cantonament iarnă", amount: lei(900), due_on: "2026-12-01", kind: "camp", player_ids: [p1, p2, p3] } }), "cerere 2") as { created: number };
  const campAmounts = must(await admin.from("charges").select("amount").eq("request_id", req.id), "taxe cerere");
  check("adăugarea unui jucător și schimbarea sumei se aplică taxelor neplătite", req2.created === 1 && campAmounts.every((c) => c.amount === lei(900)), { req2, campAmounts });

  // -------------------------------------------------------------------------
  console.log("\nExtras bancar");
  const lines = [
    { hash: `h-${run}-1`, booked_on: "2026-10-12", amount: lei(250), description: `Taxa octombrie ${gB.payment_ref?.replace("-", " ")} Altul`, counterparty: "ALTUL ION" },
    { hash: `h-${run}-2`, booked_on: "2026-10-12", amount: lei(77), description: "Plata fara cod", counterparty: "NECUNOSCUT" },
    { hash: `h-${run}-3`, booked_on: "2026-10-13", amount: -lei(1200), description: "Plata factura 123", counterparty: "MAGAZIN SPORT" },
  ];
  const prev = must(await accountant.rpc("preview_bank_lines", { p_lines: lines }), "previzualizare") as Array<{ guardian_id: string | null; duplicate: boolean }>;
  check("codul de plată din descriere găsește familia", prev[0].guardian_id === gB.id && prev[1].guardian_id === null, prev);
  check("antrenorul NU importă extrase", await errored(coach.rpc("preview_bank_lines", { p_lines: lines })));
  const imp = must(await accountant.rpc("import_bank_statement", { p: { file_name: "extras.csv", lines: [
    { ...lines[0], action: "match_guardian", guardian_id: gB.id }, { ...lines[1], action: "unassigned_payment" }, lines[2],
  ] } }), "import") as { inserted: number; matched: number };
  check("importul salvează rândurile și le asociază", imp.inserted === 3 && imp.matched === 2, imp);
  const imp2 = must(await accountant.rpc("import_bank_statement", { p: { file_name: "extras.csv", lines } }), "reimport") as { inserted: number; duplicates: number };
  check("reimportul aceluiași extras nu dublează nimic", imp2.inserted === 0 && imp2.duplicates === 3, imp2);
  const p3bal = must(await admin.from("charge_balances").select("state").eq("id", byP(p3).id).single(), "p3");
  check("transferul cu cod achită taxa familiei", p3bal.state === "paid", p3bal);
  const credit = must(await admin.from("bank_lines").select("id").eq("line_hash", `h-${run}-2`).single(), "rând credit").id;
  check("un rând deja rezolvat nu devine a doua plată", await errored(accountant.rpc("resolve_bank_line", { p_line: credit, p: { action: "unassigned_payment" } })));
  check("încasarea fără cod ajunge la plăți de asociat", (await rows(accountant.from("payment_balances").select("id").gt("unallocated", 0).eq("payer_name", "NECUNOSCUT"))) === 1);

  // -------------------------------------------------------------------------
  console.log("\nReferate, cheltuieli, buget");
  const dept = must(await accountant.from("departments").insert({ club_id: clubA, name: "Echipament" }).select("id").single(), "departament").id;
  check("antrenorul vede departamentele (pentru referate)", (await rows(coach.from("departments").select("id"))) === 1);
  check("antrenorul NU creează departamente", await errored(coach.from("departments").insert({ club_id: clubA, name: "X" })));
  const pr = must(await coach.rpc("save_purchase_request", { p: { department_id: dept, group_id: G1, justification: "Mingi pentru U13", submit: true, items: [
    { name: "Minge mărimea 4", quantity: 10, unit_price: lei(100), vat_rate: 21, price_includes_vat: true },
    { name: "Jaloane", quantity: 2, unit_price: lei(50), vat_rate: 21, price_includes_vat: false },
  ] } }), "referat") as { id: string; number: number; total: number };
  const prRow = must(await admin.from("purchase_requests").select("total_net, total_vat, total, status").eq("id", pr.id).single(), "rând referat");
  check("TVA-ul se calculează corect (inclus și adăugat)", prRow.total_net === 82645 + 10000 && prRow.total_vat === 17355 + 2100 && prRow.total === 112100, prRow);
  check("aprobatorii primesc anunțul", (await rows(admin.from("notifications").select("id").eq("kind", "purchase_request").like("title", `Referat nr. ${pr.number}%`))) >= 2);
  check("antrenorul NU aprobă", await errored(coach.rpc("decide_purchase_request", { p_id: pr.id, p_decision: "approved" })));
  check("respingerea cere motiv", await errored(owner.rpc("decide_purchase_request", { p_id: pr.id, p_decision: "rejected" })));
  const edited = must(await adminU.rpc("save_purchase_request", { p: { id: pr.id, department_id: dept, group_id: G1, justification: "Mingi pentru U13 (corectat)", submit: true, items: [
    { name: "Minge mărimea 4", quantity: 10, unit_price: lei(100), vat_rate: 21, price_includes_vat: true },
    { name: "Jaloane", quantity: 2, unit_price: lei(50), vat_rate: 21, price_includes_vat: false },
  ] } }), "referat modificat de admin") as { id: string };
  check("cine a modificat referatul nu îl aprobă", await errored(adminU.rpc("decide_purchase_request", { p_id: edited.id, p_decision: "approved" })));
  check("specificația din dosarul altcuiva e refuzată", await errored(coach.rpc("save_purchase_request", { p: { justification: "X", spec_path: `${clubA}/altcineva/f.pdf`, items: [{ name: "X", quantity: 1, unit_price: 100, vat_rate: 21 }] } })));
  check("patronul aprobă", !(await errored(owner.rpc("decide_purchase_request", { p_id: pr.id, p_decision: "approved", p_note: "OK" }))));
  check("patronul vede cine a cerut referatul", ((await owner.from("purchase_requests").select("author:profiles!purchase_requests_requested_by_fkey(full_name)").eq("id", pr.id).single()).data?.author as { full_name: string } | null)?.full_name != null);
  check("patronul nu vede profilurile familiilor", (await rows(owner.from("profiles").select("id").in("role", ["guardian", "player"]))) === 0);
  check("autorul vede decizia",(await rows(coach.from("purchase_requests").select("id").eq("status", "approved"))) === 1);
  const own = must(await adminU.rpc("save_purchase_request", { p: { justification: "Laptop birou", submit: true, items: [{ name: "Laptop", quantity: 1, unit_price: lei(3000), vat_rate: 21 }] } }), "referat admin") as { id: string };
  check("nimeni nu își aprobă propriul referat", await errored(adminU.rpc("decide_purchase_request", { p_id: own.id, p_decision: "approved" })));
  check("cota de TVA din afara listei e refuzată", await errored(coach.rpc("save_purchase_request", { p: { justification: "X", items: [{ name: "X", quantity: 1, unit_price: 100, vat_rate: 19 }] } })));
  const exp = must(await accountant.rpc("complete_purchase_request", { p_id: pr.id, p: { supplier: "Magazin Sport", invoice_no: "F-123", spent_on: "2026-10-13", amount: lei(1200), method: "bank" } }), "cheltuială");
  check("referatul aprobat devine cheltuială", typeof exp === "string" && (await rows(accountant.from("expenses").select("id").eq("purchase_request_id", pr.id))) === 1);
  const debit = must(await admin.from("bank_lines").select("id").eq("line_hash", `h-${run}-3`).single(), "rând debit").id;
  check("plata din extras se leagă de cheltuială", !(await errored(accountant.rpc("resolve_bank_line", { p_line: debit, p: { action: "match_expense", expense_id: exp } }))));
  must(await accountant.from("budget_lines").insert({ club_id: clubA, year: 2026, month: 10, kind: "expense", department_id: dept, amount: lei(1000) }).select("id"), "buget");
  const br = must(await owner.rpc("budget_report", { p_year: 2026 }), "buget patron") as { departments: Array<{ planned: number[]; actual: number[] }> };
  check("bugetul arată planificat vs realizat, pe luni", br.departments[0].planned[9] === lei(1000) && br.departments[0].planned[0] === 0 && br.departments[0].actual[9] === lei(1200) && br.departments[0].actual[8] === 0, br.departments[0]);

  // -------------------------------------------------------------------------
  console.log("\nRapoarte");
  const sum = must(await owner.rpc("money_summary", { p_year: 2026, p_month: 10 }), "rezumat") as { months: Array<{ expected: number; received: number; spent: number }>; teams: Array<{ name: string; expected: number; collected: number }>; kpi: { unallocated_count: number } };
  check("patronul vede cifrele agregate", sum.months[9].expected === lei(450 + 225 + 200) && sum.months[9].spent === lei(1200), sum.months[9]);
  check("raportul pe echipe folosește același registru", sum.teams.reduce((s, t) => s + t.expected, 0) === sum.months[9].expected, sum.teams);
  check("directorul vede rezumatul", !(await errored(director.rpc("money_summary", { p_year: 2026 }))));
  check("antrenorul NU vede rezumatul", await errored(coach.rpc("money_summary", { p_year: 2026 })));
  check("părintele NU vede rezumatul", await errored(parentA.rpc("money_summary", { p_year: 2026 })));

  // -------------------------------------------------------------------------
  console.log("\nPrime");
  const match = must(await secretary.rpc("save_event", { p: { kind: "match", starts_at: "2026-10-10T08:00:00Z", ends_at: "2026-10-10T10:00:00Z", group_ids: [G1], match: { opponent_name: "Rival", is_home: true } } }), "meci");
  must(await coach.rpc("save_match_squad", { p_event: match, p_formation: "4-3-3", p_rows: [{ player_id: p1, role: "starter", slot: 0 }, { player_id: p2, role: "sub" }] }), "lot");
  must(await coach.rpc("add_match_event", { p_event: match, p: { minute: 10, kind: "goal", player_id: p1 } }), "gol 1");
  must(await coach.rpc("add_match_event", { p_event: match, p: { minute: 20, kind: "goal", player_id: p1 } }), "gol 2");
  must(await coach.rpc("close_match", { p_event: match, p_ratings: {} }), "închidere");
  must(await accountant.from("bonus_rules").insert([
    { club_id: clubA, name: "Victorie", target: "player", group_id: G1, trigger: "win", amount: lei(50) },
    { club_id: clubA, name: "Gol", target: "player", trigger: "goal", amount: lei(20) },
    { club_id: clubA, name: "Victorie staff", target: "staff", group_id: G1, trigger: "win", amount: lei(100) },
  ]).select("id"), "reguli");
  const nb = must(await accountant.rpc("compute_bonuses", { p_from: "2026-10-01", p_to: "2026-10-31" }), "calcul") as number;
  const be = must(await admin.from("bonus_entries").select("player_id, profile_id, amount, quantity").eq("club_id", clubA), "prime");
  const p1sum = be.filter((b) => b.player_id === p1).reduce((s, b) => s + b.amount, 0);
  check("primele se calculează din meci (victorie + 2 goluri)", p1sum === lei(50 + 40) && be.some((b) => b.profile_id) && !be.some((b) => b.player_id === p2), { nb, be });
  const nb2 = must(await accountant.rpc("compute_bonuses", { p_from: "2026-10-01", p_to: "2026-10-31" }), "recalcul") as number;
  check("recalcularea nu dublează primele", nb2 === nb, { nb, nb2 });
  check("antrenorul NU vede primele altora", (await rows(coach.from("bonus_entries").select("id").not("player_id", "is", null))) === 0);

  // -------------------------------------------------------------------------
  console.log("\nMigrarea din TFB");
  const emptyPlan = { groups: { create: [], rename: [] }, players: { create: [], update: [], deactivate: [] }, guardians: { create: [], link: [] }, contacts: [], feePlans: [], charges: [], payments: [], paymentsExisting: [], runs_seen: 0 };
  check("antrenorul NU rulează importul TFB", await errored(coach.rpc("import_tfb", { p: emptyPlan })));
  check("secretariatul NU rulează importul TFB", await errored(secretary.rpc("import_tfb", { p: emptyPlan })));
  const tfbRun = await adminU.rpc("import_tfb", { p: { ...emptyPlan, players: { create: [], update: [], deactivate: [pB] } } });
  check("administratorul rulează importul TFB", !tfbRun.error, tfbRun.error);
  check("importul TFB nu atinge alt club", (await admin.from("players").select("is_active").eq("id", pB).single()).data?.is_active === true);
  check("un plan vechi (după altă migrare) e refuzat", await errored(adminU.rpc("import_tfb", { p: emptyPlan })));

  console.log("\nȘtergere");
  const gone = await admin.from("clubs").delete().eq("id", clubA).select("id");
  check("ștergerea clubului șterge tot registrul", !gone.error && (gone.data ?? []).length === 1, gone.error);
  void pB;
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
