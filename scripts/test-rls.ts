/**
 * Test de acces pe roluri, direct pe API (fără interfață): ce vede și ce poate modifica fiecare rol,
 * inclusiv încercări de acces neautorizat.
 *
 *   npx tsx scripts/test-rls.ts
 *
 * Creează două cluburi temporare cu utilizatori și date de test, rulează verificările și șterge tot.
 * Nu atinge datele cluburilor reale.
 */
import crypto from "node:crypto";
import { anonClient, closePool, deleteUser, ensureAccount, must, randomPassword, serviceClient, userClient, type Db } from "./lib";

const admin = serviceClient();
const run = crypto.randomBytes(3).toString("hex");
const pw = randomPassword();
const mail = (k: string) => `rls-${run}-${k}@example.com`;

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name}${detail !== undefined ? " — " + JSON.stringify(detail) : ""}`);
  }
}
const rows = async (q: PromiseLike<{ data: unknown[] | null; error: unknown }>) => ((await q).data ?? []).length;
const denied = async (q: PromiseLike<{ data: unknown; error: { message: string } | null }>) => {
  const r = await q;
  // refuzat = eroare SAU niciun rând afectat
  return !!r.error || r.data === null || (Array.isArray(r.data) && r.data.length === 0);
};
const errored = async (q: PromiseLike<{ error: { message: string } | null }>) => !!(await q).error;

const userIds: string[] = [];
const clubIds: string[] = [];

async function cleanup() {
  for (const c of clubIds) await admin.from("clubs").delete().eq("id", c);
  for (const u of userIds) await deleteUser(u);
}

// resturi de la rulări întrerupte
{
  const { data: stale } = await admin.from("clubs").select("id").like("slug", "rls-%");
  for (const c of stale ?? []) {
    const { data: us } = await admin.from("profiles").select("id").eq("club_id", c.id);
    await admin.from("clubs").delete().eq("id", c.id);
    for (const u of us ?? []) await deleteUser(u.id);
  }
}

try {
  // -------------------------------------------------------------------------
  // Date de test
  // -------------------------------------------------------------------------
  const clubA = must(await admin.rpc("setup_club", { p_slug: `rls-a-${run}`, p_name: "RLS A", p_short_name: "A", p_groups: ["G1", "G2"], p_settings: {} }), "club A");
  const clubB = must(await admin.rpc("setup_club", { p_slug: `rls-b-${run}`, p_name: "RLS B", p_short_name: "B", p_groups: ["H1"], p_settings: {} }), "club B");
  clubIds.push(clubA, clubB);
  const groupsA = must(await admin.from("groups").select("*").eq("club_id", clubA).order("sort"), "grupe A");
  const [G1, G2] = groupsA.map((g) => g.id);
  const H1 = must(await admin.from("groups").select("id").eq("club_id", clubB).single(), "grupa B").id;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest" }).format(new Date());
  const yesterday = new Date(Date.parse(today) - 86400000).toISOString().slice(0, 10);

  const mkPlayer = async (club: string, group: string, name: string, birth = "2000-01-01") =>
    must(await admin.from("players").insert({ club_id: club, group_id: group, full_name: name, display_name: name, birth_date: birth }).select("id").single(), name).id;
  const p1 = await mkPlayer(clubA, G1, "UNU");
  const p2 = await mkPlayer(clubA, G1, "DOI");
  const p3 = await mkPlayer(clubA, G2, "TREI");
  const p4 = await mkPlayer(clubA, G2, "PATRU", "2012-05-05");
  const pB = await mkPlayer(clubB, H1, "ALTCLUB");

  const acc = async (k: string, role: Parameters<typeof ensureAccount>[1]["role"], club: string, extra: { group_ids?: string[]; player_id?: string } = {}) => {
    const id = await ensureAccount(admin, { email: mail(k), password: pw, full_name: k, role, club_id: club, ...extra });
    userIds.push(id);
    return id;
  };
  const uOwner = await acc("owner", "owner", clubA);
  await acc("director", "sporting_director", clubA);
  const uPhysio = await acc("physio", "physio", clubA);
  const uCoach = await acc("coach", "coach", clubA, { group_ids: [G1] });
  await acc("player1", "player", clubA, { player_id: p1 });
  await acc("player4", "player", clubA, { player_id: p4 });
  const uPartner = await acc("partner", "medical_partner", clubA);
  await acc("physiob", "physio", clubB);

  for (const p of [p1, p2, p3, p4, pB]) {
    must(await admin.from("player_contacts").insert({ player_id: p, phone: "0700000000", guardian_name: "Tutore" }).select("player_id"), "contact");
    must(await admin.from("wellness_entries").insert({ player_id: p, entry_date: yesterday, fatigue: 5, muscle_load: 4, source: "staff" }).select("id"), "wellness");
    must(await admin.from("anthropometrics").insert({ player_id: p, height_cm: 180, weight_kg: 75 }).select("id"), "antropo");
  }
  const inj = async (p: string) => must(await admin.from("injuries").insert({ player_id: p, zone: "knee", diagnosis: "Entorsă", occurred_on: yesterday }).select("id").single(), "inj").id;
  const i1 = await inj(p1);
  const i3a = await inj(p3);
  const i3b = await inj(p3);
  const iB = await inj(pB);
  const doc = async (p: string, i: string | null, path: string) =>
    must(await admin.from("medical_documents").insert({ player_id: p, injury_id: i, title: "RMN", kind: "mri", storage_path: path }).select("id").single(), "doc").id;
  await doc(p1, i1, `${p1}/rmn-${run}.pdf`);
  await doc(p3, i3a, `${p3}/rmn-a-${run}.pdf`);
  await doc(p3, i3b, `${p3}/rmn-b-${run}.pdf`);
  const referral = must(await admin.from("referrals").insert({ player_id: p3, partner_user_id: uPartner, injury_id: i3a, created_by: uPhysio }).select("id").single(), "trimitere").id;
  const ex = must(await admin.from("exercises").insert({ club_id: clubA, name: "Podul fesier", category: "recovery" }).select("id").single(), "ex").id;
  const plan = must(await admin.from("daily_plans").insert({ player_id: p1, plan_date: today, title: "Plan" }).select("id").single(), "plan").id;
  const item = must(await admin.from("daily_plan_items").insert({ plan_id: plan, exercise_id: ex, sets: 3, reps: "10" }).select("id").single(), "item").id;
  const plan3 = must(await admin.from("daily_plans").insert({ player_id: p3, plan_date: today }).select("id").single(), "plan3").id;
  const item3 = must(await admin.from("daily_plan_items").insert({ plan_id: plan3, exercise_id: ex }).select("id").single(), "item3").id;
  const test = must(await admin.from("fitness_tests").select("id").eq("club_id", clubA).limit(1).single(), "test").id;
  for (const p of [p1, p2, p3, p4]) must(await admin.from("fitness_test_results").insert({ test_id: test, player_id: p, value: 1.8 }).select("id"), "rez");

  const anon = anonClient();
  const owner = await userClient(mail("owner"));
  const director = await userClient(mail("director"));
  const physio = await userClient(mail("physio"));
  const coach = await userClient(mail("coach"));
  const player1 = await userClient(mail("player1"));
  const player4 = await userClient(mail("player4"));
  const partner = await userClient(mail("partner"));
  const physioB = await userClient(mail("physiob"));

  const medicalTables = ["injuries", "wellness_entries", "anthropometrics", "medical_documents", "player_contacts", "fitness_test_results"] as const;
  const countAll = async (db: Db, t: (typeof medicalTables)[number] | "players" | "daily_plans" | "audit_log" | "alerts" | "profiles") =>
    rows(db.from(t).select("*"));

  // -------------------------------------------------------------------------
  console.log("\nNeautentificat");
  for (const t of ["players", "injuries", "wellness_entries", "profiles", "clubs", "exercises"] as const) {
    check(`anon nu citește ${t}`, (await rows(anon.from(t).select("*"))) === 0);
  }
  check("anon nu poate apela club_overview", await errored(anon.rpc("club_overview")));
  check("anon nu poate apela setup_club", await errored(anon.rpc("setup_club", { p_slug: "x", p_name: "x", p_short_name: "x", p_groups: [], p_settings: {} })));
  check("anon nu poate insera chestionare", await errored(anon.from("wellness_entries").insert({ player_id: p1, entry_date: today, fatigue: 1, muscle_load: 1 })));

  // -------------------------------------------------------------------------
  console.log("\nPatron — doar agregate");
  check("nu vede niciun jucător", (await countAll(owner, "players")) === 0);
  for (const t of medicalTables) check(`nu vede ${t}`, (await countAll(owner, t)) === 0);
  const ov = await owner.rpc("club_overview");
  const totals = (ov.data as { totals?: { players?: number } } | null)?.totals;
  check("primește privirea de ansamblu (4 jucători, 2 grupe)", !ov.error && totals?.players === 4 && (ov.data as { groups: unknown[] }).groups.length === 2, ov.error ?? totals);
  check("privirea de ansamblu nu conține nume", !JSON.stringify(ov.data).includes("UNU"));
  check("nu poate modifica un jucător", await denied(owner.from("players").update({ status_note: "x" }).eq("id", p1).select("id")));
  check("nu vede jurnalul de audit", (await countAll(owner, "audit_log")) === 0);
  check("nu vede alte conturi", (await countAll(owner, "profiles")) === 1);
  check("nu poate anonimiza", await errored(owner.rpc("anonymize_player", { p_player: p1 })));

  // -------------------------------------------------------------------------
  console.log("\nDirector sportiv — fișa sumară, doar citire");
  check("vede toți jucătorii clubului lui (4)", (await countAll(director, "players")) === 4);
  for (const t of medicalTables) check(`nu vede ${t}`, (await countAll(director, t)) === 0);
  check("vede istoricul de stare", (await rows(director.from("status_history").select("*"))) === 4);
  check("nu poate modifica starea", await denied(director.from("players").update({ status_note: "x" }).eq("id", p1).select("id")));
  check("nu poate adăuga accidentare", await errored(director.from("injuries").insert({ player_id: p1, zone: "knee" })));
  check("nu vede planurile", (await countAll(director, "daily_plans")) === 0);
  check("nu poate exporta datele unui jucător", await errored(director.rpc("export_player_data", { p_player: p1 })));

  // -------------------------------------------------------------------------
  console.log("\nPreparator fizic — tot, în clubul lui");
  check("vede toți jucătorii clubului (4), niciunul din alt club", (await countAll(physio, "players")) === 4);
  check("vede toate accidentările clubului (3)", (await countAll(physio, "injuries")) === 3);
  check("vede toate chestionarele clubului (4)", (await countAll(physio, "wellness_entries")) === 4);
  check("poate modifica starea unui jucător", !(await denied(physio.from("players").update({ status_note: "Verificat" }).eq("id", p2).select("id"))));
  check("poate adăuga o accidentare", !(await errored(physio.from("injuries").insert({ player_id: p2, zone: "ankle", occurred_on: today }))));
  check("NU poate adăuga accidentare la jucător din alt club", await errored(physio.from("injuries").insert({ player_id: pB, zone: "ankle" })));
  check("NU vede jucătorul din alt club", (await rows(physio.from("players").select("id").eq("id", pB))) === 0);
  check("NU vede accidentarea din alt club", (await rows(physio.from("injuries").select("id").eq("id", iB))) === 0);
  check("NU poate modifica alt club", await denied(physio.from("clubs").update({ name: "X" }).eq("id", clubB).select("id")));
  check("NU poate muta un jucător în alt club", await denied(physio.from("players").update({ club_id: clubB }).eq("id", p2).select("id")));
  check("vede jurnalul de audit al clubului", (await countAll(physio, "audit_log")) > 0);
  check("modificarea de stare a fost jurnalizată", (await rows(physio.from("audit_log").select("id").eq("player_id", p2).eq("action", "UPDATE").eq("entity", "players"))) === 1);
  check("NU poate scrie direct în jurnalul de audit", await errored(physio.from("audit_log").insert({ action: "X", entity: "x" } as never)));
  check("NU poate șterge din jurnalul de audit", await denied(physio.from("audit_log").delete().eq("club_id", clubA).select("id")));
  const planId = await physio.rpc("save_daily_plan", { p_player: p2, p_date: today, p_title: "Recuperare", p_notes: null, p_injury: null, p_rtp_stage: null, p_items: [{ exercise_id: ex, sets: 2, reps: "12" }] });
  check("poate salva un plan zilnic", !planId.error, planId.error);
  check("NU poate salva plan pentru alt club", await errored(physio.rpc("save_daily_plan", { p_player: pB, p_date: today, p_title: "x", p_notes: null, p_injury: null, p_rtp_stage: null, p_items: [] })));
  check("preparatorul altui club nu vede nimic de aici", (await rows(physioB.from("players").select("id").in("id", [p1, p2, p3, p4]))) === 0
    && (await rows(physioB.from("injuries").select("id").in("id", [i1, i3a]))) === 0);

  // -------------------------------------------------------------------------
  console.log("\nAntrenor (grupa G1) — fișa medicală completă a grupei, doar citire");
  const coachPlayers = (await coach.from("players").select("id")).data ?? [];
  check("vede doar jucătorii din G1 (2)", coachPlayers.length === 2 && coachPlayers.every((p) => [p1, p2].includes(p.id)), coachPlayers.length);
  check("vede accidentările grupei lui", (await rows(coach.from("injuries").select("id").eq("player_id", p1))) === 1);
  check("vede documentele medicale ale grupei lui", (await rows(coach.from("medical_documents").select("id").eq("player_id", p1))) === 1);
  check("vede chestionarele grupei lui", (await rows(coach.from("wellness_entries").select("id"))) === 2);
  check("vede datele fizice ale grupei lui", (await rows(coach.from("fitness_test_results").select("id"))) === 2);
  check("NU vede jucătorul din G2 (cerut direct după id)", (await rows(coach.from("players").select("id").eq("id", p3))) === 0);
  check("NU vede accidentările din G2", (await rows(coach.from("injuries").select("id").eq("player_id", p3))) === 0);
  check("NU vede accidentarea din G2 cerută după id", (await rows(coach.from("injuries").select("id").eq("id", i3a))) === 0);
  check("NU vede chestionarele din G2", (await rows(coach.from("wellness_entries").select("id").eq("player_id", p3))) === 0);
  check("NU vede documentele din G2", (await rows(coach.from("medical_documents").select("id").eq("player_id", p3))) === 0);
  check("NU vede antropometria din G2", (await rows(coach.from("anthropometrics").select("id").eq("player_id", p3))) === 0);
  check("NU vede istoricul de stare din G2", (await rows(coach.from("status_history").select("id").eq("player_id", p3))) === 0);
  check("NU vede datele de contact (nici în grupa lui)", (await rows(coach.from("player_contacts").select("*"))) === 0);
  check("NU poate modifica starea unui jucător din grupa lui", await denied(coach.from("players").update({ status_note: "x" }).eq("id", p1).select("id")));
  check("NU poate adăuga accidentare", await errored(coach.from("injuries").insert({ player_id: p1, zone: "knee" })));
  check("NU poate modifica o accidentare", await denied(coach.from("injuries").update({ diagnosis: "x" }).eq("id", i1).select("id")));
  check("NU poate șterge o accidentare", await denied(coach.from("injuries").delete().eq("id", i1).select("id")));
  check("NU poate completa chestionar în locul jucătorului", await errored(coach.from("wellness_entries").insert({ player_id: p2, entry_date: today, fatigue: 3, muscle_load: 3 })));
  check("NU poate modifica un chestionar", await denied(coach.from("wellness_entries").update({ fatigue: 1 }).eq("player_id", p1).select("id")));
  check("NU poate adăuga exerciții", await errored(coach.from("exercises").insert({ club_id: clubA, name: "x" })));
  check("NU poate salva planuri (RPC)", await errored(coach.rpc("save_daily_plan", { p_player: p1, p_date: today, p_title: "x", p_notes: null, p_injury: null, p_rtp_stage: null, p_items: [] })));
  check("NU poate importa (RPC)", await errored(coach.rpc("import_health_status", { p_payload: { rows: [] } })));
  check("NU poate exporta datele unui jucător (RPC)", await errored(coach.rpc("export_player_data", { p_player: p1 })));
  check("NU poate anonimiza (RPC)", await errored(coach.rpc("anonymize_player", { p_player: p1 })));
  check("NU poate cere media altei grupe (RPC)", await errored(coach.rpc("group_test_averages", { p_group: G2 })));
  check("NU își poate adăuga singur o grupă", await errored(coach.from("staff_groups").insert({ user_id: uCoach, group_id: G2 })));
  check("NU își poate schimba rolul", await denied(coach.from("profiles").update({ role: "physio" }).eq("id", uCoach).select("id")));
  check("NU vede jurnalul de audit", (await countAll(coach, "audit_log")) === 0);
  check("NU vede alertele", (await countAll(coach, "alerts")) === 0);
  const ovCoach = await coach.rpc("club_overview");
  check("privirea de ansamblu a antrenorului acoperă doar grupa lui", (ovCoach.data as { totals: { players: number } }).totals.players === 2);
  check("citirea fișei se jurnalizează", !(await errored(coach.rpc("log_medical_access", { p_player: p1, p_section: "medical" })))
    && (await rows(physio.from("audit_log").select("id").eq("player_id", p1).eq("action", "READ").eq("actor_id", uCoach))) === 1);
  check("NU poate jurnaliza (și deci confirma existența) unui jucător din altă grupă", await errored(coach.rpc("log_medical_access", { p_player: p3, p_section: "medical" })));
  // mutarea jucătorului schimbă accesul, fără pierdere de istoric
  must(await physio.from("players").update({ group_id: G1 }).eq("id", p3).select("id"), "mutare");
  check("după mutarea în G1, antrenorul vede jucătorul și istoricul lui", (await rows(coach.from("injuries").select("id").eq("player_id", p3))) === 2
    && (await rows(coach.from("wellness_entries").select("id").eq("player_id", p3))) === 1);
  check("mutarea păstrează istoricul de grupă", (await rows(physio.from("player_group_history").select("id").eq("player_id", p3))) === 2);
  must(await physio.from("players").update({ group_id: G2 }).eq("id", p3).select("id"), "mutare înapoi");
  check("după mutarea înapoi, accesul dispare", (await rows(coach.from("injuries").select("id").eq("player_id", p3))) === 0);

  // -------------------------------------------------------------------------
  console.log("\nJucător — doar pagina lui");
  const mine = (await player1.from("players").select("id")).data ?? [];
  check("vede doar fișa lui", mine.length === 1 && mine[0].id === p1);
  check("vede accidentările lui, nu ale altora", (await rows(player1.from("injuries").select("id"))) === 1);
  check("vede doar chestionarele lui", (await rows(player1.from("wellness_entries").select("id"))) === 1);
  check("vede planul lui de azi", (await rows(player1.from("daily_plans").select("id"))) === 1);
  check("vede exercițiile din planul lui", (await rows(player1.from("daily_plan_items").select("id"))) === 1);
  check("completează chestionarul de azi", !(await errored(player1.from("wellness_entries").insert({ player_id: p1, entry_date: today, fatigue: 9, muscle_load: 6, pain_zone: "knee", pain_intensity: 4 }))));
  check("își poate corecta chestionarul în aceeași zi", !(await denied(player1.from("wellness_entries").update({ fatigue: 8 }).eq("player_id", p1).eq("entry_date", today).select("id"))));
  check("NU poate completa pentru alt jucător", await errored(player1.from("wellness_entries").insert({ player_id: p2, entry_date: today, fatigue: 1, muscle_load: 1 })));
  check("NU poate completa retroactiv", await errored(player1.from("wellness_entries").insert({ player_id: p1, entry_date: "2026-01-01", fatigue: 1, muscle_load: 1 })));
  check("NU poate modifica chestionarul de ieri", await denied(player1.from("wellness_entries").update({ fatigue: 1 }).eq("player_id", p1).eq("entry_date", yesterday).select("id")));
  check("NU poate trimite valori în afara scalei", await errored(player1.from("wellness_entries").update({ fatigue: 11 }).eq("player_id", p1).eq("entry_date", today)));
  check("bifează un exercițiu din planul lui", !(await errored(player1.from("exercise_completions").insert({ player_id: p1, done_on: today, plan_item_id: item, done: true }))));
  check("NU poate bifa în numele altui jucător", await errored(player1.from("exercise_completions").insert({ player_id: p3, done_on: today, plan_item_id: item3, done: true })));
  check("NU își poate schimba starea medicală", await denied(player1.from("players").update({ status_note: "apt" }).eq("id", p1).select("id")));
  check("NU își poate modifica accidentarea", await denied(player1.from("injuries").update({ actual_return_on: today }).eq("id", i1).select("id")));
  check("NU își poate șterge chestionarele", await denied(player1.from("wellness_entries").delete().eq("player_id", p1).select("id")));
  check("își poate actualiza datele de contact", !(await denied(player1.from("player_contacts").update({ phone: "0711111111" }).eq("player_id", p1).select("player_id"))));
  check("NU vede datele de contact ale altora", (await rows(player1.from("player_contacts").select("*"))) === 1);
  check("NU vede alți jucători (cerut după id)", (await rows(player1.from("players").select("id").eq("id", p2))) === 0);
  check("NU poate apela privirea de ansamblu", await errored(player1.rpc("club_overview")));
  check("își poate exporta propriile date", !(await errored(player1.rpc("export_player_data", {}))));
  check("NU poate exporta datele altuia", await errored(player1.rpc("export_player_data", { p_player: p2 })));
  check("NU își poate schimba rolul", await denied(player1.from("profiles").update({ role: "physio" }).eq("full_name", "player1").select("id")));
  check("media grupei la teste nu se dă sub 3 jucători", ((await player1.rpc("group_test_averages", { p_group: G1 })).data ?? []).length === 0);
  check("alt jucător nu vede nimic din fișa primului", (await rows(player4.from("injuries").select("id").eq("player_id", p1))) === 0
    && (await rows(player4.from("wellness_entries").select("id").eq("player_id", p1))) === 0);

  console.log("\nAlerte și notificări");
  const alerts = (await physio.from("alerts").select("kind, player_id")).data ?? [];
  check("oboseala 9/10 și durerea au generat alerte pentru preparator", alerts.some((a) => a.kind === "fatigue_high" && a.player_id === p1) && alerts.some((a) => a.kind === "pain_reported"));
  must(await player1.from("wellness_entries").update({ fatigue: 4 }).eq("player_id", p1).eq("entry_date", today).select("id"), "corecție");
  check("corectarea valorii retrage alerta", !((await physio.from("alerts").select("kind").eq("player_id", p1)).data ?? []).some((a) => a.kind === "fatigue_high"));
  check("preparatorul a primit notificare", (await rows(physio.from("notifications").select("id").eq("kind", "alert"))) > 0);
  check("jucătorul vede doar notificările lui", ((await player1.from("notifications").select("user_id")).data ?? []).every((n) => n.user_id !== uPhysio));
  check("notificarea „plan nou” a ajuns la jucător", (await rows(player1.from("notifications").select("id").eq("kind", "plan_new"))) === 1);
  check("NU își poate crea singur notificări", await errored(player1.from("notifications").insert({ user_id: uOwner, kind: "x", title: "x" } as never)));

  // -------------------------------------------------------------------------
  console.log("\nPartener medical — doar cazurile trimise");
  const pp = (await partner.from("players").select("id")).data ?? [];
  check("vede doar jucătorul trimis către el", pp.length === 1 && pp[0].id === p3);
  const pi = (await partner.from("injuries").select("id")).data ?? [];
  check("vede doar accidentarea din trimitere", pi.length === 1 && pi[0].id === i3a);
  check("vede doar documentele cazului", (await rows(partner.from("medical_documents").select("id"))) === 1);
  check("NU vede chestionarele", (await rows(partner.from("wellness_entries").select("id"))) === 0);
  check("NU vede datele de contact", (await rows(partner.from("player_contacts").select("*"))) === 0);
  check("adaugă o notă pe caz", !(await errored(partner.from("partner_notes").insert({ referral_id: referral, author_id: uPartner, note: "Ecografie fără modificări." }))));
  check("adaugă un document pe caz", !(await errored(partner.from("medical_documents").insert({ player_id: p3, injury_id: i3a, title: "Eco", kind: "ultrasound", storage_path: `${p3}/eco-${run}.pdf`, uploaded_by: uPartner }))));
  check("NU poate adăuga document la alt jucător", await errored(partner.from("medical_documents").insert({ player_id: p1, title: "x", storage_path: `${p1}/x-${run}.pdf`, uploaded_by: uPartner })));
  check("NU poate modifica accidentarea", await denied(partner.from("injuries").update({ diagnosis: "x" }).eq("id", i3a).select("id")));
  check("nota partenerului ajunge la preparator", (await rows(physio.from("partner_notes").select("id").eq("referral_id", referral))) === 1);
  must(await physio.from("referrals").update({ is_active: false }).eq("id", referral).select("id"), "închidere trimitere");
  check("după închiderea trimiterii nu mai vede nimic", (await rows(partner.from("players").select("id"))) === 0 && (await rows(partner.from("injuries").select("id"))) === 0);
  check("după închidere nu mai poate adăuga note", await errored(partner.from("partner_notes").insert({ referral_id: referral, author_id: uPartner, note: "x" })));
  must(await physio.from("referrals").update({ is_active: true }).eq("id", referral).select("id"), "redeschidere");

  // -------------------------------------------------------------------------
  console.log("\nFișiere (depozit privat; accesul îl decide funcția file_access, sub RLS)");
  const can = async (db: Db, bucket: string, path: string, action: "read" | "write" | "delete") =>
    (await db.rpc("file_access", { p_bucket: bucket, p_path: path, p_action: action })).data === true;
  const f1 = `${p1}/rmn-${run}.pdf`;
  const f3a = `${p3}/rmn-a-${run}.pdf`;
  const f3b = `${p3}/rmn-b-${run}.pdf`;
  check("preparatorul poate încărca un document medical", await can(physio, "medical", f1, "write"));
  check("antrenorul NU poate încărca documente", !(await can(coach, "medical", `${p1}/hack-${run}.pdf`, "write")));
  check("jucătorul NU poate încărca documente medicale", !(await can(player1, "medical", `${p1}/hack2-${run}.pdf`, "write")));
  check("antrenorul poate citi documentul din grupa lui", await can(coach, "medical", f1, "read"));
  check("antrenorul NU poate citi documentul din altă grupă", !(await can(coach, "medical", f3a, "read")));
  check("antrenorul NU poate șterge documente", !(await can(coach, "medical", f1, "delete")));
  check("alt jucător NU poate citi documentul", !(await can(player4, "medical", f1, "read")));
  check("jucătorul își poate citi propriul document", await can(player1, "medical", f1, "read"));
  check("partenerul poate citi doar documentul cazului", (await can(partner, "medical", f3a, "read")) && !(await can(partner, "medical", f3b, "read")));
  check("partenerul poate încărca doar pe cazul lui", (await can(partner, "medical", `${p3}/nou-${run}.pdf`, "write")) && !(await can(partner, "medical", `${p1}/nou-${run}.pdf`, "write")));
  check("patronul NU poate citi documente", !(await can(owner, "medical", f1, "read")));
  check("directorul NU poate citi documente", !(await can(director, "medical", f1, "read")));
  check("fără autentificare nu există acces la fișiere", await errored(anon.rpc("file_access", { p_bucket: "medical", p_path: f1, p_action: "read" })));
  check("un fișier fără rând în evidență nu poate fi citit de nimeni în afară de preparator… nici de el", !(await can(physio, "medical", `${p1}/inexistent.pdf`, "read")));
  check("căile cu „..” sunt refuzate", !(await can(physio, "medical", `${p1}/../${p3}/x.pdf`, "write")));
  check("clipurile de exerciții: preparatorul scrie, jucătorul doar citește", (await can(physio, "exercise-media", `${clubA}/clip.mp4`, "write"))
    && (await can(player1, "exercise-media", `${clubA}/clip.mp4`, "read")) && !(await can(player1, "exercise-media", `${clubA}/clip.mp4`, "write")));
  check("clipurile altui club nu pot fi citite", !(await can(player1, "exercise-media", `${clubB}/clip.mp4`, "read")) && !(await can(physio, "exercise-media", `${clubB}/clip.mp4`, "write")));
  check("patronul nu are acces la clipuri (nu are biblioteca)", !(await can(owner, "exercise-media", `${clubA}/clip.mp4`, "read")));
  check("fotografia: jucătorul și-o schimbă pe a lui, nu pe a altuia", (await can(player1, "avatars", `${p1}/eu.jpg`, "write")) && !(await can(player1, "avatars", `${p2}/el.jpg`, "write")));
  check("fotografia: antrenorul o vede doar la grupa lui", (await can(coach, "avatars", `${p1}/eu.jpg`, "read")) && !(await can(coach, "avatars", `${p3}/el.jpg`, "read")));
  check("sigla: toți membrii clubului o văd, doar preparatorul o schimbă", (await can(player1, "branding", `${clubA}/sigla.png`, "read"))
    && !(await can(coach, "branding", `${clubA}/sigla.png`, "write")) && (await can(physio, "branding", `${clubA}/sigla.png`, "write")));

  // -------------------------------------------------------------------------
  console.log("\nGDPR și conturi dezactivate");
  check("jucătorul își înregistrează consimțământul", !(await errored(player1.from("consents").insert({ user_id: userIds[4], player_id: p1, kind: "self", text_version: "test" }))));
  check("NU poate înregistra consimțământ în numele altuia", await errored(player1.from("consents").insert({ user_id: uOwner, kind: "self", text_version: "test" })));
  check("jucătorul poate cere ștergerea datelor", !(await errored(player1.from("data_requests").insert({ club_id: clubA, user_id: userIds[4], player_id: p1, kind: "delete" }))));
  check("preparatorul vede cererea", (await rows(physio.from("data_requests").select("id"))) === 1);
  check("anonimizarea șterge identitatea și păstrează statistica", !(await errored(physio.rpc("anonymize_player", { p_player: p4 })))
    && ((await physio.from("players").select("full_name, user_id, is_active, birth_date").eq("id", p4).single()).data?.full_name === "Jucător anonimizat")
    && (await rows(physio.from("player_contacts").select("*").eq("player_id", p4))) === 0
    && (await rows(physio.from("wellness_entries").select("id").eq("player_id", p4))) === 1);
  check("contul jucătorului anonimizat nu mai vede nimic", (await rows(player4.from("players").select("id"))) === 0);
  must(await physio.from("profiles").update({ is_active: false }).eq("id", uCoach).select("id"), "dezactivare");
  check("un cont dezactivat nu mai vede nimic", (await rows(coach.from("players").select("id"))) === 0 && (await rows(coach.from("injuries").select("id"))) === 0);
  check("ștergerea unui jucător îi șterge și datele medicale", !(await denied(physio.from("players").delete().eq("id", p2).select("id")))
    && (await rows(admin.from("wellness_entries").select("id").eq("player_id", p2))) === 0
    && (await rows(admin.from("injuries").select("id").eq("player_id", p2))) === 0);
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
