"use server";
import { z } from "zod";
import { INJURY_CONTACT, INJURY_CONTEXT, INJURY_SEVERITY, INJURY_TYPES, RTP_STAGES, updatePlayerStatus } from "@club/shared";
import { run, fail } from "@/lib/actions";
import { getT } from "@/messages";
import { fitStatus, injuredStatus } from "@/components/players/domain";
import { mustSeePlayer } from "@/components/players/server";
import { cleanZone, optDate, optText, reqDate, valid, zoneFields } from "@/components/players/validation";

const t = getT().players;
const e = t.errors;

const keys = <T extends Record<string, string>>(o: T) => Object.keys(o) as [string, ...string[]];
const optEnum = (values: [string, ...string[]]) =>
  z.union([z.enum(values), z.literal("")]).nullish().transform((v) => v || null);

// ---------------------------------------------------------------------------
// Accidentări
// ---------------------------------------------------------------------------
const InjuryInput = z.object({
  id: z.uuid().nullish(),
  playerId: z.uuid(),
  ...zoneFields,
  injuryType: optEnum(keys(INJURY_TYPES)),
  contact: optEnum(keys(INJURY_CONTACT)),
  context: optEnum(keys(INJURY_CONTEXT)),
  occurredOn: reqDate,
  diagnosis: optText(500),
  severity: optEnum(keys(INJURY_SEVERITY)),
  expectedReturnOn: optDate,
  actualReturnOn: optDate,
  rtpStage: z.number().int().min(0).max(RTP_STAGES.length - 1),
  notes: optText(4000),
  recurrenceOf: z.union([z.uuid(), z.literal("")]).nullish().transform((v) => v || null),
  /** „injured" = pune starea ACC cu zona și revenirea estimată; „fit" = marchează jucătorul apt */
  syncStatus: z.enum(["injured", "fit"]).nullish(),
});
export type InjuryInput = z.input<typeof InjuryInput>;

export async function saveInjury(input: InjuryInput) {
  return run({ roles: ["physio"], revalidate: ["/disponibilitate", "/lot", "layout:/lot/jucatori/[id]"], message: t.medical.saved }, async ({ db, ctx }) => {
    const v = valid(InjuryInput, input);
    await mustSeePlayer(db, v.playerId);
    if (v.occurredOn > ctx.today) fail(e.futureDate);
    if (v.actualReturnOn && v.actualReturnOn < v.occurredOn) fail(e.returnBeforeStart);
    if (v.expectedReturnOn && v.expectedReturnOn < v.occurredOn) fail(e.returnBeforeStart);
    if (v.recurrenceOf) {
      const { data: prev } = await db.from("injuries").select("id, player_id").eq("id", v.recurrenceOf).maybeSingle();
      if (!prev || prev.player_id !== v.playerId || prev.id === v.id) fail(e.recurrenceInvalid);
    }
    const zone = cleanZone(v);
    const row = {
      player_id: v.playerId,
      zone: zone.zone,
      side: zone.side,
      zone_detail: zone.detail,
      zone_uncertain: zone.uncertain,
      injury_type: v.injuryType,
      contact: v.contact,
      context: v.context,
      occurred_on: v.occurredOn,
      diagnosis: v.diagnosis,
      severity: v.severity,
      expected_return_on: v.expectedReturnOn,
      actual_return_on: v.actualReturnOn,
      rtp_stage: v.rtpStage,
      notes: v.notes,
      recurrence_of: v.recurrenceOf,
    };
    let id = v.id ?? null;
    if (id) {
      const { data, error } = await db.from("injuries").update(row).eq("id", id).eq("player_id", v.playerId).select("id");
      if (error) throw error;
      if (!data?.length) fail(e.injuryNotFound);
    } else {
      const { data, error } = await db.from("injuries").insert({ ...row, created_by: ctx.userId }).select("id").single();
      if (error) throw error;
      id = data.id;
    }

    if (v.syncStatus === "injured") {
      const status = injuredStatus(ctx.statuses);
      if (status) {
        await updatePlayerStatus(db, v.playerId, {
          status_id: status.id,
          status_note: v.diagnosis,
          status_zone: zone.zone,
          status_side: zone.side,
          status_zone_detail: zone.detail,
          status_zone_uncertain: zone.uncertain,
          status_return_on: v.expectedReturnOn,
        });
      }
    } else if (v.syncStatus === "fit") {
      const status = fitStatus(ctx.statuses);
      if (status) {
        await updatePlayerStatus(db, v.playerId, {
          status_id: status.id,
          status_note: null,
          status_zone: null,
          status_side: null,
          status_zone_detail: null,
          status_zone_uncertain: false,
          status_return_on: null,
          training_restrictions: null,
        });
      }
    }
    return { id };
  });
}

const IdInput = z.object({ id: z.uuid() });

export async function deleteInjury(input: z.input<typeof IdInput>) {
  return run({ roles: ["physio"], message: t.medical.deleted }, async ({ db }) => {
    const v = valid(IdInput, input);
    const { data, error } = await db.from("injuries").delete().eq("id", v.id).select("id");
    if (error) throw error;
    if (!data?.length) fail(e.injuryNotFound);
    return { id: v.id };
  });
}

/** Etapa următoare de revenire (din lista clubului sau din fișă), fără a închide accidentarea. */
export async function advanceInjuryStage(input: z.input<typeof IdInput>) {
  return run({ roles: ["physio"], revalidate: ["/performanta/medical", "/disponibilitate", "layout:/lot/jucatori/[id]"], message: t.medical.stageAdvanced }, async ({ db }) => {
    const v = valid(IdInput, input);
    const { data: inj } = await db.from("injuries").select("id, rtp_stage, actual_return_on").eq("id", v.id).maybeSingle();
    if (!inj) fail(e.injuryNotFound);
    if (inj.actual_return_on) fail(e.injuryClosed);
    const next = Math.min((inj.rtp_stage ?? 0) + 1, RTP_STAGES.length - 2);
    const { error } = await db.from("injuries").update({ rtp_stage: next }).eq("id", v.id).is("actual_return_on", null);
    if (error) throw error;
    return { stage: next };
  });
}

