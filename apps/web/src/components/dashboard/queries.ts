import "server-only";
import {
  addDays, DataError, diffDays, friendlyError, listPlayers, unwrap,
  type AppContext, type ClubStatus, type Db, type PlayerListItem,
} from "@club/shared";
import { assignmentAdherence, assignmentState, type CompletionRow } from "@/components/planning/adherence";
import { parseOverview, type Overview } from "./overview";

type Res<T> = { data: T[] | null; error: { message: string; code?: string } | null };

/** Citește toate rândurile, pe pagini (un răspuns este limitat la 1000 de rânduri). */
export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<Res<T>>, size = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new DataError(friendlyError(error), error.code);
    out.push(...(data ?? []));
    if (!data || data.length < size) return out;
  }
}

/** Cifrele de ansamblu. Singura sursă de date a patronului: RPC-ul întoarce doar agregate. */
export async function getOverview(db: Db): Promise<Overview | null> {
  const { data, error } = await db.rpc("club_overview");
  if (error) {
    console.error("[tablou] club_overview:", error.message);
    return null;
  }
  return parseOverview(data);
}

export type Severity = "critical" | "warning" | "info";
export const SEVERITIES: Severity[] = ["critical", "warning", "info"];

export type AlertItem = {
  id: string; playerId: string; playerName: string; kind: string; severity: Severity; date: string; message: string;
};

export type GroupWellness = { id: string; name: string; total: number; done: number };
export type ReturnItem = { id: string; name: string; groupName: string | null; status: ClubStatus | null; returnOn: string; daysLeft: number };
export type VisaItem = { id: string; name: string; groupName: string | null; expiresOn: string; daysLeft: number };
export type AdherenceItem = {
  assignmentId: string; programId: string; programName: string;
  targetType: string; groupName: string | null;
  players: number; percent: number | null; under50: number;
};

export type PhysioDay = {
  alerts: AlertItem[];
  wellness: GroupWellness[];
  returns: ReturnItem[];
  visas: VisaItem[];
  adherence: AdherenceItem[];
  reviewPlayers: number;
  reviewWellness: number;
  gdprOpen: number;
};

const COMPLETION_COLUMNS = "player_id, done_on, assignment_id, program_exercise_id, done, comment, pain, pain_intensity";

