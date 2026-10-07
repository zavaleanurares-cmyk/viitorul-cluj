/**
 * Club demonstrativ, cu date inventate: „Club Demo" — 3 grupe, 42 de jucători, șase săptămâni de istoric
 * (chestionare, RPE, date GPS, teste, accidentări, planuri, programe) și câte un cont pentru fiecare rol.
 * Folosit pentru prezentări și teste; nu conține nicio persoană reală.
 *
 *   npx tsx scripts/seed-demo.ts            # creează sau completează
 *   npx tsx scripts/seed-demo.ts --reset    # șterge clubul demo și îl reface
 */
import fs from "node:fs";
import path from "node:path";
import { addDays, isoWeekday, todayIn, weekStart } from "../packages/shared/src";
import { ensureAccount, must, randomPassword, root, serviceClient } from "./lib";
import { seedLibrary } from "./seed-library";

const admin = serviceClient();
const SLUG = "club-demo";
const DOMAIN = process.env.DEMO_EMAIL_DOMAIN ?? "example.com";
const today = todayIn();

// generator determinist: aceleași date la fiecare rulare
let seed = 20261007;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
const between = (a: number, b: number) => Math.round(a + rnd() * (b - a));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const FIRST = ["Andrei", "Mihai", "Alexandru", "David", "Luca", "Matei", "Darius", "Rareș", "Tudor", "Vlad", "Robert", "Cristian", "Ianis", "Denis", "Paul", "Răzvan", "Sebastian", "Eric", "Bogdan", "Călin", "Ștefan", "Horia", "Sorin", "Victor", "Patrick", "Ovidiu"];
const LAST = ["Popescu", "Ionescu", "Mureșan", "Pop", "Rusu", "Moldovan", "Crișan", "Suciu", "Oltean", "Bălan", "Lazăr", "Toma", "Câmpean", "Ardelean", "Chirilă", "Dragomir", "Făgăraș", "Gherman", "Hațegan", "Jurcă", "Marian", "Neagu", "Onaca", "Petruș", "Roman", "Săvescu", "Trif", "Ungureanu", "Varga", "Zăgrean"];

if (process.argv.includes("--reset")) {
  const { data: old } = await admin.from("clubs").select("id").eq("slug", SLUG).maybeSingle();
  if (old) {
    const { data: users } = await admin.from("profiles").select("id").eq("club_id", old.id);
    await admin.from("clubs").delete().eq("id", old.id);
    for (const u of users ?? []) await admin.auth.admin.deleteUser(u.id);
    console.log("Clubul demo a fost șters.");
  }
}

let { data: club } = await admin.from("clubs").select("*").eq("slug", SLUG).maybeSingle();
const fresh = !club;
if (!club) {
  const id = must(await admin.rpc("setup_club", {
    p_slug: SLUG, p_name: "Club Demo", p_short_name: "Demo", p_groups: ["Seniori", "U19", "U17"],
    p_settings: { season_start: `${Number(today.slice(0, 4)) - (Number(today.slice(5, 7)) < 7 ? 1 : 0)}-07-01` },
  }), "setup_club");
  must(await admin.from("clubs").update({ primary_color: "#0f5132", accent_color: "#0f5132" }).eq("id", id).select("id"), "culori");
  club = must(await admin.from("clubs").select("*").eq("id", id).single(), "club");
}
const clubId = club.id;
const groups = must(await admin.from("groups").select("*").eq("club_id", clubId).order("sort"), "grupe");
const statuses = must(await admin.from("club_statuses").select("*").eq("club_id", clubId), "stări");
const st = (code: string) => statuses.find((s) => s.code === code)!.id;
const tests = must(await admin.from("fitness_tests").select("*").eq("club_id", clubId).order("sort"), "teste");

const exBySlug = await seedLibrary(SLUG);
const exercises = must(await admin.from("exercises").select("id, slug, category, zones").eq("club_id", clubId), "exerciții");