/**
 * „Recuperat": închide accidentarea azi, la etapa „Apt de joc". Dacă jucătorul nu mai are alte
 * accidentări deschise, starea lui devine „Apt" (cu zona și restricțiile șterse).
 */
export async function markInjuryRecovered(input: z.input<typeof IdInput>) {
  return run({ roles: ["physio"], revalidate: ["/performanta/medical", "/disponibilitate", "/lot", "layout:/lot/jucatori/[id]"], message: t.medical.recovered }, async ({ db, ctx }) => {
    const v = valid(IdInput, input);
    const { data: inj } = await db.from("injuries").select("id, player_id, occurred_on, actual_return_on").eq("id", v.id).maybeSingle();
    if (!inj) fail(e.injuryNotFound);
    if (inj.actual_return_on) fail(e.injuryClosed);
    const { error } = await db.from("injuries")
      .update({ actual_return_on: ctx.today < inj.occurred_on ? inj.occurred_on : ctx.today, rtp_stage: RTP_STAGES.length - 1 })
      .eq("id", v.id).is("actual_return_on", null);
    if (error) throw error;
    const { count } = await db.from("injuries").select("id", { count: "exact", head: true }).eq("player_id", inj.player_id).is("actual_return_on", null);
    let statusChanged = false;
    if (!count) {
      const status = fitStatus(ctx.statuses);
      if (status) {
        await updatePlayerStatus(db, inj.player_id, {
          status_id: status.id, status_note: null, status_zone: null, status_side: null, status_zone_detail: null,
          status_zone_uncertain: false, status_return_on: null, training_restrictions: null,
        });
        statusChanged = true;
      }
    }
    return { statusChanged };
  });
}

// ---------------------------------------------------------------------------
// Tratamente
// ---------------------------------------------------------------------------
const TreatmentInput = z.object({
  injuryId: z.uuid(),
  treatedOn: reqDate,
  description: z.string().trim().min(2, e.treatmentRequired).max(1000, e.tooLong(1000)),
});

export async function addTreatment(input: z.input<typeof TreatmentInput>) {
  return run({ roles: ["physio"], message: t.medical.treatmentSaved }, async ({ db, ctx }) => {
    const v = valid(TreatmentInput, input);
    if (v.treatedOn > ctx.today) fail(e.futureDate);
    const { error } = await db.from("injury_treatments").insert({
      injury_id: v.injuryId, treated_on: v.treatedOn, description: v.description, created_by: ctx.userId,
    });
    if (error) throw error;
    return { id: v.injuryId };
  });
}

export async function deleteTreatment(input: z.input<typeof IdInput>) {
  return run({ roles: ["physio"], message: t.medical.treatmentDeleted }, async ({ db }) => {
    const v = valid(IdInput, input);
    const { data, error } = await db.from("injury_treatments").delete().eq("id", v.id).select("id");
    if (error) throw error;
    if (!data?.length) fail(e.notSaved);
    return { id: v.id };
  });
}

// ---------------------------------------------------------------------------
// Trimiteri către partenerul medical
// ---------------------------------------------------------------------------
const ReferralInput = z.object({
  playerId: z.uuid(),
  partnerId: z.uuid(e.partnerRequired),
  injuryId: z.union([z.uuid(), z.literal("")]).nullish().transform((v) => v || null),
  reason: optText(500),
});

export async function createReferral(input: z.input<typeof ReferralInput>) {
  return run({ roles: ["physio"], message: t.medical.referralSaved }, async ({ db, ctx }) => {
    const v = valid(ReferralInput, input);
    await mustSeePlayer(db, v.playerId);
    const { data: partner } = await db.from("profiles").select("id, role, is_active, club_id").eq("id", v.partnerId).maybeSingle();
    if (!partner || partner.role !== "medical_partner" || !partner.is_active || partner.club_id !== ctx.club.id) fail(e.partnerInvalid);
    if (v.injuryId) {
      const { data: injury } = await db.from("injuries").select("id, player_id").eq("id", v.injuryId).maybeSingle();
      if (!injury || injury.player_id !== v.playerId) fail(e.injuryNotFound);
    }
    let dup = db.from("referrals").select("id").eq("player_id", v.playerId).eq("partner_user_id", v.partnerId).eq("is_active", true);
    dup = v.injuryId ? dup.eq("injury_id", v.injuryId) : dup.is("injury_id", null);
    const { data: existing } = await dup.limit(1);
    if (existing?.length) fail(e.referralDuplicate);
    const { data, error } = await db.from("referrals").insert({
      player_id: v.playerId, partner_user_id: v.partnerId, injury_id: v.injuryId, reason: v.reason, created_by: ctx.userId,
    }).select("id").single();
    if (error) throw error;
    return { id: data.id };
  });
}

const ReferralActiveInput = z.object({ id: z.uuid(), active: z.boolean() });

export async function setReferralActive(input: z.input<typeof ReferralActiveInput>) {
  return run({ roles: ["physio"] }, async ({ db }) => {
    const v = valid(ReferralActiveInput, input);
    const { data, error } = await db.from("referrals")
      .update({ is_active: v.active, closed_at: v.active ? null : new Date().toISOString() })
      .eq("id", v.id).select("id");
    if (error) throw error;
    if (!data?.length) fail(e.referralNotFound);
    return { active: v.active };
  });
}