/** Tot ce are de făcut preparatorul azi. Rulează cu clientul lui (RLS). */
export async function getPhysioDay(db: Db, ctx: AppContext): Promise<PhysioDay> {
  const today = ctx.today;
  const weekAgo = addDays(today, -6);

  const [players, alertsRes, entriesToday, reviewWellness, gdpr, assignmentsRes] = await Promise.all([
    listPlayers(db),
    db.from("alerts").select("id, player_id, kind, severity, alert_date, message, players ( display_name )")
      .is("resolved_at", null).order("alert_date", { ascending: false }).order("created_at", { ascending: false }).limit(300),
    db.from("wellness_entries").select("player_id").eq("entry_date", today),
    db.from("wellness_entries").select("id", { count: "exact", head: true }).eq("needs_review", true),
    db.from("data_requests").select("id", { count: "exact", head: true }).eq("status", "open"),
    db.from("program_assignments")
      .select("id, program_id, target_type, group_id, start_date, end_date, weekdays, is_active, programs!inner ( id, name, program_exercises ( id ) ), program_assignment_players ( player_id )")
      .eq("is_active", true).order("created_at", { ascending: false }),
  ]);

  const groups = ctx.groups.filter((g) => g.is_active);
  const groupName = new Map(ctx.groups.map((g) => [g.id, g.name]));
  const statusById = new Map(ctx.statuses.map((s) => [s.id, s]));
  const activeIds = new Set(players.map((p) => p.id));

  // alerte
  const sevRank = (s: string) => (s === "critical" ? 0 : s === "warning" ? 1 : 2);
  const alerts: AlertItem[] = unwrap(alertsRes)
    .filter((a) => activeIds.has(a.player_id))
    .map((a) => ({
      id: a.id, playerId: a.player_id, playerName: a.players?.display_name ?? "—", kind: a.kind,
      severity: (a.severity === "critical" || a.severity === "info" ? a.severity : "warning") as Severity,
      date: a.alert_date, message: a.message,
    }))
    .sort((x, y) => sevRank(x.severity) - sevRank(y.severity) || y.date.localeCompare(x.date) || x.playerName.localeCompare(y.playerName, "ro"));

  // chestionare completate azi, pe grupe
  const doneToday = new Set(unwrap(entriesToday).map((e) => e.player_id));
  const wellness: GroupWellness[] = groups
    .map((g) => {
      const inGroup = players.filter((p) => p.group_id === g.id);
      return { id: g.id, name: g.name, total: inGroup.length, done: inGroup.filter((p) => doneToday.has(p.id)).length };
    })
    .filter((g) => g.total > 0);

  // reveniri: doar jucătorii care nu sunt deja complet disponibili
  const limit = addDays(today, 7);
  const returns: ReturnItem[] = players
    .filter((p): p is PlayerListItem & { status_return_on: string } => !!p.status_return_on && p.status_return_on <= limit)
    .map((p) => ({ p, status: p.status_id ? statusById.get(p.status_id) ?? null : null }))
    .filter(({ status }) => status?.availability !== "full")
    .map(({ p, status }) => ({
      id: p.id, name: p.display_name, groupName: p.group_id ? groupName.get(p.group_id) ?? null : null, status,
      returnOn: p.status_return_on, daysLeft: diffDays(today, p.status_return_on),
    }))
    .sort((a, b) => a.returnOn.localeCompare(b.returnOn) || a.name.localeCompare(b.name, "ro"));

  // vize medicale
  const visaLimit = addDays(today, ctx.settings.alerts.visa_days_before);
  const visas: VisaItem[] = players
    .filter((p): p is PlayerListItem & { medical_visa_expires_on: string } => !!p.medical_visa_expires_on && p.medical_visa_expires_on <= visaLimit)
    .map((p) => ({
      id: p.id, name: p.display_name, groupName: p.group_id ? groupName.get(p.group_id) ?? null : null,
      expiresOn: p.medical_visa_expires_on, daysLeft: diffDays(today, p.medical_visa_expires_on),
    }))
    .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn) || a.name.localeCompare(b.name, "ro"));

  // aderența pe ultimele 7 zile, pe alocările în desfășurare
  const running = unwrap(assignmentsRes).filter((a) => assignmentState(a, today) === "active");
  const completions = running.length
    ? await fetchAll<CompletionRow>((from, to) =>
        db.from("exercise_completions").select(COMPLETION_COLUMNS)
          .in("assignment_id", running.map((a) => a.id)).gte("done_on", weekAgo).lte("done_on", today).order("id").range(from, to))
    : [];
  const adherence: AdherenceItem[] = running.map((a) => {
    const playerIds = a.program_assignment_players.map((p) => p.player_id).filter((id) => activeIds.has(id));
    const exerciseIds = a.programs.program_exercises.map((e) => e.id);
    // fereastra de 7 zile: aceeași regulă de calcul ca în pagina programului, pornită de la max(început, azi − 6)
    const windowStart = a.start_date > weekAgo ? a.start_date : weekAgo;
    const res = assignmentAdherence(
      { id: a.id, start_date: windowStart, end_date: a.end_date, weekdays: a.weekdays, playerIds }, exerciseIds, completions, today, 1,
    );
    let under50 = 0;
    for (const p of res.byPlayer.values()) if (p.percent !== null && p.percent < 50) under50++;
    return {
      assignmentId: a.id, programId: a.programs.id, programName: a.programs.name, targetType: a.target_type,
      groupName: a.group_id ? groupName.get(a.group_id) ?? null : null,
      players: playerIds.length, percent: res.percent, under50,
    };
  }).filter((a) => a.players > 0);

  return {
    alerts, wellness, returns, visas, adherence,
    reviewPlayers: players.filter((p) => p.needs_review).length,
    reviewWellness: reviewWellness.count ?? 0,
    gdprOpen: gdpr.count ?? 0,
  };
}
