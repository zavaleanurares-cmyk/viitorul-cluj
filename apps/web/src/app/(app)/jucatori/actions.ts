"use server";
import { z } from "zod";
import { CONSENT_VERSION, FEET, POSITIONS, updatePlayerStatus } from "@club/shared";
import { run, fail } from "@/lib/actions";
import { getT } from "@/messages";
import { availabilityOf } from "@/components/players/domain";
import { mustSeePlayer } from "@/components/players/server";
import { cleanZone, optDate, optNumber, optText, reqDate, valid, zoneFields } from "@/components/players/validation";

const t = getT().players;
const e = t.errors;

// ---------------------------------------------------------------------------
// Stare
// ---------------------------------------------------------------------------
const StatusInput = z.object({
  playerId: z.uuid(),
  statusId: z.uuid(),
  note: optText(1000),
  ...zoneFields,
  returnOn: optDate,
  restrictions: optText(500),
});
export type StatusInput = z.input<typeof StatusInput>;

/** Schimbă starea curentă a jucătorului (istoricul se scrie din trigger; marcajul „de verificat" dispare). */
export async function setPlayerStatus(input: StatusInput) {
  return run({ roles: ["physio"], revalidate: ["/disponibilitate", "/jucatori"], message: t.statusDialog.saved }, async ({ db, ctx }) => {
    const v = valid(StatusInput, input);
    const status = ctx.statuses.find((s) => s.id === v.statusId && s.is_active);
    if (!status) fail(e.statusUnknown);
    await mustSeePlayer(db, v.playerId);
    // Pentru o stare „apt" zona, revenirea și restricțiile nu mai au sens: se șterg.
    const fit = availabilityOf(status) === "full";
    const zone = fit ? { zone: null, side: null, detail: null, uncertain: false } : cleanZone(v);
    await updatePlayerStatus(db, v.playerId, {
      status_id: status.id,
      status_note: v.note,
      status_zone: zone.zone,
      status_side: zone.side,
      status_zone_detail: zone.detail,
      status_zone_uncertain: zone.uncertain,
      status_return_on: fit ? null : v.returnOn,
      training_restrictions: fit ? null : v.restrictions,
    });
    return { id: v.playerId };
  });
}

// ---------------------------------------------------------------------------
// Profil
// ---------------------------------------------------------------------------
const POSITION_CODES = Object.keys(POSITIONS) as [string, ...string[]];
const FOOT_CODES = Object.keys(FEET) as [string, ...string[]];

const PlayerFields = {
  fullName: z.string().trim().min(2, e.fullNameRequired).max(120, e.tooLong(120)),
  displayName: z.string().trim().min(1, e.displayNameRequired).max(60, e.tooLong(60)),
  groupId: z.union([z.uuid(), z.literal("")]).nullish().transform((v) => v || null),
  birthDate: optDate,
  position: z.union([z.enum(POSITION_CODES), z.literal("")]).nullish().transform((v) => v || null),
  positionDetail: optText(80),
  foot: z.union([z.enum(FOOT_CODES), z.literal("")]).nullish().transform((v) => v || null),
  shirtNumber: optNumber(1, 99, e.shirtNumber).refine((v) => v === null || Number.isInteger(v), e.shirtNumber),
  visaExpiresOn: optDate,
};
const CreatePlayerInput = z.object(PlayerFields);
const UpdatePlayerInput = z.object({ playerId: z.uuid(), ...PlayerFields });
export type PlayerInput = z.input<typeof CreatePlayerInput>;

function playerColumns(v: z.output<typeof CreatePlayerInput>) {
  return {
    full_name: v.fullName,
    display_name: v.displayName,
    group_id: v.groupId,
    birth_date: v.birthDate,
    position: v.position,
    position_detail: v.positionDetail,
    dominant_foot: v.foot,
    shirt_number: v.shirtNumber,
    medical_visa_expires_on: v.visaExpiresOn,
  };
}

export async function createPlayer(input: PlayerInput) {
  return run({ roles: ["physio"], revalidate: ["/jucatori", "/disponibilitate"], message: t.form.created }, async ({ db, ctx }) => {
    const v = valid(CreatePlayerInput, input);
    if (v.groupId && !ctx.groups.some((g) => g.id === v.groupId)) fail(e.groupUnknown);
    if (v.birthDate && v.birthDate > ctx.today) fail(e.futureDate);
    // Numele nu este cheie: același nume poate exista de mai multe ori (avertizarea se face în formular).
    const { data, error } = await db.from("players").insert({ club_id: ctx.club.id, ...playerColumns(v) }).select("id").single();
    if (error) throw error;
    return { id: data.id };
  });
}

export async function updatePlayer(input: PlayerInput & { playerId: string }) {
  return run({ roles: ["physio"], revalidate: ["/jucatori", "/disponibilitate"], message: t.form.saved }, async ({ db, ctx }) => {
    const v = valid(UpdatePlayerInput, input);
    if (v.groupId && !ctx.groups.some((g) => g.id === v.groupId)) fail(e.groupUnknown);
    if (v.birthDate && v.birthDate > ctx.today) fail(e.futureDate);
    const { data, error } = await db.from("players").update(playerColumns(v)).eq("id", v.playerId).select("id");
    if (error) throw error;
    if (!data?.length) fail(e.playerNotFound);
    return { id: v.playerId };
  });
}

const ActiveInput = z.object({ playerId: z.uuid(), active: z.boolean() });

export async function setPlayerActive(input: z.input<typeof ActiveInput>) {
  return run({ roles: ["physio"], revalidate: ["/jucatori", "/disponibilitate"] }, async ({ db }) => {
    const v = valid(ActiveInput, input);
    const { data, error } = await db.from("players").update({ is_active: v.active }).eq("id", v.playerId).select("id");
    if (error) throw error;
    if (!data?.length) fail(e.playerNotFound);
    return { active: v.active };
  });
}