if (fresh) {
  // ---- jucători ---------------------------------------------------------------------
  const used = new Set<string>();
  type P = { id: string; group_id: string; name: string; birth: string; minor: boolean; base: number };
  const players: P[] = [];
  const birthYear = { Seniori: [1996, 2004], U19: [2007, 2008], U17: [2009, 2010] } as Record<string, [number, number]>;
  const positions = ["GK", "GK", "DEF", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "MID", "FWD", "FWD", "FWD"];
  for (const g of groups) {
    await admin.from("groups").update({ wellness_config: g.name === "Seniori" ? { sleep: true, stress: false, mood: false } : {} }).eq("id", g.id);
    for (let i = 0; i < 14; i++) {
      let name = "";
      do name = `${pick(LAST)} ${pick(FIRST)}`; while (used.has(name));
      used.add(name);
      const [y0, y1] = birthYear[g.name];
      const birth = `${between(y0, y1)}-${String(between(1, 12)).padStart(2, "0")}-${String(between(1, 28)).padStart(2, "0")}`;
      const [last, first] = name.split(" ");
      const row = must(await admin.from("players").insert({
        club_id: clubId, group_id: g.id, full_name: `${last} ${first}`, display_name: rnd() < 0.5 ? last.toUpperCase() : `${last.toUpperCase()} ${first[0]}.`,
        birth_date: birth, position: positions[i], dominant_foot: rnd() < 0.2 ? "left" : "right", shirt_number: i + 1 + (g.sort - 1) * 20,
        medical_visa_expires_on: addDays(today, between(-10, 170)), status_id: st("APT"),
      }).select("id").single(), "jucător");
      players.push({ id: row.id, group_id: g.id, name: `${last} ${first}`, birth, minor: Number(birth.slice(0, 4)) > Number(today.slice(0, 4)) - 18, base: between(3, 5) });
      must(await admin.from("player_contacts").insert({
        player_id: row.id, phone: `07${between(20, 79)} ${between(100, 999)} ${between(100, 999)}`,
        guardian_name: Number(birth.slice(0, 4)) >= 2008 ? `${last} ${pick(["Maria", "Ioana", "Elena", "Dan", "Marius", "Adrian"])}` : null,
        guardian_phone: Number(birth.slice(0, 4)) >= 2008 ? `07${between(20, 79)} ${between(100, 999)} ${between(100, 999)}` : null,
      }).select("player_id"), "contact");
    }
  }
  // istoricul de stare începe acum 12 săptămâni (pentru graficul de disponibilitate)
  await admin.from("status_history").update({ created_at: new Date(Date.parse(addDays(today, -84))).toISOString() }).in("player_id", players.map((p) => p.id));

  // ---- accidentări (deschise și închise) + stări curente ------------------------------------
  const zones = [
    { zone: "thigh_back", type: "muscle", dx: "Leziune musculară de gradul I, biceps femural" },
    { zone: "ankle", type: "ligament", dx: "Entorsă de gleznă, gradul II" },
    { zone: "knee", type: "ligament", dx: "Entorsă de genunchi, ligament colateral medial" },
    { zone: "groin", type: "muscle", dx: "Contractură a adductorilor" },
    { zone: "calf", type: "muscle", dx: "Contractură musculară, gambă" },
    { zone: "shoulder", type: "joint", dx: "Contuzie de umăr" },
    { zone: "foot", type: "bone", dx: "Fisură de metatarsian V" },
    { zone: "lower_back", type: "overuse", dx: "Lombalgie de suprasolicitare" },
  ] as const;
  const history = (player: string, status: string, daysAgo: number, extra: Record<string, unknown> = {}) =>
    admin.from("status_history").insert({ player_id: player, status_id: st(status), created_at: new Date(Date.parse(addDays(today, -daysAgo)) + 9 * 3600e3).toISOString(), ...extra });

  const injured = [...players].sort(() => rnd() - 0.5).slice(0, 13);
  for (let k = 0; k < injured.length; k++) {
    const p = injured[k];
    const z = pick(zones);
    const side = pick(["left", "right"] as const);
    const open = k < 5;
    const start = open ? between(3, 24) : between(30, 80);
    const duration = open ? null : between(6, 26);
    const inj = must(await admin.from("injuries").insert({
      player_id: p.id, zone: z.zone, side: z.zone === "lower_back" ? null : side, injury_type: z.type, diagnosis: z.dx,
      contact: pick(["contact", "non_contact", "non_contact"] as const), context: pick(["training", "match", "match"] as const),
      occurred_on: addDays(today, -start), severity: (duration ?? 20) <= 7 ? "minor" : (duration ?? 20) <= 28 ? "moderate" : "severe",
      expected_return_on: open ? addDays(today, between(2, 18)) : addDays(today, -start + (duration ?? 0)),
      actual_return_on: open ? null : addDays(today, -start + (duration ?? 0)),
      rtp_stage: open ? between(1, 3) : 5, notes: open ? "Evoluție bună; reevaluare la sfârșitul săptămânii." : null,
    }).select("id").single(), "accidentare");
    await admin.from("injury_treatments").insert([
      { injury_id: inj.id, treated_on: addDays(today, -start + 1), description: "Evaluare inițială, gheață, compresie, repaus relativ." },
      { injury_id: inj.id, treated_on: addDays(today, -start + 3), description: "Kinetoterapie: mobilizare activă, izometrie fără durere." },
    ]);
    await history(p.id, "ACC", start, { zone: z.zone, side });
    if (!open) {
      await history(p.id, "READAPTARE", start - Math.max(2, Math.round((duration ?? 6) * 0.6)), { zone: z.zone, side });
      await history(p.id, "APT", start - (duration ?? 6));
    } else {
      const readapt = k >= 3;
      if (readapt) await history(p.id, "READAPTARE", Math.max(1, Math.round(start / 3)), { zone: z.zone, side });
      must(await admin.from("players").update({
        status_id: st(readapt ? "READAPTARE" : "ACC"), status_zone: z.zone, status_side: z.zone === "lower_back" ? null : side,
        status_return_on: addDays(today, between(2, 18)), status_note: readapt ? "Alergare ușoară, fără contact." : null,
        training_restrictions: readapt ? "Fără sprinturi și fără dueluri." : "Indisponibil pentru antrenament.",
      }).eq("id", p.id).select("id"), "stare");
    }
  }
  const rest = players.filter((p) => !injured.slice(0, 5).includes(p)).sort(() => rnd() - 0.5);
  for (const p of rest.slice(0, 3)) await admin.from("players").update({ status_id: st("OBOSEALA"), status_note: "Încărcătură mare după ultimul meci." }).eq("id", p.id);
  await admin.from("players").update({ status_id: st("ALT_MOTIV"), status_note: "Răceală; revine joi." }).eq("id", rest[3].id);
  // recidivă
  const ids0 = players.map((p) => p.id);
  const firstClosed = must(await admin.from("injuries").select("id, player_id, zone, side").not("actual_return_on", "is", null).in("player_id", ids0).limit(1).single(), "recidivă");
  const openOfSame = await admin.from("injuries").select("id").is("actual_return_on", null).in("player_id", ids0).limit(1).single();
  if (openOfSame.data) await admin.from("injuries").update({ recurrence_of: firstClosed.id }).eq("id", openOfSame.data.id);

  // ---- chestionare, RPE, date GPS: 42 de zile -------------------------------------------------
  const wellness: Record<string, unknown>[] = [];
  const rpe: Record<string, unknown>[] = [];
  const sessions: Array<{ id: string; date: string; group: string; type: string }> = [];
  for (let d = 42; d >= 0; d--) {
    const date = addDays(today, -d);
    const wd = isoWeekday(date);
    const matchDay = wd === 6;
    const off = wd === 7;
    for (const g of groups) {
      if (off) continue;
      const s = must(await admin.from("physical_sessions").insert({
        club_id: clubId, group_id: g.id, session_date: date, session_type: matchDay ? "match" : "training",
        name: `${matchDay ? "Meci" : "Antrenament"} ${g.name}`, duration_min: matchDay ? 95 : between(70, 90), source: "ksport",
      }).select("id").single(), "sesiune");
      sessions.push({ id: s.id, date, group: g.id, type: matchDay ? "match" : "training" });
    }
    for (const p of players) {
      // unii jucători sar zile; azi a completat doar o parte
      if (rnd() < (d === 0 ? 0.45 : 0.12)) continue;
      const load = matchDay ? 2 : wd === 1 ? 1.5 : wd === 5 ? -1 : 0;
      const fatigue = clamp(Math.round(p.base + load + (rnd() - 0.5) * 3), 1, 10);
      const pain = rnd() < 0.06;
      wellness.push({
        player_id: p.id, entry_date: date, fatigue, muscle_load: clamp(fatigue + between(-2, 1), 1, 10),
        pain_zone: pain ? pick(["thigh_back", "knee", "ankle", "calf", "groin"]) : null, pain_side: pain ? pick(["left", "right"]) : null,
        pain_intensity: pain ? between(2, 6) : null,
        sleep_quality: groups.find((g) => g.id === p.group_id)!.name === "Seniori" ? between(5, 9) : null,
        sleep_hours: groups.find((g) => g.id === p.group_id)!.name === "Seniori" ? between(6, 9) : null,
        // datele vechi intră ca import, ca să nu genereze alerte pentru trecut
        source: d > 2 ? "import" : "app",
      });
      if (!off && rnd() < 0.8) {
        rpe.push({ player_id: p.id, entry_date: date, session_type: matchDay ? "match" : "training", rpe: clamp(Math.round((matchDay ? 8 : 5.5) + (rnd() - 0.5) * 3), 1, 10), duration_min: matchDay ? between(60, 95) : between(60, 90) });
      }
    }
  }
  for (let i = 0; i < wellness.length; i += 500) must(await admin.from("wellness_entries").insert(wellness.slice(i, i + 500) as never).select("id"), "chestionare");
  for (let i = 0; i < rpe.length; i += 500) must(await admin.from("rpe_entries").insert(rpe.slice(i, i + 500) as never).select("id"), "rpe");

  const metrics: Record<string, unknown>[] = [];
  for (const s of sessions) {
    for (const p of players.filter((x) => x.group_id === s.group)) {
      if (rnd() < 0.15) continue;
      const k = s.type === "match" ? 1.25 : 1;
      const dist = Math.round(between(4800, 7600) * k);
      metrics.push({
        session_id: s.id, player_id: p.id, duration_min: s.type === "match" ? between(60, 95) : between(65, 90), total_distance_m: dist,
        hsr_distance_m: Math.round(dist * (0.05 + rnd() * 0.05)), sprint_distance_m: Math.round(dist * (0.01 + rnd() * 0.02)),
        sprint_count: between(4, 22), max_speed_kmh: Math.round((27 + rnd() * 6) * 10) / 10, accelerations: between(25, 70), decelerations: between(22, 65),
        player_load: Math.round(dist / 12),
      });
    }
  }
  for (let i = 0; i < metrics.length; i += 500) must(await admin.from("physical_metrics").insert(metrics.slice(i, i + 500) as never).select("id"), "metrici");

  // ---- teste și antropometrie --------------------------------------------------------------------
  const results: Record<string, unknown>[] = [];
  const anthro: Record<string, unknown>[] = [];
  for (const p of players) {
    const h = between(168, 191);
    for (const [k, daysAgo] of [[0, 75], [1, 12]] as const) {
      anthro.push({ player_id: p.id, measured_on: addDays(today, -daysAgo), height_cm: h + (p.minor ? k : 0), weight_kg: between(58, 84) + k * 0.5, body_fat_pct: Math.round((9 + rnd() * 6) * 10) / 10 });
      for (const t of tests) {
        const base = { sprint_10: 1.78, sprint_30: 4.22, cmj: 38, yoyo_ir1: 1840, agility_505: 2.42 }[t.code] ?? 1;
        const spread = { sprint_10: 0.08, sprint_30: 0.15, cmj: 5, yoyo_ir1: 380, agility_505: 0.1 }[t.code] ?? 0.1;
        const improve = (t.lower_is_better ? -1 : 1) * spread * 0.15 * k;
        const v = base + (rnd() - 0.5) * 2 * spread + improve;
        results.push({ test_id: t.id, player_id: p.id, tested_on: addDays(today, -daysAgo), value: t.code === "yoyo_ir1" ? Math.round(v / 40) * 40 : Math.round(v * 100) / 100 });
      }
    }
  }
  must(await admin.from("anthropometrics").insert(anthro as never).select("id"), "antropometrie");
  for (let i = 0; i < results.length; i += 500) must(await admin.from("fitness_test_results").insert(results.slice(i, i + 500) as never).select("id"), "teste");

  // ---- programe alocate + planuri zilnice + bife ---------------------------------------------------
  const programs = must(await admin.from("programs").select("id, slug, program_exercises(id)").eq("club_id", clubId), "programe");
  const monday = weekStart(today);
  for (const [gi, g] of groups.entries()) {
    const pr = programs[gi % programs.length];
    if (!pr) break;
    const a = must(await admin.from("program_assignments").insert({
      club_id: clubId, program_id: pr.id, target_type: "group", group_id: g.id, start_date: addDays(monday, -21), weekdays: [1, 3, 5],
    }).select("id").single(), "alocare");
    const members = players.filter((p) => p.group_id === g.id);
    must(await admin.from("program_assignment_players").insert(members.map((p) => ({ assignment_id: a.id, player_id: p.id }))).select("player_id"), "alocare jucători");
    const comps: Record<string, unknown>[] = [];
    for (let d = 21; d >= 1; d--) {
      const date = addDays(today, -d);
      if (![1, 3, 5].includes(isoWeekday(date))) continue;
      for (const p of members) {
        const diligence = 0.35 + rnd() * 0.6;
        for (const pe of pr.program_exercises) if (rnd() < diligence) comps.push({ player_id: p.id, done_on: date, assignment_id: a.id, program_exercise_id: pe.id, done: true });
      }
    }
    for (let i = 0; i < comps.length; i += 500) must(await admin.from("exercise_completions").insert(comps.slice(i, i + 500) as never).select("id"), "bife");
  }
  // planuri de recuperare pentru accidentații activi: ieri, azi, mâine
  const recovery = exercises.filter((e) => ["recovery", "kinetotherapy", "mobility", "activation"].includes(e.category));
  const pool = recovery.length >= 3 ? recovery : exercises;
  const openInj = must(await admin.from("injuries").select("id, player_id, rtp_stage").is("actual_return_on", null).in("player_id", players.map((p) => p.id)), "acc. deschise");
  for (const inj of openInj) {
    for (const off of [-1, 0, 1]) {
      const plan = must(await admin.from("daily_plans").insert({
        player_id: inj.player_id, plan_date: addDays(today, off), title: "Recuperare", injury_id: inj.id, rtp_stage: inj.rtp_stage,
        notes: "Fără durere peste 3/10. Oprește-te și scrie-mi dacă apare durere ascuțită.",
      }).select("id").single(), "plan");
      const items = [...pool].sort(() => rnd() - 0.5).slice(0, Math.min(4, pool.length));
      must(await admin.from("daily_plan_items").insert(items.map((e, k) => ({ plan_id: plan.id, exercise_id: e.id, sort: k + 1, sets: 3, reps: pick(["10", "12", "8 pe fiecare parte"]), rest_sec: 45 }))).select("id"), "itemi");
    }
  }
  // trimitere către partenerul medical: se leagă mai jos, după crearea contului
}

