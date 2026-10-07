"use server";
import { z } from "zod";
import type { Json } from "@club/shared";
import { run, fail } from "@/lib/actions";
import { getT } from "@/messages";
import { getImport } from "@/components/imports/queries";
import type { ImportRecord, ReportRow } from "@/components/imports/types";

/**
 * Acțiunile ecranului de import. Fișierul nu ajunge pe server: browserul trimite doar rândurile
 * deja interpretate și deciziile de potrivire, iar scrierea o face RPC-ul atomic al fiecărui tip
 * (sub RLS, cu verificarea rolului și în baza de date).
 */

const MAX_ROWS = 5000;
const Id = z.uuid();
const Text = z.string().max(2000);
const Meta = {
  filename: z.string().max(300).nullable(),
  file_hash: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
  mapping: z.unknown().optional(),
};
const RowBase = { row: z.number().int().min(1), source_name: z.string().min(1).max(200), match_key: z.string().max(200) };
const Decided = {
  ...RowBase,
  group_id: Id.nullable(),
  action: z.enum(["create", "update", "skip"]),
  player_id: Id.nullable(),
};
const decided = (r: { action: string; player_id: string | null }) => r.action !== "update" || !!r.player_id;
const Side = z.enum(["left", "right", "both"]).nullable();
const Num = z.number().finite().nullable();

const Health = z.object({
  ...Meta,
  rows: z.array(z.object({
    ...Decided,
    display_name: z.string().min(1).max(200),
    status_code: z.string().max(40),
    status_note: Text.nullable(),
    zone: z.string().max(40).nullable(),
    side: Side,
    zone_detail: Text.nullable(),
    zone_uncertain: z.boolean(),
    needs_review: z.boolean(),
    review_note: z.string().max(1000).nullable(),
  }).refine(decided).refine((r) => r.action !== "create" || !!r.group_id)).max(MAX_ROWS),
});

const Wellness = z.object({
  ...Meta,
  rows: z.array(z.object({
    ...Decided,
    entry_date: z.iso.date().nullable(),
    fatigue: z.number().int().min(1).max(10).nullable().optional(),
    muscle_load: z.number().int().min(1).max(10).nullable().optional(),
    pain_zone: z.string().max(40).nullable().optional(),
    pain_side: Side.optional(),
    pain_intensity: z.null().optional(),
    pain_note: Text.nullable().optional(),
    needs_review: z.boolean().optional(),
    review_note: z.string().max(1000).nullable().optional(),
    raw: z.record(z.string(), z.string().max(200)).optional(),
  }).refine(decided)).max(MAX_ROWS),
});

const Roster = z.object({
  ...Meta,
  rows: z.array(z.object({
    ...Decided,
    full_name: z.string().min(1).max(200),
    display_name: z.string().max(200).nullable(),
    birth_date: z.iso.date().nullable(),
    position: z.enum(["GK", "DEF", "MID", "FWD"]).nullable(),
    shirt_number: z.number().int().min(0).max(32767).nullable(),
    dominant_foot: Side,
  }).refine(decided)).max(MAX_ROWS),
});

const Physical = z.object({
  ...Meta,
  source: z.enum(["ksport", "import"]),
  sessions: z.array(z.object({
    session_date: z.iso.date(),
    name: z.string().max(200),
    session_type: z.enum(["training", "match", "test", "other"]),
    group_id: Id.nullable(),
    duration_min: Num,
    rows: z.array(z.object({
      ...RowBase,
      player_id: Id.nullable(),
      note: Text.nullable(),
      extra: z.record(z.string().max(120), z.union([z.string().max(500), z.number().finite()])),
      duration_min: Num, total_distance_m: Num, hsr_distance_m: Num, sprint_distance_m: Num, sprint_count: Num,
      max_speed_kmh: Num, accelerations: Num, decelerations: Num, player_load: Num, hr_avg: Num, hr_max: Num,
    })).max(MAX_ROWS),
  })).max(1000),
});

const Tests = z.object({
  ...Meta,
  rows: z.array(z.object({
    ...RowBase,
    player_id: Id.nullable(),
    tested_on: z.iso.date().nullable(),
    note: Text.nullable(),
    results: z.array(z.object({ test_id: Id, value: z.number().finite().min(-99999).max(99999) })).max(50),
  })).max(MAX_ROWS),
});

const Annotations = z.array(z.object({
  row: z.number().int().min(1),
  name: z.string().max(200),
  note: Text,
  result: z.enum(["skipped", "error"]).optional(),
})).max(MAX_ROWS);

const Input = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("health_status"), payload: Health, annotations: Annotations }),
  z.object({ kind: z.literal("fatigue_grid"), payload: Wellness, annotations: Annotations }),
  z.object({ kind: z.literal("roster"), payload: Roster, annotations: Annotations }),
  z.object({ kind: z.literal("physical"), payload: Physical, annotations: Annotations }),
  z.object({ kind: z.literal("tests"), payload: Tests, annotations: Annotations }),
]);

