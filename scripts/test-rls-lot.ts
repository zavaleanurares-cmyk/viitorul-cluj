/**
 * Test de acces pentru Locker Room faza 2 (lot, program, prezență, meci, import de competiții).
 *
 *   npx tsx scripts/test-rls-lot.ts
 *
 * Creează două cluburi temporare, rulează verificările și șterge tot. Nu atinge cluburile reale.
 */
import crypto from "node:crypto";
import { closePool, deleteUser, ensureAccount, must, randomPassword, serviceClient, userClient } from "./lib";

const admin = serviceClient();
const run = crypto.randomBytes(3).toString("hex");
const pw = randomPassword();
const mail = (k: string) => `lot-${run}-${k}@example.com`;

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
  const { data: stale } = await admin.from("clubs").select("id").like("slug", "lot-%");
  for (const c of stale ?? []) {
    const { data: us } = await admin.from("profiles").select("id").eq("club_id", c.id);
    await admin.from("clubs").delete().eq("id", c.id);
    for (const u of us ?? []) await deleteUser(u.id);
  }
}

const iso = (d: Date) => d.toISOString();
const inDays = (n: number, h = 17) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); d.setUTCHours(h, 0, 0, 0); return d; };

try {
  const clubA = must(await admin.rpc("setup_club", { p_slug: `lot-a-${run}`, p_name: "Lot A", p_short_name: "A", p_groups: ["U13", "U15"], p_settings: {} }), "club A");
  const clubB = must(await admin.rpc("setup_club", { p_slug: `lot-b-${run}`, p_name: "Lot B", p_short_name: "B", p_groups: ["U11"], p_settings: {} }), "club B");
  clubIds.push(clubA, clubB);
  const [G1, G2] = must(await admin.from("groups").select("id").eq("club_id", clubA).order("sort"), "grupe").map((g) => g.id);
  const H1 = must(await admin.from("groups").select("id").eq("club_id", clubB).single(), "grupa B").id;
  await admin.from("groups").update({ players_on_pitch: 11, half_minutes: 35 }).in("id", [G1, G2]);

  const visa = new Date(Date.now() + 200 * 86400000).toISOString().slice(0, 10);
  const mkPlayer = async (club: string, group: string, name: string) =>
    must(await admin.from("players").insert({ club_id: club, group_id: group, full_name: name, display_name: name, birth_date: "2012-03-03", medical_visa_expires_on: visa }).select("id").single(), name).id;
  const p1 = await mkPlayer(clubA, G1, "UNU");
  const p2 = await mkPlayer(clubA, G1, "DOI");
  const p3 = await mkPlayer(clubA, G2, "TREI");
  const pX = await mkPlayer(clubA, G1, "PATRU");
  await mkPlayer(clubB, H1, "ALTCLUB");

  const acc = async (k: string, role: Parameters<typeof ensureAccount>[1]["role"], club: string, extra: { group_ids?: string[]; player_id?: string } = {}) => {
    const id = await ensureAccount(admin, { email: mail(k), password: pw, full_name: k, role, club_id: club, ...extra });
    userIds.push(id);
    return id;
  };
  await acc("admin", "admin", clubA);
  await acc("secretary", "secretary", clubA);
  await acc("coach", "coach", clubA, { group_ids: [G1] });
  await acc("player1", "player", clubA, { player_id: p1 });
  const uGuardian = await acc("guardian", "guardian", clubA);
  await acc("accountant", "accountant", clubA);
  const uMulti = await acc("multi", "coach", clubA, { group_ids: [G1] });
  await acc("secretaryb", "secretary", clubB);
  must(await admin.from("memberships").insert({ user_id: uMulti, club_id: clubB, role: "secretary" }).select("id"), "membership B");
  const gId = must(await admin.from("guardians").insert({ club_id: clubA, full_name: "Părinte Trei", user_id: uGuardian, phone: "0711" }).select("id").single(), "părinte").id;
  must(await admin.from("guardian_players").insert({ guardian_id: gId, player_id: p3, is_billing: true }).select("guardian_id"), "legătură părinte");

  const secretary = await userClient(mail("secretary"));
  const adminU = await userClient(mail("admin"));
  const coach = await userClient(mail("coach"));
  const player1 = await userClient(mail("player1"));
  const guardian = await userClient(mail("guardian"));
  const accountant = await userClient(mail("accountant"));
  const secretaryB = await userClient(mail("secretaryb"));
  const multi = await userClient(mail("multi"));

  // -------------------------------------------------------------------------
  console.log("\nTerenuri și evenimente");
  const venue = must(await secretary.from("venues").insert({ club_id: clubA, name: "Teren T2", surface: "synthetic" }).select("id").single(), "teren").id;
  check("antrenorul nu poate adăuga terenuri", await errored(coach.from("venues").insert({ club_id: clubA, name: "Teren X" })));
  const series = await secretary.rpc("save_event", { p: {
    kind: "training", title: "Antrenament U13", starts_at: iso(inDays(1)), ends_at: iso(inDays(1, 18)), venue_id: venue,
    group_ids: [G1], repeat: { weekdays: [1, 2, 3, 4, 5, 6, 7], until: inDays(14).toISOString().slice(0, 10) },
  } });
  check("secretariatul creează o serie de antrenamente", !series.error, series.error);
  const nSeries = await rows(admin.from("events").select("id").eq("club_id", clubA).eq("kind", "training"));
  check("seria a generat 14 evenimente", nSeries === 14, nSeries);
  const coachOwn = await coach.rpc("save_event", { p: { kind: "training", starts_at: iso(inDays(2, 9)), ends_at: iso(inDays(2, 10)), group_ids: [G1] } });
  check("antrenorul programează pentru echipa lui", !coachOwn.error, coachOwn.error);
  check("antrenorul NU programează pentru altă echipă", await errored(coach.rpc("save_event", { p: { kind: "training", starts_at: iso(inDays(2, 9)), ends_at: iso(inDays(2, 10)), group_ids: [G2] } })));
  check("antrenorul NU face rezervări de teren", await errored(coach.rpc("save_event", { p: { kind: "booking", starts_at: iso(inDays(2, 9)), ends_at: iso(inDays(2, 10)), group_ids: [G1] } })));
  const g2Event = must(await secretary.rpc("save_event", { p: { kind: "training", starts_at: iso(inDays(3)), ends_at: iso(inDays(3, 18)), group_ids: [G2] } }), "eveniment U15");
  check("antrenorul vede calendarul întregului club", (await rows(coach.from("events").select("id"))) === 16);
  check("jucătorul vede doar evenimentele echipei lui", (await rows(player1.from("events").select("id"))) === 15);
  check("părintele vede doar evenimentele echipei copilului", (await rows(guardian.from("events").select("id"))) === 1);
  check("alt club nu vede nimic", (await rows(secretaryB.from("events").select("id"))) === 0 && (await rows(secretaryB.from("venues").select("id"))) === 0);
  check("antrenorul NU poate anula evenimentul altei echipe", await errored(coach.rpc("set_event_state", { p_event: g2Event, p_state: "cancelled", p_scope: "one" })));
  const firstOfSeries = must(await admin.from("events").select("id, starts_at").eq("club_id", clubA).not("series_id", "is", null).order("starts_at").limit(1).single(), "primul").id;
  const delFollowing = await secretary.rpc("set_event_state", { p_event: firstOfSeries, p_state: "deleted", p_scope: "following" });
  check("ștergerea „de aici înainte” afectează toată seria", delFollowing.data === 14, delFollowing);
  const restored = await secretary.rpc("set_event_state", { p_event: firstOfSeries, p_state: "restored", p_scope: "following" });
  check("seria se poate restaura (coș)", restored.data === 14, restored);

  // -------------------------------------------------------------------------
  console.log("\nPrezență");
  const ev1 = firstOfSeries;
  const att = await coach.rpc("save_attendance", { p_event: ev1, p_rows: [
    { player_id: p1, status: "present", recorded_at: new Date().toISOString() },
    { player_id: p2, status: "absent", reason: "sick", recorded_at: new Date().toISOString() },
  ] });
  check("antrenorul face prezența la echipa lui", att.data === 2, att);
  check("antrenorul NU face prezența la altă echipă", await errored(coach.rpc("save_attendance", { p_event: g2Event, p_rows: [{ player_id: p3, status: "present" }] })));
  const stale = await coach.rpc("save_attendance", { p_event: ev1, p_rows: [{ player_id: p2, status: "present", recorded_at: new Date(Date.now() - 3600000).toISOString() }] });
  const p2Row = must(await admin.from("attendance").select("status").eq("event_id", ev1).eq("player_id", p2).single(), "p2");
  check("o sincronizare veche nu suprascrie o corectură mai nouă", stale.data === 0 && p2Row.status === "absent", { stale, p2Row });
  check("jucătorul își vede doar rândul lui", (await rows(player1.from("attendance").select("player_id"))) === 1);
  check("părintele nu vede prezența altor copii", (await rows(guardian.from("attendance").select("player_id"))) === 0);
  check("jucătorul NU poate scrie prezența direct", await errored(player1.from("attendance").insert({ event_id: ev1, player_id: p1, status: "present" })));

  // -------------------------------------------------------------------------
  console.log("\nLot, părinți, roluri noi");
  check("secretariatul vede toți jucătorii clubului", (await rows(secretary.from("players").select("id"))) === 4);
  check("contabilul vede jucătorii (pentru taxe)", (await rows(accountant.from("players").select("id"))) === 4);
  check("părintele vede doar copilul lui", (await rows(guardian.from("players").select("id"))) === 1);
  check("antrenorul nu vede părinții copiilor din alte echipe", (await rows(coach.from("guardians").select("id"))) === 0);
  check("secretariatul adaugă jucători", !(await errored(secretary.from("players").insert({ club_id: clubA, group_id: G2, full_name: "NOU", display_name: "NOU" }))));
  check("antrenorul NU adaugă jucători", await errored(coach.from("players").insert({ club_id: clubA, group_id: G1, full_name: "X", display_name: "X" })));
  check("administratorul vede rolurile din club", (await rows(adminU.from("memberships").select("id"))) >= 7);
  check("utilizatorul își vede propriile roluri", (await rows(multi.from("memberships").select("id"))) === 2);
  const mB = must(await admin.from("memberships").select("id").eq("user_id", uMulti).eq("club_id", clubB).single(), "mB").id;
  check("schimbarea clubului funcționează", !(await errored(multi.rpc("switch_membership", { p_membership: mB })))
    && (await rows(multi.from("players").select("id"))) === 1);

  // -------------------------------------------------------------------------
  console.log("\nMeci");
  const comp = must(await secretary.from("competitions").insert({ club_id: clubA, group_id: G1, name: "Campionat U13", yellow_limit: 1, own_name: "Lot A", half_minutes: 35 }).select("id").single(), "competiție").id;
  const match = must(await secretary.rpc("save_event", { p: {
    kind: "match", starts_at: iso(inDays(4, 8)), ends_at: iso(inDays(4, 10)), group_ids: [G1],
    match: { competition_id: comp, opponent_name: "Olimpia Sud", round: "8", is_home: false },
  } }), "meci");
  await admin.from("players").update({ medical_visa_expires_on: "2020-01-01" }).eq("id", pX);
  const elig = must(await coach.rpc("match_eligibility", { p_event: match }), "eligibilitate");
  check("viza expirată blochează convocarea", elig.some((e: { player_id: string; reason: string }) => e.player_id === pX && e.reason === "visa"), elig);
  check("lotul cu jucător blocat e refuzat", await errored(coach.rpc("save_match_squad", { p_event: match, p_formation: "4-3-3", p_rows: [{ player_id: pX, role: "starter" }] })));
  check("lotul valid se salvează", !(await errored(coach.rpc("save_match_squad", { p_event: match, p_formation: "4-3-3", p_rows: [
    { player_id: p1, role: "starter", slot: 0 }, { player_id: p2, role: "sub" }] }))));
  await coach.rpc("add_match_event", { p_event: match, p: { minute: 12, kind: "goal", player_id: p1 } });
  await coach.rpc("add_match_event", { p_event: match, p: { minute: 30, kind: "yellow", player_id: p1 } });
  const sub = await coach.rpc("add_match_event", { p_event: match, p: { minute: 50, kind: "sub", player_id: p1, related_player_id: p2 } });
  check("evenimentele de meci se adaugă", !sub.error, sub.error);
  const score = must(await coach.from("matches").select("goals_for, goals_against, status").eq("event_id", match).single(), "scor");
  check("scorul se calculează din evenimente", score.goals_for === 1 && score.goals_against === 0 && score.status === "live", score);
  check("jucătorul NU poate adăuga evenimente de meci", await errored(player1.rpc("add_match_event", { p_event: match, p: { minute: 1, kind: "goal_against" } })));
  check("meciul se închide", !(await errored(coach.rpc("close_match", { p_event: match, p_ratings: { [p1]: 4 } }))));
  const squad = must(await admin.from("match_squad").select("player_id, minutes, rating").eq("event_id", match), "lot");
  const m1 = squad.find((s) => s.player_id === p1);
  const m2 = squad.find((s) => s.player_id === p2);
  check("minutele: titularul până la ieșire, rezerva de la intrare", m1?.minutes === 50 && m2?.minutes === 20 && m1?.rating === 4, squad);
  const susp = must(await admin.from("suspensions").select("player_id, matches_remaining").eq("player_id", p1), "suspendări");
  check("galbenul la prag creează suspendare", susp.length === 1 && susp[0].matches_remaining === 1, susp);
  check("după închidere nu se mai adaugă evenimente", await errored(coach.rpc("add_match_event", { p_event: match, p: { minute: 60, kind: "goal_against" } })));
  check("antrenorul NU redeschide meciul", await errored(coach.rpc("reopen_match", { p_event: match })));

  // -------------------------------------------------------------------------
  console.log("\nImport din lista federației");
  const fx = await secretary.rpc("import_fixtures", { p_competition: comp, p_rows: [
    { round: "9", starts_at: iso(inDays(11, 8)), home: "Lot A", away: "CS Nord" },
    { round: "9", starts_at: iso(inDays(11, 8)), home: "Altcineva", away: "Alt club" },
    { round: "10", starts_at: iso(inDays(18, 8)), home: "Viitorul Est", away: "LOT A", home_goals: "", away_goals: "" },
  ] });
  check("importul creează doar meciurile noastre", (fx.data as { created: number; skipped: number } | null)?.created === 2 && (fx.data as { skipped: number }).skipped === 1, fx);
  const fx2 = await secretary.rpc("import_fixtures", { p_competition: comp, p_rows: [
    { round: "9", starts_at: iso(inDays(12, 8)), home: "Lot A", away: "CS Nord" },
  ] });
  check("reimportul actualizează, nu dublează", (fx2.data as { updated: number } | null)?.updated === 1, fx2);
  check("antrenorul NU poate importa", await errored(coach.rpc("import_fixtures", { p_competition: comp, p_rows: [] })));
  const st = await secretary.rpc("import_standings", { p_competition: comp, p_rows: [
    { position: 1, team: "CS Nord", played: 8, points: 20 }, { position: 2, team: "Lot A", played: 8, points: 18 },
  ] });
  const own = must(await coach.from("competition_standings").select("is_own").eq("competition_id", comp).eq("position", 2).single(), "clasament");
  check("clasamentul se importă și ne recunoaște echipa", st.data === 2 && own.is_own === true, { st, own });
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
