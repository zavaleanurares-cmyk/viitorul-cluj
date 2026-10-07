/**
 * Test diferențial: aceleași cereri trimise către PostgREST real și către stratul REST din proces
 * trebuie să dea același rezultat. Se rulează doar acolo unde există un PostgREST local
 * (PGRST_URL + PGRST_JWT_SECRET); a fost folosit la scrierea stratului.
 *
 *   PGRST_URL=http://localhost:3001 PGRST_JWT_SECRET=... DATABASE_URL=... npx tsx packages/db/test/differential.ts
 */
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { PostgrestClient } from "@supabase/postgrest-js";
import { addDays, getAppContext, getPlayerCalendar, getPlayerDay, listPlayers, listWellness, todayIn, type Database } from "@club/shared";
import { closePool, createDb, getPool } from "../src";

const PGRST = process.env.PGRST_URL!;
const SECRET = process.env.PGRST_JWT_SECRET!;
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
function jwt(sub: string) {
  const h = b64({ alg: "HS256", typ: "JWT" });
  const p = b64({ sub, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 });
  return `${h}.${p}.${crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url")}`;
}

type Recorded = { method: string; url: string; headers: Record<string, string>; body?: string };
let diffs = 0;
let checked = 0;

function clients(sub: string) {
  const log: Recorded[] = [];
  const inner = createDb({ sub, role: "authenticated" });
  // client care înregistrează cererile și compară răspunsurile cu PostgREST
  const recording = new PostgrestClient<Database>("http://db.local/rest", {
    retry: false,
    fetch: async (input, init) => {
      const url = new URL(String(input));
      const headers: Record<string, string> = {};
      new Headers(init?.headers).forEach((v, k) => (headers[k] = v));
      const mine = await (inner as unknown as { fetch: typeof fetch }).fetch(input, init);
      const mineText = await mine.clone().text();
      const theirs = await fetch(PGRST + url.pathname.replace(/^\/rest/, "") + url.search, {
        method: init?.method, body: init?.body as string | undefined,
        headers: { ...headers, authorization: `Bearer ${jwt(sub)}` },
      });
      const theirText = await theirs.text();
      checked++;
      const label = `${init?.method ?? "GET"} ${decodeURIComponent(url.pathname + url.search).slice(0, 170)}`;
      let same = mine.status === theirs.status || (mine.status < 300 && theirs.status < 300);
      if (same) {
        try {
          const a = mineText ? JSON.parse(mineText) : null;
          const b = theirText ? JSON.parse(theirText) : null;
          if (mine.status >= 300) assert.equal(a?.code, b?.code);
          else if (url.pathname.endsWith("export_player_data")) assert.deepStrictEqual({ ...a, exportat_la: 0 }, { ...b, exportat_la: 0 });
          else assert.deepStrictEqual(a, b);
          if ((headers.prefer ?? "").includes("count=")) assert.equal(mine.headers.get("content-range"), theirs.headers.get("content-range"));
        } catch (e) {
          same = false;
          console.log(`✗ ${label}\n   ${(e as Error).message.split("\n").slice(0, 12).join("\n   ")}`);
        }
      } else console.log(`✗ ${label}\n   stare ${mine.status} (al nostru) vs ${theirs.status} (PostgREST)\n   ${mineText.slice(0, 200)}\n   ${theirText.slice(0, 200)}`);
      if (!same) diffs++;
      log.push({ method: init?.method ?? "GET", url: url.pathname + url.search, headers, body: init?.body as string | undefined });
      return mine;
    },
  });
  return recording;
}

