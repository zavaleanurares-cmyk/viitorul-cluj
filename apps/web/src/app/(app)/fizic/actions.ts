"use server";
import { z } from "zod";
import { addDays, getPlayer, type TablesInsert } from "@club/shared";
import { run, fail } from "@/lib/actions";
import { getT } from "@/messages";
import { INTEGER_METRICS, METRIC_DECIMALS, METRIC_KEYS, METRIC_MAX, SESSION_TYPE_CODES, testCode, type MetricKey } from "@/components/physical/domain";

const t = getT().physical;
const e = t.errors;

const metricShape = Object.fromEntries(METRIC_KEYS.map((k) => [k, z.number().nullable()])) as Record<MetricKey, z.ZodNullable<z.ZodNumber>>;

const SessionInput = z.object({
  id: z.uuid().nullable(),
  groupId: z.uuid().nullable(),
  date: z.iso.date(),
  type: z.enum(SESSION_TYPE_CODES),
  name: z.string().trim().max(120, e.nameTooLong),
  durationMin: z.number().int().min(1, e.duration).max(600, e.duration).nullable(),
  rows: z.array(z.object({ playerId: z.uuid(), values: z.object(metricShape) })).max(200),
});
export type SessionInput = z.input<typeof SessionInput>;

function cleanMetric(key: MetricKey, v: number | null): number | null {
  if (v === null) return null;
  if (!Number.isFinite(v) || v < 0 || v > METRIC_MAX[key]) fail(e.metricRange(t.metrics[key].label, METRIC_MAX[key]));
  if (INTEGER_METRICS.has(key)) return Math.round(v);
  const f = 10 ** Math.max(1, METRIC_DECIMALS[key]);
  return Math.round(v * f) / f;
}

/**
 * Adaugă sau modifică o sesiune și valorile jucătorilor.
 * Un rând golit complet se șterge, cu excepția rândurilor importate care au coloane suplimentare.
 */
export async function saveSession(input: SessionInput) {
  return run({ roles: ["physio"], revalidate: ["/fizic"], message: t.editor.saved }, async ({ db, ctx }) => {
    const v = SessionInput.parse(input);
    if (v.date > addDays(ctx.today, 1)) fail(e.futureDate);
    if (v.groupId && !ctx.groups.some((g) => g.id === v.groupId)) fail(e.groupUnknown);

    const rows = v.rows.map((r) => ({
      player_id: r.playerId,
      values: Object.fromEntries(METRIC_KEYS.map((k) => [k, cleanMetric(k, r.values[k])])) as Record<MetricKey, number | null>,
    }));
    const filled = rows.filter((r) => METRIC_KEYS.some((k) => r.values[k] !== null));
    const cleared = rows.filter((r) => !METRIC_KEYS.some((k) => r.values[k] !== null));
    if (!v.id && !filled.length) fail(e.noRows);

    const header = {
      group_id: v.groupId, session_date: v.date, session_type: v.type, name: v.name, duration_min: v.durationMin,
    };
    let sessionId = v.id;
    if (sessionId) {
      const { data, error } = await db.from("physical_sessions").update(header).eq("id", sessionId).select("id");
      if (error) throw error;
      if (!data?.length) fail(e.sessionNotFound);
    } else {
      const { data, error } = await db.from("physical_sessions")
        .insert({ ...header, club_id: ctx.club.id, source: "manual" }).select("id").single();
      if (error?.code === "23505") fail(e.sessionDuplicate);
      if (error || !data) throw error;
      sessionId = data.id;
    }

    try {
      if (filled.length) {
        const payload: TablesInsert<"physical_metrics">[] = filled.map((r) => ({ session_id: sessionId, player_id: r.player_id, ...r.values }));
        const { error } = await db.from("physical_metrics").upsert(payload, { onConflict: "session_id,player_id" });
        if (error) throw error;
      }
      if (v.id && cleared.length) {
        const { data: existing, error } = await db.from("physical_metrics").select("player_id, extra")
          .eq("session_id", sessionId).in("player_id", cleared.map((r) => r.player_id));
        if (error) throw error;
        const hasExtra = (x: unknown) => !!x && typeof x === "object" && !Array.isArray(x) && Object.keys(x).length > 0;
        const keep = (existing ?? []).filter((m) => hasExtra(m.extra)).map((m) => m.player_id);
        const drop = (existing ?? []).filter((m) => !hasExtra(m.extra)).map((m) => m.player_id);
        if (keep.length) {
          const empty = Object.fromEntries(METRIC_KEYS.map((k) => [k, null])) as Record<MetricKey, null>;
          const { error: err } = await db.from("physical_metrics").update(empty).eq("session_id", sessionId).in("player_id", keep);
          if (err) throw err;
        }
        if (drop.length) {
          const { error: err } = await db.from("physical_metrics").delete().eq("session_id", sessionId).in("player_id", drop);
          if (err) throw err;
        }
      }
    } catch (err) {
      // sesiune nouă fără valori salvate: nu o lăsăm goală în listă
      if (!v.id) await db.from("physical_sessions").delete().eq("id", sessionId);
      throw err;
    }
    return { id: sessionId };
  });
}