const VisaInput = z.object({ playerId: z.uuid(), expiresOn: optDate });

export async function setMedicalVisa(input: z.input<typeof VisaInput>) {
  return run({ roles: ["physio"], revalidate: ["/jucatori"], message: t.summary.visaSaved }, async ({ db }) => {
    const v = valid(VisaInput, input);
    const { data, error } = await db.from("players").update({ medical_visa_expires_on: v.expiresOn }).eq("id", v.playerId).select("id");
    if (error) throw error;
    if (!data?.length) fail(e.playerNotFound);
    return { expiresOn: v.expiresOn };
  });
}

// ---------------------------------------------------------------------------
// Contact
// ---------------------------------------------------------------------------
const optEmail = z.union([z.email(e.email), z.literal("")]).nullish().transform((v) => v || null);
const ContactsInput = z.object({
  playerId: z.uuid(),
  phone: optText(40),
  email: optEmail,
  guardianName: optText(120),
  guardianPhone: optText(40),
  guardianEmail: optEmail,
});

export async function saveContacts(input: z.input<typeof ContactsInput>) {
  return run({ roles: ["physio"], message: t.summary.contactsSaved }, async ({ db }) => {
    const v = valid(ContactsInput, { ...input, email: input.email?.trim(), guardianEmail: input.guardianEmail?.trim() });
    await mustSeePlayer(db, v.playerId);
    const { error } = await db.from("player_contacts").upsert(
      {
        player_id: v.playerId,
        phone: v.phone,
        email: v.email,
        guardian_name: v.guardianName,
        guardian_phone: v.guardianPhone,
        guardian_email: v.guardianEmail,
      },
      { onConflict: "player_id" },
    );
    if (error) throw error;
    return { id: v.playerId };
  });
}

// ---------------------------------------------------------------------------
// Antropometrie
// ---------------------------------------------------------------------------
const AnthroInput = z.object({
  playerId: z.uuid(),
  measuredOn: reqDate,
  heightCm: optNumber(80, 250, e.height),
  weightKg: optNumber(20, 200, e.weight),
  bodyFatPct: optNumber(2, 60, e.bodyFat),
  muscleMassKg: optNumber(10, 150, e.muscleMass),
  notes: optText(500),
});

export async function addAnthropometric(input: z.input<typeof AnthroInput>) {
  return run({ roles: ["physio"], message: t.summary.anthroSaved }, async ({ db, ctx }) => {
    const v = valid(AnthroInput, input);
    if (v.measuredOn > ctx.today) fail(e.futureDate);
    if (v.heightCm === null && v.weightKg === null && v.bodyFatPct === null && v.muscleMassKg === null) fail(e.anthroEmpty);
    await mustSeePlayer(db, v.playerId);
    const { error } = await db.from("anthropometrics").insert({
      player_id: v.playerId,
      measured_on: v.measuredOn,
      height_cm: v.heightCm,
      weight_kg: v.weightKg,
      body_fat_pct: v.bodyFatPct,
      muscle_mass_kg: v.muscleMassKg,
      notes: v.notes,
      created_by: ctx.userId,
    });
    if (error) throw error;
    return { id: v.playerId };
  });
}

const IdInput = z.object({ id: z.uuid() });

export async function deleteAnthropometric(input: z.input<typeof IdInput>) {
  return run({ roles: ["physio"], message: t.summary.anthroDeleted }, async ({ db }) => {
    const v = valid(IdInput, input);
    const { data, error } = await db.from("anthropometrics").delete().eq("id", v.id).select("id");
    if (error) throw error;
    if (!data?.length) fail(e.notSaved);
    return { id: v.id };
  });
}

// ---------------------------------------------------------------------------
// Consimțământ
// ---------------------------------------------------------------------------
const ConsentInput = z.object({
  playerId: z.uuid(),
  guardianName: z.string().trim().min(2, e.guardianRequired).max(120, e.tooLong(120)),
  guardianRelation: optText(60),
  signedOn: reqDate,
});

/** Acordul pe hârtie al părintelui / tutorelui, înregistrat de preparator. */
export async function recordGuardianConsent(input: z.input<typeof ConsentInput>) {
  return run({ roles: ["physio"], message: t.summary.consentSaved }, async ({ db, ctx }) => {
    const v = valid(ConsentInput, input);
    if (v.signedOn > ctx.today) fail(e.futureDate);
    await mustSeePlayer(db, v.playerId);
    const { error } = await db.from("consents").insert({
      player_id: v.playerId,
      kind: "guardian_paper",
      guardian_name: v.guardianName,
      guardian_relation: v.guardianRelation,
      text_version: CONSENT_VERSION,
      recorded_by: ctx.userId,
      // semnat în ziua aleasă; ora nu se cunoaște, punem miezul zilei ca data să nu alunece cu fusul orar
      accepted_at: v.signedOn === ctx.today ? new Date().toISOString() : `${v.signedOn}T12:00:00Z`,
    });
    if (error) throw error;
    return { id: v.playerId };
  });
}

export async function withdrawConsent(input: z.input<typeof IdInput>) {
  return run({ roles: ["physio"], message: t.summary.consentWithdrawnToast }, async ({ db }) => {
    const v = valid(IdInput, input);
    const { data, error } = await db.from("consents").update({ withdrawn_at: new Date().toISOString() })
      .eq("id", v.id).eq("kind", "guardian_paper").is("withdrawn_at", null).select("id");
    if (error) throw error;
    if (!data?.length) fail(e.notSaved);
    return { id: v.id };
  });
}
