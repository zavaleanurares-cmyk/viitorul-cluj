/**
 * Date demonstrative pentru Locker Room faza 2 (lot și program) în „Club Demo":
 * terenuri, competiții, antrenamente recurente (trei săptămâni în urmă, cinci înainte), meciuri jucate
 * și programate, prezență, o suspendare activă, părinți. Idempotent: nu dublează dacă există deja evenimente.
 */
import type { Db } from "@club/db";
import { addDays, isoWeekday, todayIn, zonedToUtc, type TablesInsert } from "@club/shared";
import { must } from "./common";

let seed = 20261015;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
const between = (a: number, b: number) => Math.round(a + rnd() * (b - a));

const OPPONENTS = ["AS Nordica", "CS Valea Verde", "FC Dealul Mare", "Unirea Podgoria", "Sportul Lunca", "Olimpia Sud", "Viitorul Est", "Progresul Vest", "Avântul Colinei", "Recolta Câmpiei"];

type TeamPlan = { name: string; weekdays: number[]; time: string; minutes: number; venue: string; matchDay: number; matchTime: string; competition: string; half: number; yellow: number };
const PLANS: TeamPlan[] = [
  { name: "Seniori", weekdays: [1, 2, 3, 4, 5], time: "18:00", minutes: 90, venue: "Teren 1", matchDay: 6, matchTime: "11:00", competition: "Liga a III-a · Seria 6", half: 45, yellow: 5 },
  { name: "U19", weekdays: [2, 3, 4, 5], time: "16:30", minutes: 90, venue: "Teren 2", matchDay: 7, matchTime: "11:00", competition: "Liga Elite U19", half: 45, yellow: 3 },
  { name: "U17", weekdays: [1, 3, 5], time: "16:00", minutes: 90, venue: "Teren 2", matchDay: 7, matchTime: "13:30", competition: "Liga Elite U17", half: 40, yellow: 3 },
];