const IdInput = z.object({ id: z.uuid() });

export async function deleteSession(input: z.infer<typeof IdInput>) {
  return run({ roles: ["physio"], revalidate: ["/fizic"], message: t.session.deleted }, async ({ db }) => {
    const v = IdInput.parse(input);
    const { data, error } = await db.from("physical_sessions").delete().eq("id", v.id).select("id");
    if (error) throw error;
    if (!data?.length) fail(e.sessionNotFound);
    return { id: v.id };
  });
}

const RowInput = z.object({ sessionId: z.uuid(), playerId: z.uuid() });

export async function deleteMetricRow(input: z.infer<typeof RowInput>) {
  return run({ roles: ["physio"], revalidate: ["/fizic"], message: t.session.rowDeleted }, async ({ db }) => {
    const v = RowInput.parse(input);
    const { data, error } = await db.from("physical_metrics").delete().eq("session_id", v.sessionId).eq("player_id", v.playerId).select("id");
    if (error) throw error;
    if (!data?.length) fail(e.rowNotFound);
    return v;
  });
}

// ---------------------------------------------------------------------------
// Teste fizice
// ---------------------------------------------------------------------------
const testValue = z.number().positive(e.valueRange).max(100000, e.valueRange);
const round2 = (n: number) => Math.round(n * 100) / 100;

const ResultsInput = z.object({
  testId: z.uuid(),
  date: z.iso.date(),
  rows: z.array(z.object({ playerId: z.uuid(), value: testValue.nullable() })).min(1).max(200),
});
export type ResultsInput = z.input<typeof ResultsInput>;

/** Rezultatele unei testări pentru toată grupa: un câmp pe jucător; câmpul golit șterge rezultatul din acea zi. */
export async function saveTestResults(input: ResultsInput) {
  return run({ roles: ["physio"], revalidate: ["/fizic"], message: t.results.saved }, async ({ db, ctx }) => {
    const v = ResultsInput.parse(input);
    if (v.date > ctx.today) fail(e.futureDate);
    const { data: test } = await db.from("fitness_tests").select("id").eq("id", v.testId).maybeSingle();
    if (!test) fail(e.testNotFound);
    const filled = v.rows.filter((r): r is { playerId: string; value: number } => r.value !== null);
    const cleared = v.rows.filter((r) => r.value === null).map((r) => r.playerId);
    if (filled.length) {
      const { error } = await db.from("fitness_test_results").upsert(
        filled.map((r) => ({ test_id: v.testId, player_id: r.playerId, tested_on: v.date, value: round2(r.value), created_by: ctx.userId })),
        { onConflict: "test_id,player_id,tested_on" },
      );
      if (error) throw error;
    }
    let removed = 0;
    if (cleared.length) {
      const { data, error } = await db.from("fitness_test_results").delete()
        .eq("test_id", v.testId).eq("tested_on", v.date).in("player_id", cleared).select("id");
      if (error) throw error;
      removed = data?.length ?? 0;
    }
    if (!filled.length && !removed) fail(e.noResults);
    return { saved: filled.length, removed };
  });
}

