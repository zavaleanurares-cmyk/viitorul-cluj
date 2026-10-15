/**
 * Banii clubului demo (faza 3): setări, taxe pe echipe, reduceri, taxele emise pe septembrie și octombrie,
 * plăți în numerar / transfer / online, o plată de asociat, o cerere de plată (cantonament), un extras bancar,
 * cheltuieli pe departamente, referate în toate stările, buget și prime. Totul inventat.
 *
 * Plățile și referatele trec prin aceleași funcții ca în aplicație, cu identitatea conturilor demo
 * (contabil, antrenori, patron), ca registrul să fie exact ce ar produce folosirea reală.
 */
import { createDb, type Db } from "@club/db";
import { addDays, todayIn } from "@club/shared";
import { must } from "./common";

let seed = 20261016;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const between = (a: number, b: number) => Math.round(a + rnd() * (b - a));
const lei = (n: number) => Math.round(n * 100);

async function rpc<T>(db: Db, fn: string, args: Record<string, unknown>, label: string): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any).rpc(fn, args);
  if (error) throw new Error(`${label}: ${error.message}`);
  return data as T;
}

export async function seedBaniDemo(admin: Db, clubId: string, ids: Record<string, string>): Promise<void> {
  seed = 20261016;
  const { count } = await admin.from("fee_plans").select("id", { count: "exact", head: true }).eq("club_id", clubId);
  if (count) return;
  if (!ids.contabil) return;
  const acc = createDb({ sub: ids.contabil, role: "authenticated" });
  const today = todayIn();
  const year = Number(today.slice(0, 4));
  const thisMonth = `${today.slice(0, 7)}-01`;
  const prevMonth = (() => { const d = new Date(Date.UTC(year, Number(today.slice(5, 7)) - 2, 1)); return d.toISOString().slice(0, 10); })();

  // ---- setări ------------------------------------------------------------------------------
  must(await admin.from("finance_settings").update({
    beneficiary: "Asociația Club Sportiv Demo", fiscal_code: "12345678", address: "Str. Exemplului nr. 1, Cluj-Napoca",
    iban: "RO49AAAA1B31007593840000", bank_name: "Banca Exemplu", sibling_discount_pct: 25, receipt_prefix: "CSD",
  }).eq("club_id", clubId).select("club_id"), "setări financiare");

  // ---- taxe pe echipe, reduceri ---------------------------------------------------------------
  const groups = must(await admin.from("groups").select("id, name").eq("club_id", clubId), "grupe");
  const g = (n: string) => groups.find((x) => x.name === n)?.id;
  const fees: Array<[string, number]> = [["Seniori", 0], ["U19", 300], ["U17", 350]]; // seniorii nu plătesc taxă
  for (const [name, amount] of fees) {
    if (g(name)) must(await acc.from("fee_plans").insert({ club_id: clubId, group_id: g(name)!, amount: lei(amount), valid_from: prevMonth }).select("id"), `taxa ${name}`);
  }
  const youth = must(await admin.from("players").select("id, full_name, group_id, user_id").eq("club_id", clubId).eq("is_active", true)
    .in("group_id", [g("U19"), g("U17")].filter(Boolean) as string[]).order("full_name"), "jucători tineri");
  const minorUser = ids["jucator.minor"];
  const demoChild = youth.find((p) => p.user_id === minorUser);
  const others = youth.filter((p) => p.id !== demoChild?.id);
  if (others[0]) must(await acc.from("fee_adjustments").insert({ club_id: clubId, player_id: others[0].id, kind: "percent", value: 50, reason: "scholarship", note: "Bursă de performanță", from_month: prevMonth }).select("id"), "bursă");
  if (others[1]) must(await acc.from("fee_adjustments").insert({ club_id: clubId, player_id: others[1].id, kind: "waiver", value: 0, reason: "injury", note: "Accidentare lungă", from_month: thisMonth, to_month: thisMonth }).select("id"), "scutire");
  if (others[2]) must(await acc.from("fee_plans").insert({ club_id: clubId, player_id: others[2].id, amount: lei(250), valid_from: prevMonth, reason: "Înțelegere cu familia" }).select("id"), "taxă individuală");

  // ---- emiterea taxelor -----------------------------------------------------------------------
  await rpc(acc, "issue_monthly_charges", { p_period: prevMonth }, "emitere luna trecută");
  await rpc(acc, "issue_monthly_charges", { p_period: thisMonth }, "emitere luna curentă");
  await admin.from("finance_settings").update({ last_auto_issue: thisMonth }).eq("club_id", clubId);

  // ---- plăți ----------------------------------------------------------------------------------
  const families = must(await admin.from("guardians").select("id, full_name, payment_ref, user_id, guardian_players(player_id)").eq("club_id", clubId).is("deleted_at", null).order("full_name"), "familii");
  const open = async (guardianId: string, period: string) => {
    const { data } = await admin.from("charge_balances").select("id, balance, period").eq("guardian_id", guardianId).eq("status", "open").gt("balance", 0).eq("period", period);
    return data ?? [];
  };
  const dayIn = (period: string, from: number, to: number) => {
    const d = `${period.slice(0, 8)}${String(between(from, to)).padStart(2, "0")}`;
    return d > today ? today : d;
  };
  for (const f of families) {
    for (const [period, share] of [[prevMonth, 0.9], [thisMonth, 0.6]] as const) {
      const due = await open(f.id, period);
      const amount = due.reduce((s, c) => s + c.balance, 0);
      if (!amount) continue;
      const isDemo = f.user_id === ids.parinte;
      if (isDemo ? period === thisMonth : rnd() > share) continue; // părintele demo: luna curentă rămâne de plătit
      const kind = isDemo ? 0.1 : rnd();
      const day = dayIn(period, 2, period === thisMonth ? Math.min(14, Number(today.slice(8, 10))) : 20);
      if (kind < 0.35) {
        // online: ca un operator real (intenție → eveniment)
        const intent = must(await admin.from("payment_intents").insert({
          club_id: clubId, guardian_id: f.id, provider: "test", amount, charge_ids: due.map((c) => c.id), status: "pending", provider_ref: `demo_cs_${f.id.slice(0, 8)}_${period}`,
        }).select("id").single(), "intenție demo");
        await rpc(admin, "apply_provider_event", { p: {
          provider: "test", event_id: `demo_evt_${f.id}_${period}`, type: "payment.succeeded", intent_id: intent.id,
          payment_ref: `demo_pay_${f.id.slice(0, 8)}_${period}`, amount, occurred_at: `${day}T10:${String(between(10, 59))}:00Z`,
        } }, "plată online demo");
      } else if (kind < 0.7) {
        await rpc(acc, "record_payment", { p: { method: "bank", amount, received_on: day, guardian_id: f.id, payer_name: f.full_name, reference: `Taxa ${f.payment_ref}` } }, "transfer demo");
      } else {
        await rpc(acc, "record_payment", { p: { method: "cash", amount, received_on: day, guardian_id: f.id, payer_name: f.full_name } }, "numerar demo");
      }
    }
  }
  // o familie plătește mai mult (rămâne credit), un transfer fără cod
  const generous = families.find((f) => f.user_id !== ids.parinte && (f.guardian_players ?? []).length);
  if (generous) await rpc(acc, "record_payment", { p: { method: "bank", amount: lei(700), received_on: addDays(today, -3), guardian_id: generous.id, payer_name: generous.full_name, reference: "Taxa plus avans" } }, "avans");

  // ---- cerere de plată: cantonament U17 -------------------------------------------------------
  const u17 = youth.filter((p) => p.group_id === g("U17"));
  if (u17.length) {
    await rpc(acc, "save_charge_request", { p: { title: "Cantonament de iarnă", description: "Cazare, masă și transport, 5 zile", kind: "camp", amount: lei(900), due_on: `${year}-12-01`, player_ids: u17.map((p) => p.id) } }, "cerere cantonament");
  }

  // ---- departamente, cheltuieli, referate --------------------------------------------------------
  const dept = async (name: string, parent: string | null = null) => must(await acc.from("departments").insert({ club_id: clubId, name, parent_id: parent }).select("id").single(), `departament ${name}`).id;
  const echipament = await dept("Echipament");
  const mingi = await dept("Mingi și materiale", echipament);
  const transport = await dept("Transport");
  const arbitraj = await dept("Arbitraj și taxe federație");
  const utilitati = await dept("Utilități și bază");
  const medical = await dept("Medical");
  const spend: Array<[string, string, string, number, number, string]> = [
    ["Echipament de joc U17", echipament, "Sport Exemplu SRL", 4200, 20, "bank"],
    ["Transport meci în deplasare", transport, "Transport Exemplu", 1850, 12, "bank"],
    ["Taxe arbitraj etapa 7", arbitraj, "Asociația Județeană", 620, 5, "bank"],
    ["Energie electrică nocturnă", utilitati, "Furnizor Energie Exemplu", 1340, 25, "bank"],
    ["Bandaje și consumabile", medical, "Farmacia Exemplu", 285, 8, "card"],
    ["Transport meci în deplasare", transport, "Transport Exemplu", 1900, 33, "bank"],
    ["Taxe arbitraj etapa 9", arbitraj, "Asociația Județeană", 620, 38, "bank"],
  ];
  for (const [desc, dep, supplier, amount, daysAgo, method] of spend) {
    must(await acc.from("expenses").insert({ club_id: clubId, department_id: dep, description: desc, supplier, invoice_no: `F-${between(1000, 9999)}`, amount: lei(amount), spent_on: addDays(today, -daysAgo), method, created_by: ids.contabil }).select("id"), "cheltuială");
  }
  const coach = ids.antrenor ? createDb({ sub: ids.antrenor, role: "authenticated" }) : null;
  const coachJ = ids["antrenor.juniori"] ? createDb({ sub: ids["antrenor.juniori"], role: "authenticated" }) : null;
  const owner = ids.patron ? createDb({ sub: ids.patron, role: "authenticated" }) : null;
  if (coach && coachJ && owner) {
    await rpc(coach, "save_purchase_request", { p: { department_id: mingi, group_id: g("Seniori"), justification: "Mingi noi pentru antrenamente; cele vechi s-au uzat.", needed_by: addDays(today, 14), submit: true,
      items: [{ name: "Minge de joc mărimea 5", quantity: 12, unit_price: lei(180), vat_rate: 21, price_includes_vat: true }, { name: "Pompă cu manometru", quantity: 2, unit_price: lei(65), vat_rate: 21, price_includes_vat: true }] } }, "referat mingi");
    const cones = await rpc<{ id: string }>(coachJ, "save_purchase_request", { p: { department_id: mingi, group_id: g("U17"), justification: "Jaloane și scăriță de coordonare pentru U17.", submit: true,
      items: [{ name: "Set jaloane (50 buc.)", quantity: 2, unit_price: lei(95), vat_rate: 21, price_includes_vat: true }, { name: "Scăriță de coordonare", quantity: 1, unit_price: lei(140), vat_rate: 21, price_includes_vat: true }] } }, "referat jaloane");
    await rpc(owner, "decide_purchase_request", { p_id: cones.id, p_decision: "approved", p_note: "De acord." }, "aprobare");
    await rpc(acc, "complete_purchase_request", { p_id: cones.id, p: { supplier: "Sport Exemplu SRL", invoice_no: "F-2201", spent_on: addDays(today, -2), method: "bank" } }, "cumpărat");
    const vests = await rpc<{ id: string }>(coachJ, "save_purchase_request", { p: { department_id: echipament, group_id: g("U19"), justification: "Veste de antrenament în trei culori.", submit: true,
      items: [{ name: "Vestă de antrenament", quantity: 30, unit_price: lei(35), vat_rate: 21, price_includes_vat: true }] } }, "referat veste");
    await rpc(owner, "decide_purchase_request", { p_id: vests.id, p_decision: "rejected", p_note: "Avem veste în magazie; verifică întâi stocul." }, "respingere");
  }

  // ---- extras bancar ----------------------------------------------------------------------------
  const lines = [
    { hash: `demo-1-${today}`, booked_on: addDays(today, -4), amount: lei(150), description: "Transfer fara mentiuni", counterparty: "POPA ELENA" },
    { hash: `demo-2-${today}`, booked_on: addDays(today, -6), amount: -lei(890), description: "Plata factura apa-canal", counterparty: "COMPANIA DE APA EXEMPLU" },
    { hash: `demo-3-${today}`, booked_on: addDays(today, -8), amount: lei(1200), description: "Transfer intern din contul de economii", counterparty: "ASOCIATIA CLUB SPORTIV DEMO" },
  ];
  await rpc(acc, "import_bank_statement", { p: { file_name: `extras-${today.slice(0, 7)}.csv`, bank: "Banca Exemplu", lines: [
    lines[0], lines[1], { ...lines[2], action: "ignore", note: "Transfer între conturile clubului" },
  ] } }, "extras demo");

  // ---- buget ------------------------------------------------------------------------------------
  const budget: Array<[string | null, "income" | "expense", number]> = [
    [null, "income", 26000], [echipament, "expense", 3500], [transport, "expense", 3000], [arbitraj, "expense", 1500], [utilitati, "expense", 1800], [medical, "expense", 600],
  ];
  const rows = [];
  for (let m = 1; m <= 12; m++) for (const [dep, kind, amount] of budget) rows.push({ club_id: clubId, year, month: m, kind, department_id: dep, amount: lei(amount) });
  must(await acc.from("budget_lines").insert(rows).select("id"), "buget");

  // ---- prime -------------------------------------------------------------------------------------
  if (g("Seniori")) {
    must(await acc.from("bonus_rules").insert([
      { club_id: clubId, name: "Victorie Seniori", target: "player", group_id: g("Seniori")!, trigger: "win", amount: lei(200) },
      { club_id: clubId, name: "Gol marcat", target: "player", group_id: g("Seniori")!, trigger: "goal", amount: lei(100) },
      { club_id: clubId, name: "Victorie staff", target: "staff", group_id: g("Seniori")!, trigger: "win", amount: lei(300) },
    ]).select("id"), "reguli prime");
    await rpc(acc, "compute_bonuses", { p_from: addDays(today, -60), p_to: today }, "calcul prime");
  }
}