export async function seedLotDemo(admin: Db, clubId: string, ids: Record<string, string>): Promise<void> {
  seed = 20261015;
  const today = todayIn();
  const tz = "Europe/Bucharest";

  // ---- terenuri ---------------------------------------------------------------------------
  let venues = must(await admin.from("venues").select("id, name").eq("club_id", clubId), "terenuri");
  if (!venues.length) {
    venues = must(await admin.from("venues").insert([
      { club_id: clubId, name: "Teren 1", surface: "synthetic", has_lights: true, address: "Baza sportivă a clubului", sort: 1 },
      { club_id: clubId, name: "Teren 2", surface: "natural", has_lights: false, address: "Baza sportivă a clubului", sort: 2 },
      { club_id: clubId, name: "Sala de forță", surface: "indoor", has_lights: true, address: "Baza sportivă a clubului", sort: 3 },
    ]).select("id, name"), "terenuri noi");
  }
  const venue = (n: string) => venues.find((v) => v.name === n)?.id ?? null;

  const groups = must(await admin.from("groups").select("id, name").eq("club_id", clubId), "grupe");
  const { data: season } = await admin.from("seasons").select("id").eq("club_id", clubId).eq("is_current", true).maybeSingle();
  for (const p of PLANS) {
    const g = groups.find((x) => x.name === p.name);
    if (!g) continue;
    await admin.from("groups").update({ players_on_pitch: 11, half_minutes: p.half, season_id: season?.id ?? null, gender: "m" }).eq("id", g.id);
  }

  // ---- părinți (din contactele vechi) + contul demo de părinte ----------------------------
  const { count: guardianCount } = await admin.from("guardians").select("id", { count: "exact", head: true }).eq("club_id", clubId);
  if (!guardianCount) {
    const contacts = must(await admin.from("player_contacts").select("player_id, guardian_name, guardian_phone, guardian_email, players!inner(club_id)").eq("players.club_id", clubId).not("guardian_name", "is", null), "contacte");
    for (const c of contacts) {
      const g = must(await admin.from("guardians").insert({ club_id: clubId, full_name: c.guardian_name!, phone: c.guardian_phone, email: c.guardian_email }).select("id").single(), "părinte");
      await admin.from("guardian_players").insert({ guardian_id: g.id, player_id: c.player_id, is_billing: true });
    }
  }
  if (ids.parinte && ids["jucator.minor"]) {
    const { data: minor } = await admin.from("players").select("id").eq("user_id", ids["jucator.minor"]).maybeSingle();
    if (minor) {
      const { data: link } = await admin.from("guardian_players").select("guardian_id").eq("player_id", minor.id).limit(1).maybeSingle();
      if (link) await admin.from("guardians").update({ user_id: ids.parinte, email: "parinte.demo@example.com" }).eq("id", link.guardian_id);
      else {
        const g = must(await admin.from("guardians").insert({ club_id: clubId, full_name: "Părinte Demo", user_id: ids.parinte, email: "parinte.demo@example.com" }).select("id").single(), "părinte demo");
        await admin.from("guardian_players").insert({ guardian_id: g.id, player_id: minor.id, is_billing: true });
      }
    }
  }

  // ---- program: doar dacă nu există deja ---------------------------------------------------
  const { count: eventCount } = await admin.from("events").select("id", { count: "exact", head: true }).eq("club_id", clubId);
  if (eventCount) return;

  const statuses = must(await admin.from("club_statuses").select("id, availability").eq("club_id", clubId), "stări");
  const outIds = new Set(statuses.filter((s) => s.availability === "out").map((s) => s.id));
  const from = addDays(today, -21);
  const until = addDays(today, 35);
  const creator = ids.secretariat ?? null;

  for (const plan of PLANS) {
    const g = groups.find((x) => x.name === plan.name);
    if (!g) continue;
    const players = must(await admin.from("players").select("id, status_id, shirt_number, position").eq("group_id", g.id).eq("is_active", true).order("shirt_number"), "jucători");

    // antrenamente recurente
    const series = must(await admin.from("event_series").insert({
      club_id: clubId, kind: "training", title: `Antrenament ${plan.name}`, weekdays: plan.weekdays, start_time: plan.time,
      duration_min: plan.minutes, venue_id: venue(plan.venue), starts_on: from, until, group_ids: [g.id], created_by: creator,
    }).select("id").single(), "serie");
    for (let d = from; d <= until; d = addDays(d, 1)) {
      if (!plan.weekdays.includes(isoWeekday(d))) continue;
      const startsAt = zonedToUtc(d, plan.time, tz);
      const past = d < today;
      const ev = must(await admin.from("events").insert({
        club_id: clubId, kind: "training", title: `Antrenament ${plan.name}`, starts_at: startsAt,
        ends_at: new Date(Date.parse(startsAt) + plan.minutes * 60000).toISOString(), venue_id: venue(plan.venue),
        series_id: series.id, status: past ? "done" : "scheduled", created_by: creator,
        attendance_saved_at: past ? new Date(Date.parse(startsAt) + 20 * 60000).toISOString() : null,
      }).select("id").single(), "antrenament");
      await admin.from("event_teams").insert({ event_id: ev.id, group_id: g.id });
      if (past) {
        must(await admin.from("attendance").insert(players.map((p) => {
          const injured = p.status_id && outIds.has(p.status_id);
          const r = rnd();
          const status = injured ? "injured" : r < 0.86 ? "present" : r < 0.9 ? "late" : "absent";
          return {
            event_id: ev.id, player_id: p.id, status, reason: status === "absent" ? pick(["sick", "school", "family", "unexcused"] as const) : injured ? "injured" : null,
            recorded_by: creator, recorded_at: new Date(Date.parse(startsAt) + 15 * 60000).toISOString(),
          };
        })).select("player_id"), "prezență");
      }
    }

    // competiția și meciurile
    const comp = must(await admin.from("competitions").insert({
      club_id: clubId, season_id: season?.id ?? null, group_id: g.id, name: plan.competition, source: plan.name === "Seniori" ? "frf" : "frf",
      half_minutes: plan.half, yellow_limit: plan.yellow, own_name: "Club Demo",
    }).select("id").single(), "competiție");
    let round = 6;
    for (let d = from; d <= until; d = addDays(d, 1)) {
      if (isoWeekday(d) !== plan.matchDay) continue;
      round++;
      const oppName = OPPONENTS[(round + plan.name.length) % OPPONENTS.length];
      const existing = (await admin.from("opponents").select("id").eq("club_id", clubId).eq("name", oppName).maybeSingle()).data;
      const opp = existing ?? must(await admin.from("opponents").insert({ club_id: clubId, name: oppName }).select("id").single(), "adversar");
      const home = round % 2 === 0;
      const startsAt = zonedToUtc(d, plan.matchTime, tz);
      const past = d < today;
      const ev = must(await admin.from("events").insert({
        club_id: clubId, kind: "match", title: oppName, starts_at: startsAt, ends_at: new Date(Date.parse(startsAt) + 2 * 3600000).toISOString(),
        venue_id: home ? venue("Teren 1") : null, notes: home ? null : `Deplasare: stadionul ${oppName}`, status: past ? "done" : "scheduled", created_by: creator,
      }).select("id").single(), "meci");
      await admin.from("event_teams").insert({ event_id: ev.id, group_id: g.id });
      must(await admin.from("matches").insert({
        event_id: ev.id, competition_id: comp.id, opponent_id: opp.id, round: String(round), is_home: home,
        external_key: `${round}|${oppName.toLowerCase()}|${home ? "h" : "a"}`, status: past ? "finished" : "scheduled",
        formation: past ? "4-3-3" : null, closed_at: past ? new Date(Date.parse(startsAt) + 2 * 3600000).toISOString() : null,
      }).select("event_id"), "detalii meci");
      if (!past) continue;

      const available = players.filter((p) => !(p.status_id && outIds.has(p.status_id)));
      const starters = available.slice(0, 11);
      const subs = available.slice(11, 16);
      const total = plan.half * 2;
      const nSubs = Math.max(0, Math.min(3, subs.length, starters.length - 8));
      const subMinutes = subs.slice(0, nSubs).map(() => between(55, 80));
      const squadRows = [
        ...starters.map((p, i) => ({ event_id: ev.id, player_id: p.id, role: "starter", slot: i as number | null, is_captain: i === 4, minutes: i >= 8 && i - 8 < nSubs ? subMinutes[i - 8] : total, rating: between(2, 5) as number | null })),
        ...subs.map((p, i) => ({ event_id: ev.id, player_id: p.id, role: "sub", slot: null as number | null, is_captain: false, minutes: i < nSubs ? total - subMinutes[i] : 0, rating: i < nSubs ? between(2, 4) : null })),
      ];
      must(await admin.from("match_squad").insert(squadRows.map(({ rating: _r, ...row }) => row)).select("player_id"), "lot meci");
      must(await admin.from("match_ratings").insert(squadRows.filter((r) => r.rating !== null).map((r) => ({ event_id: r.event_id, player_id: r.player_id, rating: r.rating! }))).select("player_id"), "note meci");
      const goalsFor = between(0, 3);
      const goalsAgainst = between(0, 2);
      const events: TablesInsert<"match_events">[] = [];
      for (let k = 0; k < goalsFor; k++) events.push({ event_id: ev.id, minute: between(5, total - 2), kind: "goal", player_id: pick(starters.slice(5)).id, related_player_id: pick(starters.slice(3, 8)).id, created_by: creator });
      for (let k = 0; k < goalsAgainst; k++) events.push({ event_id: ev.id, minute: between(5, total - 2), kind: "goal_against", created_by: creator });
      for (let k = 0; k < nSubs; k++) events.push({ event_id: ev.id, minute: subMinutes[k], kind: "sub", player_id: starters[8 + k].id, related_player_id: subs[k].id, created_by: creator });
      events.push({ event_id: ev.id, minute: between(20, total - 5), kind: "yellow", player_id: pick(starters.slice(1, 8)).id, created_by: creator });
      must(await admin.from("match_events").insert(events.map((e) => ({ player_id: null, related_player_id: null, ...e }))).select("id"), "evenimente meci");
      await admin.from("matches").update({ goals_for: goalsFor, goals_against: goalsAgainst }).eq("event_id", ev.id);
    }

    // o suspendare activă, ca să se vadă blocarea la convocare
    const suspended = players.find((p) => !(p.status_id && outIds.has(p.status_id)) && p.position === "MID");
    if (suspended) {
      await admin.from("suspensions").insert({ club_id: clubId, player_id: suspended.id, competition_id: comp.id, reason: `${plan.yellow} cartonașe galbene`, matches_total: 1, matches_remaining: 1 });
    }
  }
}