const pool = getPool();
const one = async (sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows[0];
const club = await one("select id from clubs where slug = 'club-demo'");
const user = async (role: string) => (await one("select id from profiles where club_id = $1 and role = $2 order by created_at limit 1", [club.id, role])).id as string;
const physio = await user("physio");
const coach = await user("coach");
const director = await user("sporting_director");
const owner = await user("owner");
const partner = await user("medical_partner");
const playerRow = await one("select p.id, p.user_id, p.group_id from players p join injuries i on i.player_id = p.id and i.actual_return_on is null where p.club_id = $1 and p.user_id is not null limit 1", [club.id]);
const today = todayIn();

for (const [name, sub] of [["physio", physio], ["coach", coach], ["director", director], ["owner", owner], ["partner", partner], ["player", playerRow.user_id]] as const) {
  console.log(`— ${name}`);
  const db = clients(sub) as never as ReturnType<typeof createDb>;
  await getAppContext(db, sub);
  const players = await listPlayers(db).catch(() => []);
  await listPlayers(db, { groupId: playerRow.group_id, includeInactive: true }).catch(() => []);
  await getPlayerDay(db, playerRow.id, today);
  await getPlayerCalendar(db, playerRow.id, addDays(today, -7), addDays(today, 7));
  await listWellness(db, players.slice(0, 20).map((p) => p.id), addDays(today, -7), today);
  await db.from("players").select("id, display_name, groups(name), club_statuses(code, label)").order("display_name").limit(5);
  await db.from("players").select("id, groups!inner(name)").eq("groups.name", "Seniori").order("id").limit(5);
  await db.from("groups").select("id, name, players(count)").order("sort");
  await db.from("injuries").select("*, injury_treatments(*), players!inner(display_name, group_id)").order("occurred_on", { ascending: false }).order("id");
  await db.from("injuries").select("id, zone, players(display_name, groups(name))").is("actual_return_on", null).order("id");
  await db.from("injuries").select("id").or(`actual_return_on.is.null,id.eq.${crypto.randomUUID()}`).order("id");
  await db.from("injuries").select("id", { count: "exact", head: true }).not("actual_return_on", "is", null);
  await db.from("wellness_entries").select("id, fatigue, entry_date", { count: "exact" }).gte("entry_date", addDays(today, -3)).lte("entry_date", today).order("entry_date").order("id").range(0, 9);
  await db.from("wellness_entries").select("fatigue, muscle_load").eq("player_id", playerRow.id).order("entry_date", { ascending: false }).limit(1).maybeSingle();
  await db.from("players").select("*").eq("id", playerRow.id).single();
  await db.from("players").select("*").eq("id", crypto.randomUUID()).single();
  await db.from("players").select("id").in("id", [playerRow.id, crypto.randomUUID()]);
  await db.from("players").select("id, display_name").like("display_name", "A%").order("id");
  await db.from("players").select("id").ilike("full_name", "%escu%").neq("position", "GK").order("id");
  await db.from("exercises").select("id, name, zones").contains("zones", ["glute"]).order("id");
  await db.from("exercises").select("id").overlaps("zones", ["knee", "glute"]).order("id");
  await db.from("programs").select("id, name, program_exercises(id, sort, exercises(name)), program_assignments(id, is_active, program_assignment_players(player_id))").order("name").order("sort", { referencedTable: "program_exercises" });
  await db.from("daily_plans").select("id, plan_date, daily_plan_items(id, exercise_completions(done))").eq("player_id", playerRow.id).order("plan_date");
  await db.from("referrals").select("id, reason, players(display_name), profiles!referrals_partner_user_id_fkey(full_name)").order("id");
  await db.from("referrals").select("id, profiles(full_name)").order("id");
  await db.from("clubs").select("name, settings->timezone, tz:settings->>timezone");
  await db.from("clubs").select("id").eq("settings->>timezone", "Europe/Bucharest");
  await db.from("notifications").select("*").order("created_at", { ascending: false }).limit(20);
  await db.from("audit_log").select("id, action, entity").order("id", { ascending: false }).limit(5);
  await db.from("no_such_table" as never).select("*");
  await db.from("players").select("nope" as never);
  await db.rpc("club_overview");
  await db.rpc("group_test_averages", { p_group: playerRow.group_id });
  await db.rpc("export_player_data", { p_player: playerRow.id });
  await db.rpc("players_past_retention");
  await db.rpc("log_medical_access", { p_player: playerRow.id, p_section: "fisa" });
  await db.rpc("refresh_daily_alerts", {});
  // scrieri pe un tabel fără efecte laterale (tokenuri push ale utilizatorului curent)
  await db.from("push_tokens").delete().eq("user_id", sub);
  const tok = `t-${crypto.randomBytes(4).toString("hex")}`;
  // (fiecare scriere rulează de două ori — o dată la noi, o dată la PostgREST — deci comparăm doar forma)
}
// Scrieri: verificate separat, doar prin stratul nostru, cu citire înapoi.
{
  const db = createDb({ sub: physio, role: "authenticated" });
  const tok = `t-${crypto.randomBytes(4).toString("hex")}`;
  const ins = await db.from("push_tokens").insert({ user_id: physio, token: tok, platform: "web" }).select().single();
  assert.equal(ins.error, null); assert.equal(ins.data!.token, tok);
  const dup = await db.from("push_tokens").insert({ user_id: physio, token: tok });
  assert.equal(dup.error?.code, "23505");
  const ups = await db.from("push_tokens").upsert({ user_id: physio, token: tok, platform: "ios" }, { onConflict: "user_id,token" }).select("platform");
  assert.deepEqual(ups.data, [{ platform: "ios" }]);
  const ign = await db.from("push_tokens").upsert({ user_id: physio, token: tok, platform: "android" }, { onConflict: "user_id,token", ignoreDuplicates: true }).select("platform");
  assert.deepEqual(ign.data, []);
  const many = await db.from("push_tokens").insert([{ user_id: physio, token: tok + "a" }, { user_id: physio, token: tok + "b", platform: "web" }]).select("token, platform").order("token");
  assert.deepEqual(many.data, [{ token: tok + "a", platform: null }, { token: tok + "b", platform: "web" }]);
  const upd = await db.from("push_tokens").update({ platform: "android" }).eq("user_id", physio).like("token", tok + "%").select("id");
  assert.equal(upd.data!.length, 3);
  const foreign = await db.from("push_tokens").insert({ user_id: coach, token: tok });
  assert.equal(foreign.error?.code, "42501");
  const none = await db.from("push_tokens").update({ platform: "web" }).eq("user_id", coach).select("id");
  assert.deepEqual(none.data, []);
  const del = await db.from("push_tokens").delete().eq("user_id", physio).select("id");
  assert.equal(del.data!.length, 3);
  const cnt = await db.from("push_tokens").select("id", { count: "exact", head: true }).eq("user_id", physio);
  assert.equal(cnt.count, 0);
  // o eroare anulează tranzacția: nimic nu rămâne scris
  const bad = await db.from("push_tokens").insert([{ user_id: physio, token: "x1" }, { user_id: coach, token: "x2" }]);
  assert.ok(bad.error);
  assert.equal((await db.from("push_tokens").select("id", { count: "exact", head: true }).eq("user_id", physio)).count, 0);
  console.log("— scrieri: ok");
}
console.log(`\n${checked} cereri comparate, ${diffs} diferențe.`);
await closePool();
process.exit(diffs ? 1 : 0);
