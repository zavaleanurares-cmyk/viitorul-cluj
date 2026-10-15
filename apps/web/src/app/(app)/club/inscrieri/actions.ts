"use server";
import { z } from "zod";
import { parseLei } from "@club/shared";
import { fail, run } from "@/lib/actions";
import { getT } from "@/messages";

const t = getT().club.enrolment;
const OFFICE = ["admin", "secretary", "sporting_director"] as const;
const LIST = "/club/inscrieri";
const paths = (id?: string) => (id ? [LIST, `${LIST}/${id}`] : [LIST]);

const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const Request = z.object({
  childName: z.string().trim().min(3).max(120),
  birthDate: z.iso.date(),
  groupId: z.union([z.uuid(), z.literal("")]).optional(),
  previousClub: opt(120),
  position: z.enum(["GK", "DEF", "MID", "FWD", ""]).optional(),
  notes: opt(1000),
  parentName: z.string().trim().min(3).max(120),
  relation: z.enum(["mother", "father", "parent", "guardian", "other"]).default("parent"),
  email: z.union([z.email(), z.literal("")]).optional(),
  phone: opt(20),
});
export type RequestInput = z.input<typeof Request>;

const toRow = (v: z.output<typeof Request>) => ({
  child_name: v.childName, birth_date: v.birthDate, group_id: v.groupId || "", previous_club: v.previousClub ?? "",
  position: v.position || "", notes: v.notes ?? "", parent_name: v.parentName, relation: v.relation,
  parent_email: v.email || "", parent_phone: v.phone ?? "",
});

function parseRequest(input: RequestInput) {
  const r = Request.safeParse(input);
  if (!r.success) fail(t.errors.invalid);
  if (!r.data.email && !r.data.phone) fail(t.errors.contact);
  return r.data;
}

export async function createRequest(input: RequestInput) {
  return run<{ id: string }>({ roles: [...OFFICE], revalidate: paths() }, async ({ db }) => {
    const v = parseRequest(input);
    const { data, error } = await db.rpc("create_enrolment_request", { p: toRow(v) });
    if (error) throw error;
    return { id: data as string };
  });
}

export async function updateRequest(input: RequestInput & { id: string }) {
  return run({ roles: [...OFFICE], revalidate: paths(input.id) }, async ({ db }) => {
    const id = z.uuid().parse(input.id);
    const v = parseRequest(input);
    const { error } = await db.rpc("update_enrolment_request", { p_id: id, p: toRow(v) });
    if (error) throw error;
    return null;
  });
}

export async function bookTrial(input: { id: string; eventId: string }) {
  return run({ roles: [...OFFICE], revalidate: paths(input.id) }, async ({ db }) => {
    const v = z.object({ id: z.uuid(), eventId: z.uuid() }).parse(input);
    const { error } = await db.rpc("book_trial", { p_id: v.id, p_event: v.eventId });
    if (error) throw error;
    return null;
  });
}

export async function recordTrial(input: { id: string; rating: number; note: string; eventId?: string }) {
  return run({ roles: [...OFFICE, "coach"], revalidate: [...paths(input.id), ...(input.eventId ? [`/program/${input.eventId}`] : [])] }, async ({ db }) => {
    const v = z.object({ id: z.uuid(), rating: z.number().int().min(1).max(5), note: z.string().max(1000) }).safeParse(input);
    if (!v.success) fail(t.errors.rating);
    const { error } = await db.rpc("record_trial", { p_id: v.data.id, p_rating: v.data.rating, p_note: v.data.note });
    if (error) throw error;
    return null;
  });
}

export async function closeRequest(input: { id: string; reason: string; withdrawn: boolean }) {
  return run({ roles: [...OFFICE], revalidate: paths(input.id) }, async ({ db }) => {
    const v = z.object({ id: z.uuid(), reason: z.string().max(500), withdrawn: z.boolean() }).parse(input);
    const { error } = await db.rpc("decline_enrolment", { p_id: v.id, p_reason: v.reason, p_withdrawn: v.withdrawn });
    if (error) throw error;
    return null;
  });
}

export async function reopenRequest(id: string) {
  return run({ roles: [...OFFICE], revalidate: paths(id) }, async ({ db }) => {
    const { error } = await db.rpc("reopen_enrolment", { p_id: z.uuid().parse(id) });
    if (error) throw error;
    return null;
  });
}

export async function addNote(input: { id: string; note: string }) {
  return run({ roles: [...OFFICE], revalidate: paths(input.id) }, async ({ db }) => {
    const v = z.object({ id: z.uuid(), note: z.string().trim().min(1).max(1000) }).parse(input);
    const { error } = await db.rpc("note_enrolment", { p_id: v.id, p_note: v.note });
    if (error) throw error;
    return null;
  });
}

export async function enrol(input: { id: string; groupId: string; firstMonth: boolean; enrolFee: string; linkExisting?: boolean }) {
  return run<{ player_id: string; guardian_id: string; charges: number } | { existingFamily: string }>(
    { roles: [...OFFICE], revalidate: [...paths(input.id), "/lot", "/lot/parinti", "/bani"], message: t.enrolled },
    async ({ db }) => {
      const v = z.object({ id: z.uuid(), groupId: z.union([z.uuid(), z.literal("")]), firstMonth: z.boolean(), enrolFee: z.string().max(20), linkExisting: z.boolean().optional() }).parse(input);
      if (!v.groupId) fail(t.errors.team);
      const fee = v.enrolFee.trim() ? parseLei(v.enrolFee) : 0;
      if (fee === null || fee < 0) fail(t.errors.amount);
      // numele scurt („POPESCU A.") se face aici: majusculele cu diacritice nu depind de setările bazei de date
      const { data: req } = await db.from("enrolment_requests").select("child_name").eq("id", v.id).maybeSingle();
      const parts = (req?.child_name ?? "").trim().split(/\s+/);
      const display = parts.length >= 2 ? `${parts[0].toLocaleUpperCase("ro")} ${parts[1][0].toLocaleUpperCase("ro")}.` : (req?.child_name ?? "").toLocaleUpperCase("ro");
      const { data, error } = await db.rpc("enrol_request", { p_id: v.id, p: { group_id: v.groupId, first_month: v.firstMonth, enrol_fee: fee, display_name: display, link_existing: !!v.linkExisting } });
      // adresa părintelui există deja în club: biroul confirmă că e aceeași familie
      const m = /FAMILIE_EXISTENTA:(.*)/.exec(error?.message ?? "");
      if (m) return { existingFamily: m[1].trim() };
      if (error) throw error;
      return data as { player_id: string; guardian_id: string; charges: number };
    },
  );
}

export async function groupFee(groupId: string) {
  return run<number | null>({ roles: [...OFFICE] }, async ({ db }) => {
    const { data, error } = await db.rpc("group_fee_now", { p_group: z.uuid().parse(groupId) });
    if (error) throw error;
    return (data as number | null) ?? null;
  });
}