// ---- conturi ---------------------------------------------------------------------------------------
const allPlayers = must(await admin.from("players").select("id, display_name, birth_date, group_id, user_id").eq("club_id", clubId).eq("is_active", true).order("created_at"), "jucători");
const adult = allPlayers.find((p) => p.birth_date && Number(p.birth_date.slice(0, 4)) <= Number(today.slice(0, 4)) - 19)!;
const minor = [...allPlayers].reverse().find((p) => p.birth_date && Number(p.birth_date.slice(0, 4)) >= Number(today.slice(0, 4)) - 16)!;
const { data: injuredOpen } = await admin.from("injuries").select("id, player_id").is("actual_return_on", null).in("player_id", allPlayers.map((p) => p.id)).limit(1).maybeSingle();
const injuredPlayer = allPlayers.find((p) => p.id === injuredOpen?.player_id) ?? adult;
const g = (name: string) => groups.find((x) => x.name === name)!.id;

const accounts: Array<{ key: string; full_name: string; role: Parameters<typeof ensureAccount>[1]["role"]; group_ids?: string[]; player_id?: string; note?: string }> = [
  { key: "patron", full_name: "Patron Demo", role: "owner" },
  { key: "director", full_name: "Director Sportiv Demo", role: "sporting_director" },
  { key: "preparator", full_name: "Preparator Fizic Demo", role: "physio" },
  { key: "antrenor", full_name: "Antrenor Seniori Demo", role: "coach", group_ids: [g("Seniori")] },
  { key: "antrenor.juniori", full_name: "Antrenor U19 + U17 Demo", role: "coach", group_ids: [g("U19"), g("U17")] },
  { key: "jucator", full_name: adult.display_name, role: "player", player_id: adult.id, note: "jucător adult" },
  { key: "jucator.accidentat", full_name: injuredPlayer.display_name, role: "player", player_id: injuredPlayer.id, note: "jucător cu plan de recuperare" },
  { key: "jucator.minor", full_name: minor.display_name, role: "player", player_id: minor.id, note: "jucător minor (acordul părintelui)" },
  { key: "partener", full_name: "Clinică Parteneră Demo", role: "medical_partner" },
];
const lines = [`## ${club.name}`, "", "| Rol | E-mail | Parolă |", "|---|---|---|"];
const ids: Record<string, string> = {};
for (const a of accounts) {
  const email = `${a.key}.demo@${DOMAIN}`;
  const password = process.env.DEMO_PASSWORD ?? randomPassword();
  ids[a.key] = await ensureAccount(admin, { email, password, full_name: a.full_name, role: a.role, club_id: clubId, group_ids: a.group_ids, player_id: a.player_id });
  lines.push(`| ${a.note ? `${a.full_name} — ${a.note}` : a.full_name} | ${email} | \`${password}\` |`);
}
if (injuredOpen) {
  const { data: has } = await admin.from("referrals").select("id").eq("partner_user_id", ids.partener).limit(1);
  if (!has?.length) {
    await admin.from("referrals").insert({ player_id: injuredOpen.player_id, partner_user_id: ids.partener, injury_id: injuredOpen.id, reason: "Ecografie de control", created_by: ids.preparator });
  }
}
await admin.rpc("refresh_daily_alerts", { p_club: clubId });

const out = path.join(root, "conturi-demo.local.md");
const header = "# Conturi demo\n\nGenerat de scripturile de seed. NU se pune în git. Schimbă parolele înainte de a da acces altcuiva.\n\n";
const existing = fs.existsSync(out) ? fs.readFileSync(out, "utf8") : header;
const section = lines.join("\n") + "\n";
const re = new RegExp(`## ${club.name}[\\s\\S]*?(?=\\n## |$)`);
fs.writeFileSync(out, re.test(existing) ? existing.replace(re, section) : existing + "\n" + section);
console.log(`Club Demo: ${allPlayers.length} jucători, ${accounts.length} conturi. Parolele sunt în conturi-demo.local.md.`);
