import "server-only";
import { addDays, localDate, localTime, type AppContext, type Db } from "@club/shared";
import { listEvents } from "./queries";

export type CheckState = "done" | "missing" | "pending";
export type CheckKey = "attendance" | "plan" | "ratings" | "report";

export type ActivityEvent = {
  id: string;
  kind: "training" | "match";
  date: string;
  time: string;
  opponent: string | null;
  checks: Partial<Record<CheckKey, CheckState>>;
};

export type TeamActivity = {
  id: string;
  name: string;
  coaches: string[];
  events: ActivityEvent[];
  totals: Record<CheckKey, { done: number; due: number }>;
};

const KEYS: CheckKey[] = ["attendance", "plan", "ratings", "report"];

/**
 * Activitatea antrenorilor într-o săptămână, pe echipe: prezența, planul și notele la antrenamente,
 * notele și raportul la meciuri. Un lucru e „lipsă” abia după momentul la care trebuia făcut
 * (planul înainte de început, restul după final); până atunci e „încă nu e momentul”.
 * Datele se citesc cu drepturile utilizatorului (RLS): antrenorul își vede doar echipele lui.
 */
export async function weekActivity(db: Db, ctx: AppContext, monday: string, groupIds: string[], now: number): Promise<TeamActivity[]> {
  const tz = ctx.settings.timezone;
  const events = (await listEvents(db, { from: monday, to: addDays(monday, 6), timezone: tz, groupIds }))
    .filter((e) => (e.kind === "training" || e.kind === "match") && e.status !== "cancelled");
  const matchIds = events.filter((e) => e.kind === "match").map((e) => e.id);
  const trainingIds = events.filter((e) => e.kind === "training").map((e) => e.id);

  const none = Promise.resolve({ data: [] as Array<Record<string, unknown>> });
  const [plans, tRatings, mRatings, reports, staff] = await Promise.all([
    trainingIds.length ? db.from("training_plans").select("event_id").in("event_id", trainingIds) : none,
    trainingIds.length ? db.from("training_ratings").select("event_id").in("event_id", trainingIds) : none,
    matchIds.length ? db.from("match_ratings").select("event_id").in("event_id", matchIds) : none,
    matchIds.length ? db.from("matches").select("event_id, report").in("event_id", matchIds) : none,
    db.from("staff_groups").select("group_id, profiles!inner(full_name, role, is_active)").in("group_id", groupIds),
  ]);
  const set = (r: { data: Array<Record<string, unknown>> | null }) => new Set((r.data ?? []).map((x) => x.event_id as string));
  const planned = set(plans), tRated = set(tRatings), mRated = set(mRatings);
  const reported = new Set((reports.data ?? []).filter((x) => typeof x.report === "string" && (x.report as string).trim()).map((x) => x.event_id as string));
  const coaches = new Map<string, string[]>();
  for (const s of (staff.data ?? []) as unknown as Array<{ group_id: string; profiles: { full_name: string; role: string; is_active: boolean } }>) {
    if (s.profiles.role !== "coach" || !s.profiles.is_active) continue;
    coaches.set(s.group_id, [...(coaches.get(s.group_id) ?? []), s.profiles.full_name]);
  }

  const state = (done: boolean, dueAt: string): CheckState => (done ? "done" : Date.parse(dueAt) <= now ? "missing" : "pending");
  const shaped = events.map((e) => {
    const checks: ActivityEvent["checks"] = e.kind === "training"
      ? {
          attendance: state(!!e.attendance_saved_at, e.ends_at),
          plan: state(planned.has(e.id), e.starts_at),
          ratings: state(tRated.has(e.id), e.ends_at),
        }
      : {
          ratings: state(mRated.has(e.id), e.ends_at),
          report: state(reported.has(e.id), e.ends_at),
        };
    return { groupIds: e.groupIds, ev: { id: e.id, kind: e.kind as "training" | "match", date: localDate(e.starts_at, tz), time: localTime(e.starts_at, tz), opponent: e.match?.opponent ?? null, checks } };
  });

  return ctx.groups.filter((g) => groupIds.includes(g.id)).map((g) => {
    const evs = shaped.filter((s) => s.groupIds.includes(g.id)).map((s) => s.ev);
    const totals = Object.fromEntries(KEYS.map((k) => {
      const relevant = evs.map((e) => e.checks[k]).filter((s): s is CheckState => !!s && s !== "pending");
      return [k, { done: relevant.filter((s) => s === "done").length, due: relevant.length }];
    })) as TeamActivity["totals"];
    return { id: g.id, name: g.name, coaches: coaches.get(g.id) ?? [], events: evs, totals };
  });
}