const ResultInput = z.object({
  testId: z.uuid(),
  playerId: z.uuid(),
  date: z.iso.date(),
  value: testValue,
  notes: z.string().trim().max(300, e.notesTooLong).nullable(),
});
export type ResultInput = z.input<typeof ResultInput>;

export async function saveTestResult(input: ResultInput) {
  return run({ roles: ["physio"], revalidate: ["/fizic"], message: t.results.savedOne }, async ({ db, ctx }) => {
    const v = ResultInput.parse(input);
    if (v.date > ctx.today) fail(e.futureDate);
    if (!(await getPlayer(db, v.playerId))) fail(e.playerNotFound);
    const { data: test } = await db.from("fitness_tests").select("id").eq("id", v.testId).maybeSingle();
    if (!test) fail(e.testNotFound);
    const { error } = await db.from("fitness_test_results").upsert(
      { test_id: v.testId, player_id: v.playerId, tested_on: v.date, value: round2(v.value), notes: v.notes || null, created_by: ctx.userId },
      { onConflict: "test_id,player_id,tested_on" },
    );
    if (error) throw error;
    return { playerId: v.playerId };
  });
}

export async function deleteTestResult(input: z.infer<typeof IdInput>) {
  return run({ roles: ["physio"], revalidate: ["/fizic"], message: t.results.deleted }, async ({ db }) => {
    const v = IdInput.parse(input);
    const { data, error } = await db.from("fitness_test_results").delete().eq("id", v.id).select("id");
    if (error) throw error;
    if (!data?.length) fail(e.resultNotFound);
    return { id: v.id };
  });
}

const TestInput = z.object({
  id: z.uuid().nullable(),
  name: z.string().trim().min(2, e.testName).max(60, e.testName),
  unit: z.string().trim().min(1, e.testUnit).max(12, e.testUnit),
  lowerIsBetter: z.boolean(),
});
export type TestInput = z.input<typeof TestInput>;

export async function saveTest(input: TestInput) {
  return run({ roles: ["physio"], revalidate: ["/fizic"], message: t.manage.saved }, async ({ db, ctx }) => {
    const v = TestInput.parse(input);
    if (v.id) {
      const { data, error } = await db.from("fitness_tests")
        .update({ name: v.name, unit: v.unit, lower_is_better: v.lowerIsBetter }).eq("id", v.id).select("id");
      if (error) throw error;
      if (!data?.length) fail(e.testNotFound);
      return { id: v.id };
    }
    const { data: all, error: listError } = await db.from("fitness_tests").select("code, name, sort");
    if (listError) throw listError;
    if ((all ?? []).some((x) => x.name.trim().toLowerCase() === v.name.toLowerCase())) fail(e.testDuplicate);
    const codes = new Set((all ?? []).map((x) => x.code));
    const base = testCode(v.name);
    let code = base;
    for (let i = 2; codes.has(code); i++) code = `${base}_${i}`;
    const sort = Math.max(0, ...(all ?? []).map((x) => x.sort)) + 1;
    const { data, error } = await db.from("fitness_tests")
      .insert({ club_id: ctx.club.id, code, name: v.name, unit: v.unit, lower_is_better: v.lowerIsBetter, sort }).select("id").single();
    if (error) throw error;
    return { id: data.id };
  });
}

const ActiveInput = z.object({ id: z.uuid(), active: z.boolean() });

/** Dezactivarea ascunde testul din liste; rezultatele vechi rămân. */
export async function setTestActive(input: z.infer<typeof ActiveInput>) {
  return run({ roles: ["physio"], revalidate: ["/fizic"] }, async ({ db }) => {
    const v = ActiveInput.parse(input);
    const { data, error } = await db.from("fitness_tests").update({ is_active: v.active }).eq("id", v.id).select("id");
    if (error) throw error;
    if (!data?.length) fail(e.testNotFound);
    return { id: v.id };
  });
}
