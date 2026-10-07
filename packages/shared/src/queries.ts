/**
 * Acces la date comun pentru web și aplicația nativă.
 * Toate funcțiile primesc clientul Supabase al utilizatorului curent; ce întorc este
 * deja filtrat de RLS. Nicio funcție de aici nu folosește cheia de serviciu.
 */
import { DataError, friendlyError, unwrap, type Db } from "./client";
import type { Tables } from "./database.types";
import { parseSettings, parseWellnessConfig, type ClubSettings, type WellnessConfig } from "./settings";
import { addDays, todayIn } from "./dates";
import { isScheduledOn } from "./load";
import type { AppRole } from "./roles";
import { CONSENT_VERSION } from "./consent";

export type Club = Tables<"clubs">;
export type Group = Tables<"groups">;
export type ClubStatus = Tables<"club_statuses">;
export type Profile = Tables<"profiles">;
export type Player = Tables<"players">;
export type Exercise = Tables<"exercises">;
export type Injury = Tables<"injuries">;
export type WellnessEntry = Tables<"wellness_entries">;
export type Notification = Tables<"notifications">;

export type AppContext = {
  userId: string;
  profile: Profile;
  role: AppRole;
  club: Club;
  settings: ClubSettings;
  today: string;
  groups: Group[];
  statuses: ClubStatus[];
  /** grupele antrenorului (gol pentru celelalte roluri) */
  staffGroupIds: string[];
  /** fișa jucătorului, dacă utilizatorul este jucător */
  player: Player | null;
  consentAccepted: boolean;
  /** jucător minor fără acordul părintelui/tutorelui înregistrat */
  guardianConsentMissing: boolean;
};