const RPC = {
  health_status: "import_health_status",
  fatigue_grid: "import_wellness",
  roster: "import_roster",
  physical: "import_physical",
  tests: "import_tests",
} as const;

/** Rulează importul și întoarce raportul lui. */
export async function runImport(input: { kind: string; payload: unknown; annotations: unknown }) {
  return run<ImportRecord>(
    { roles: ["physio"], revalidate: ["/import", "/jucatori", "/disponibilitate", "/wellness", "/fizic", "/tablou"] },
    async ({ db, ctx }) => {
      const t = getT().imports.errors;
      const parsed = Input.safeParse(input);
      if (!parsed.success) fail(t.invalidPayload);
      const v = parsed.data;

      // grupele trimise trebuie să fie ale clubului (cheia străină singură nu verifică asta)
      const groups = new Set(ctx.groups.map((g) => g.id));
      const used = v.kind === "physical" ? v.payload.sessions.map((s) => s.group_id) : v.kind === "tests" ? [] : v.payload.rows.map((r) => r.group_id);
      if (used.some((g) => g && !groups.has(g))) fail(t.foreignGroup);

      const { data, error } = await db.rpc(RPC[v.kind], { p_payload: v.payload as unknown as Json });
      if (error) throw error;
      const importId = (data as { import_id?: string } | null)?.import_id;
      if (!importId) fail(t.noReport);

      // Rândurile care nu au ajuns la RPC (fără nume, fără dată, totaluri) și observațiile de pe
      // rândurile importate se adaugă la raport, ca să fie complet și când este redeschis.
      if (v.annotations.length) {
        const { data: current, error: readError } = await db.from("imports").select("report, rows_skipped, rows_flagged").eq("id", importId).single();
        if (readError) throw readError;
        const report = (current.report && typeof current.report === "object" && !Array.isArray(current.report) ? current.report : {}) as Record<string, unknown>;
        const rows = (Array.isArray(report.rows) ? [...report.rows] : []) as ReportRow[];
        let skipped = 0;
        let flagged = 0;
        for (const a of v.annotations) {
          if (a.result) {
            rows.push({ row: a.row, name: a.name || null, result: a.result, note: a.note });
            skipped++;
            continue;
          }
          const target = rows.find((r) => r.row === a.row && r.result !== "skipped" && r.result !== "error");
          if (!target) continue;
          if (!target.flagged) flagged++;
          target.flagged = true;
          target.note = [target.note, a.note].filter(Boolean).join("; ");
        }
        rows.sort((a, b) => (a.row ?? 0) - (b.row ?? 0));
        const { error: writeError } = await db.from("imports").update({
          report: { ...report, rows } as unknown as Json,
          rows_skipped: current.rows_skipped + skipped,
          rows_flagged: current.rows_flagged + flagged,
        }).eq("id", importId);
        if (writeError) throw writeError;
      }

      const record = await getImport(db, importId);
      if (!record) fail(t.noReport);
      return record;
    },
  );
}

const Template = z.object({
  name: z.string().trim().min(1).max(80),
  mapping: z.object({
    version: z.literal(1),
    headers: z.array(z.string().max(200)).max(300),
    columns: z.record(z.string().max(220), z.string().max(220)),
    defaults: z.object({ session_type: z.enum(["training", "match", "test", "other"]), source: z.enum(["ksport", "import"]) }),
  }),
});

/** Salvează maparea curentă ca șablon (același nume = șablonul se actualizează). */
export async function saveTemplate(input: z.infer<typeof Template>) {
  return run({ roles: ["physio"], revalidate: ["/import"], message: getT().imports.templates.savedToast }, async ({ db, ctx }) => {
    const v = Template.parse(input);
    const { data: existing, error: findError } = await db.from("import_templates").select("id")
      .eq("kind", "physical").eq("name", v.name).maybeSingle();
    if (findError) throw findError;
    if (existing) {
      const { error } = await db.from("import_templates").update({ mapping: v.mapping as unknown as Json }).eq("id", existing.id);
      if (error) throw error;
      return { id: existing.id };
    }
    const { data, error } = await db.from("import_templates")
      .insert({ club_id: ctx.club.id, kind: "physical", name: v.name, mapping: v.mapping as unknown as Json, created_by: ctx.userId })
      .select("id").single();
    if (error) throw error;
    return { id: data.id };
  });
}

export async function deleteTemplate(input: { id: string }) {
  return run({ roles: ["physio"], revalidate: ["/import"], message: getT().imports.templates.deletedToast }, async ({ db }) => {
    const { id } = z.object({ id: Id }).parse(input);
    const { error } = await db.from("import_templates").delete().eq("id", id);
    if (error) throw error;
  });
}