/** Tot ce trebuie aplicației ca să știe cine este utilizatorul și ce vede. Întoarce null dacă nu există profil activ. */
export async function getAppContext(db: Db, userId: string): Promise<AppContext | null> {
  const { data: profile } = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (!profile || !profile.is_active) return null;
  const [club, groups, statuses, staffGroups, player, consents] = await Promise.all([
    db.from("clubs").select("*").eq("id", profile.club_id).single(),
    db.from("groups").select("*").eq("club_id", profile.club_id).order("sort").order("name"),
    db.from("club_statuses").select("*").eq("club_id", profile.club_id).order("sort"),
    db.from("staff_groups").select("group_id").eq("user_id", userId),
    profile.role === "player"
      ? db.from("players").select("*").eq("user_id", userId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    db.from("consents").select("id, kind, player_id, user_id, text_version, withdrawn_at")
      .eq("user_id", userId).is("withdrawn_at", null),
  ]);
  if (club.error || !club.data) return null;
  const settings = parseSettings(club.data.settings);
  const today = todayIn(settings.timezone);
  const mine = (consents.data ?? []).filter((c) => c.text_version === CONSENT_VERSION);
  const p = player.data as Player | null;
  const age = p?.birth_date ? yearsBetween(p.birth_date, today) : null;
  const minor = age !== null && age < 18;
  let hasGuardian = false;
  if (p && minor) {
    const { data: g } = await db.from("consents").select("id")
      .eq("player_id", p.id).in("kind", ["guardian_digital", "guardian_paper"]).is("withdrawn_at", null).limit(1);
    hasGuardian = (g ?? []).length > 0;
  }
  const hasOwn = mine.some((c) => c.user_id === userId);
  return {
    userId,
    profile,
    role: profile.role,
    club: club.data,
    settings,
    today,
    groups: groups.data ?? [],
    statuses: statuses.data ?? [],
    staffGroupIds: (staffGroups.data ?? []).map((g) => g.group_id),
    player: p,
    consentAccepted: minor ? hasGuardian : hasOwn,
    guardianConsentMissing: minor && !hasGuardian,
  };
}

function yearsBetween(birth: string, today: string): number {
  const [by, bm, bd] = birth.split("-").map(Number);
  const [y, m, d] = today.split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

// ---------------------------------------------------------------------------
// Jucători și disponibilitate
// ---------------------------------------------------------------------------
export const PLAYER_LIST_COLUMNS =
  "id, club_id, group_id, user_id, full_name, display_name, birth_date, position, shirt_number, photo_path, " +
  "medical_visa_expires_on, status_id, status_note, status_zone, status_side, status_zone_detail, " +
  "status_zone_uncertain, status_return_on, training_restrictions, status_updated_at, needs_review, review_note, is_active";

export type PlayerListItem = Pick<
  Player,
  | "id" | "club_id" | "group_id" | "user_id" | "full_name" | "display_name" | "birth_date" | "position"
  | "shirt_number" | "photo_path" | "medical_visa_expires_on" | "status_id" | "status_note" | "status_zone"
  | "status_side" | "status_zone_detail" | "status_zone_uncertain" | "status_return_on"
  | "training_restrictions" | "status_updated_at" | "needs_review" | "review_note" | "is_active"
>;

export async function listPlayers(
  db: Db,
  opts: { groupId?: string | null; includeInactive?: boolean } = {},
): Promise<PlayerListItem[]> {
  let q = db.from("players").select(PLAYER_LIST_COLUMNS).order("display_name");
  if (opts.groupId) q = q.eq("group_id", opts.groupId);
  if (!opts.includeInactive) q = q.eq("is_active", true);
  return unwrap(await q) as unknown as PlayerListItem[];
}

export async function getPlayer(db: Db, id: string): Promise<Player | null> {
  const { data, error } = await db.from("players").select("*").eq("id", id).maybeSingle();
  if (error) throw new DataError(friendlyError(error), error.code);
  return data;
}

export type StatusUpdate = {
  status_id: string;
  status_note?: string | null;
  status_zone?: string | null;
  status_side?: string | null;
  status_zone_detail?: string | null;
  status_zone_uncertain?: boolean;
  status_return_on?: string | null;
  training_restrictions?: string | null;
};

export async function updatePlayerStatus(db: Db, playerId: string, update: StatusUpdate): Promise<void> {
  const { error } = await db.from("players").update({ ...update, needs_review: false, review_note: null }).eq("id", playerId);
  if (error) throw new DataError(friendlyError(error), error.code);
}

// ---------------------------------------------------------------------------
// Chestionar zilnic
// ---------------------------------------------------------------------------
export type WellnessInput = {
  fatigue: number;
  muscle_load: number;
  pain_zone?: string | null;
  pain_side?: string | null;
  pain_intensity?: number | null;
  pain_note?: string | null;
  sleep_quality?: number | null;
  sleep_hours?: number | null;
  stress?: number | null;
  mood?: number | null;
};

export async function getWellnessEntry(db: Db, playerId: string, date: string): Promise<WellnessEntry | null> {
  const { data, error } = await db.from("wellness_entries").select("*").eq("player_id", playerId).eq("entry_date", date).maybeSingle();
  if (error) throw new DataError(friendlyError(error), error.code);
  return data;
}

/** Salvează chestionarul zilei (jucătorul poate corecta în aceeași zi). */
export async function submitWellness(db: Db, playerId: string, date: string, input: WellnessInput): Promise<void> {
  for (const k of ["fatigue", "muscle_load"] as const) {
    if (!Number.isInteger(input[k]) || input[k] < 1 || input[k] > 10) throw new DataError("Alege o valoare între 1 și 10.");
  }
  const { error } = await db.from("wellness_entries").upsert(
    {
      player_id: playerId,
      entry_date: date,
      fatigue: input.fatigue,
      muscle_load: input.muscle_load,
      pain_zone: input.pain_zone ?? null,
      pain_side: input.pain_zone ? input.pain_side ?? null : null,
      pain_intensity: input.pain_zone ? input.pain_intensity ?? null : null,
      pain_note: input.pain_note?.trim() || null,
      sleep_quality: input.sleep_quality ?? null,
      sleep_hours: input.sleep_hours ?? null,
      stress: input.stress ?? null,
      mood: input.mood ?? null,
      source: "app",
    },
    { onConflict: "player_id,entry_date" },
  );
  if (error) throw new DataError(friendlyError(error), error.code);
}

export async function listWellness(db: Db, playerIds: string[], from: string, to: string): Promise<WellnessEntry[]> {
  if (!playerIds.length) return [];
  return unwrap(
    await db.from("wellness_entries").select("*").in("player_id", playerIds).gte("entry_date", from).lte("entry_date", to).order("entry_date"),
  );
}

export function wellnessConfigForGroup(group: Pick<Group, "wellness_config"> | null | undefined): WellnessConfig {
  return parseWellnessConfig(group?.wellness_config ?? null);
}

export async function submitRpe(
  db: Db, playerId: string, date: string, sessionType: "training" | "match" | "other", rpe: number, durationMin: number,
): Promise<void> {
  if (!Number.isInteger(rpe) || rpe < 1 || rpe > 10) throw new DataError("Alege un RPE între 1 și 10.");
  if (!Number.isInteger(durationMin) || durationMin < 1 || durationMin > 300) throw new DataError("Durata trebuie să fie între 1 și 300 de minute.");
  const { error } = await db.from("rpe_entries").upsert(
    { player_id: playerId, entry_date: date, session_type: sessionType, rpe, duration_min: durationMin },
    { onConflict: "player_id,entry_date,session_type" },
  );
  if (error) throw new DataError(friendlyError(error), error.code);
}

// ---------------------------------------------------------------------------
// Ziua jucătorului: plan + programe + bife
// ---------------------------------------------------------------------------
export type ExerciseCard = Pick<
  Exercise,
  "id" | "name" | "description" | "steps" | "category" | "zones" | "equipment" | "level" | "contraindications" | "video_url" | "video_path" | "image_url" | "attribution" | "license"
>;

const EXERCISE_CARD_COLUMNS =
  "id, name, description, steps, category, zones, equipment, level, contraindications, video_url, video_path, image_url, attribution, license";

export type DayItem = {
  /** cheie stabilă pentru UI */
  key: string;
  source: "plan" | "program";
  plan_item_id: string | null;
  assignment_id: string | null;
  program_exercise_id: string | null;
  exercise: ExerciseCard;
  sets: number | null;
  reps: string | null;
  duration_sec: number | null;
  rest_sec: number | null;
  tempo: string | null;
  notes: string | null;
  completion: { id: string; done: boolean; comment: string | null; pain: boolean; pain_intensity: number | null } | null;
};

export type PlayerDay = {
  date: string;
  plan: { id: string; title: string | null; notes: string | null; rtp_stage: number | null; items: DayItem[] } | null;
  programs: Array<{ assignment_id: string; program_id: string; name: string; description: string | null; notes: string | null; items: DayItem[] }>;
  total: number;
  done: number;
};

/** Ce are jucătorul de făcut într-o zi: planul personalizat și programele programate în acea zi. */
export async function getPlayerDay(db: Db, playerId: string, date: string): Promise<PlayerDay> {
  const [planRes, assignRes, compRes] = await Promise.all([
    db.from("daily_plans")
      .select(`id, title, notes, rtp_stage, daily_plan_items ( id, sort, sets, reps, duration_sec, rest_sec, tempo, notes, exercises ( ${EXERCISE_CARD_COLUMNS} ) )`)
      .eq("player_id", playerId).eq("plan_date", date).maybeSingle(),
    db.from("program_assignment_players")
      .select(`assignment_id, program_assignments!inner ( id, start_date, end_date, weekdays, notes, is_active, program_id,
        programs!inner ( id, name, description, program_exercises ( id, sort, sets, reps, duration_sec, rest_sec, tempo, notes, exercises ( ${EXERCISE_CARD_COLUMNS} ) ) ) )`)
      .eq("player_id", playerId),
    db.from("exercise_completions").select("*").eq("player_id", playerId),
  ]);
  if (planRes.error) throw new DataError(friendlyError(planRes.error), planRes.error.code);
  if (assignRes.error) throw new DataError(friendlyError(assignRes.error), assignRes.error.code);
  const completions = compRes.data ?? [];

  const comp = (c: (typeof completions)[number] | undefined) =>
    c ? { id: c.id, done: c.done, comment: c.comment, pain: c.pain, pain_intensity: c.pain_intensity } : null;

  let plan: PlayerDay["plan"] = null;
  if (planRes.data) {
    const p = planRes.data;
    const items = [...(p.daily_plan_items ?? [])].sort((a, b) => a.sort - b.sort).map<DayItem>((i) => ({
      key: `plan:${i.id}`,
      source: "plan",
      plan_item_id: i.id,
      assignment_id: null,
      program_exercise_id: null,
      exercise: i.exercises as unknown as ExerciseCard,
      sets: i.sets, reps: i.reps, duration_sec: i.duration_sec, rest_sec: i.rest_sec, tempo: i.tempo, notes: i.notes,
      completion: comp(completions.find((c) => c.plan_item_id === i.id)),
    }));
    plan = { id: p.id, title: p.title, notes: p.notes, rtp_stage: p.rtp_stage, items };
  }

  const programs: PlayerDay["programs"] = [];
  for (const row of assignRes.data ?? []) {
    const a = row.program_assignments;
    if (!a || !a.is_active || !isScheduledOn(a, date)) continue;
    const pr = a.programs;
    const items = [...(pr.program_exercises ?? [])].sort((x, y) => x.sort - y.sort).map<DayItem>((e) => ({
      key: `program:${a.id}:${e.id}`,
      source: "program",
      plan_item_id: null,
      assignment_id: a.id,
      program_exercise_id: e.id,
      exercise: e.exercises as unknown as ExerciseCard,
      sets: e.sets, reps: e.reps, duration_sec: e.duration_sec, rest_sec: e.rest_sec, tempo: e.tempo, notes: e.notes,
      completion: comp(completions.find((c) => c.assignment_id === a.id && c.program_exercise_id === e.id && c.done_on === date)),
    }));
    programs.push({ assignment_id: a.id, program_id: pr.id, name: pr.name, description: pr.description, notes: a.notes, items });
  }
  programs.sort((x, y) => x.name.localeCompare(y.name, "ro"));

  const all = [...(plan?.items ?? []), ...programs.flatMap((p) => p.items)];
  return { date, plan, programs, total: all.length, done: all.filter((i) => i.completion?.done).length };
}

export type CompletionInput = { done: boolean; comment?: string | null; pain?: boolean; pain_intensity?: number | null };

/** Bifează / debifează un exercițiu și, opțional, lasă un comentariu sau semnalează durere. */
export async function setCompletion(
  db: Db, playerId: string, date: string,
  item: Pick<DayItem, "plan_item_id" | "assignment_id" | "program_exercise_id" | "completion">,
  input: CompletionInput,
): Promise<void> {
  const values = {
    done: input.done,
    comment: input.comment?.trim() || null,
    pain: !!input.pain,
    pain_intensity: input.pain ? input.pain_intensity ?? null : null,
  };
  if (item.completion) {
    const { error } = await db.from("exercise_completions").update(values).eq("id", item.completion.id);
    if (error) throw new DataError(friendlyError(error), error.code);
    return;
  }
  const { error } = await db.from("exercise_completions").insert({
    player_id: playerId,
    done_on: date,
    plan_item_id: item.plan_item_id,
    assignment_id: item.assignment_id,
    program_exercise_id: item.program_exercise_id,
    ...values,
  });
  if (error) throw new DataError(friendlyError(error), error.code);
}

/** Zilele dintr-un interval în care jucătorul are plan sau program (pentru calendar). */
export async function getPlayerCalendar(db: Db, playerId: string, from: string, to: string): Promise<Record<string, { plan: boolean; programs: number }>> {
  const [plans, assigns] = await Promise.all([
    db.from("daily_plans").select("plan_date").eq("player_id", playerId).gte("plan_date", from).lte("plan_date", to),
    db.from("program_assignment_players")
      .select("program_assignments!inner ( start_date, end_date, weekdays, is_active )").eq("player_id", playerId),
  ]);
  const out: Record<string, { plan: boolean; programs: number }> = {};
  for (let d = from; d <= to; d = addDays(d, 1)) out[d] = { plan: false, programs: 0 };
  for (const p of plans.data ?? []) if (out[p.plan_date]) out[p.plan_date].plan = true;
  for (const r of assigns.data ?? []) {
    const a = r.program_assignments;
    if (!a?.is_active) continue;
    for (const d of Object.keys(out)) if (isScheduledOn(a, d)) out[d].programs++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Exerciții
// ---------------------------------------------------------------------------
export async function listExercises(db: Db, opts: { includeInactive?: boolean } = {}): Promise<Exercise[]> {
  let q = db.from("exercises").select("*").order("name");
  if (!opts.includeInactive) q = q.eq("is_active", true);
  return unwrap(await q);
}

// ---------------------------------------------------------------------------
// Notificări
// ---------------------------------------------------------------------------
export async function listNotifications(db: Db, limit = 50): Promise<Notification[]> {
  return unwrap(await db.from("notifications").select("*").order("created_at", { ascending: false }).limit(limit));
}

export async function countUnreadNotifications(db: Db): Promise<number> {
  const { count } = await db.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  return count ?? 0;
}

export async function markNotificationsRead(db: Db, ids?: string[]): Promise<void> {
  let q = db.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  if (ids?.length) q = q.in("id", ids);
  const { error } = await q;
  if (error) throw new DataError(friendlyError(error), error.code);
}
