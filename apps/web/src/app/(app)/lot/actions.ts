"use server";
import { z } from "zod";
import { AuthError, createServiceDb, createUser, deleteUser, findUserByEmail } from "@club/db";
import { fail, run } from "@/lib/actions";
import { issueAccessLink, type AccessLink } from "@/components/admin/server";
import { getT } from "@/messages";

const t = getT().squad;
const OFFICE = ["admin", "secretary", "sporting_director", "physio"] as const;
const PATHS = ["/lot", "/lot/echipe", "/lot/parinti"];

const optText = (max: number) => z.string().trim().max(max).transform((v) => v || null).nullable().optional();
const optDate = z.union([z.iso.date(t.form.invalidDate), z.literal("")]).transform((v) => v || null).nullable().optional();

// ---------------------------------------------------------------------------
// Jucători
// ---------------------------------------------------------------------------
const PlayerInput = z.object({
  id: z.uuid().optional(),
  fullName: z.string().trim().min(2, t.form.nameRequired).max(120),
  displayName: z.string().trim().max(60).optional(),
  birthDate: optDate,
  groupId: z.union([z.uuid(), z.literal("")]).transform((v) => v || null),
  position: z.enum(["GK", "DEF", "MID", "FWD", ""]).transform((v) => v || null),
  positionDetail: optText(60),
  foot: z.enum(["left", "right", "both", ""]).transform((v) => v || null),
  shirt: z.union([z.coerce.number().int().min(1).max(99), z.literal("")]).transform((v) => (v === "" ? null : v)).nullable(),
  nationality: optText(60),
  registration: optText(40),
  fifaId: optText(40),
  enrolledOn: optDate,
  visa: optDate,
  photoConsent: z.boolean(),
});
export type PlayerInput = z.input<typeof PlayerInput>;

export async function savePlayer(input: PlayerInput) {
  return run<{ id: string }>({ roles: [...OFFICE], revalidate: PATHS, message: input.id ? t.form.saved : t.form.created }, async ({ db, ctx }) => {
    const v = PlayerInput.parse(input);
    if (v.groupId && !ctx.groups.some((g) => g.id === v.groupId)) fail("Echipă necunoscută.");
    if (v.shirt && v.groupId) {
      let q = db.from("players").select("id, display_name").eq("group_id", v.groupId).eq("shirt_number", v.shirt).eq("is_active", true);
      if (v.id) q = q.neq("id", v.id);
      const { data: taken } = await q.limit(1);
      if (taken?.length) fail(t.form.shirtTaken(v.shirt, taken[0].display_name));
    }
    const display = v.displayName?.trim() || defaultDisplayName(v.fullName);
    const row = {
      full_name: v.fullName, display_name: display, birth_date: v.birthDate ?? null, group_id: v.groupId,
      position: v.position, position_detail: v.positionDetail ?? null, dominant_foot: v.foot, shirt_number: v.shirt,
      nationality: v.nationality ?? null, registration_number: v.registration ?? null, fifa_id: v.fifaId ?? null,
      enrolled_on: v.enrolledOn ?? null, medical_visa_expires_on: v.visa ?? null, photo_consent: v.photoConsent,
    };
    if (v.id) {
      const { data, error } = await db.from("players").update(row).eq("id", v.id).select("id");
      if (error) throw error;
      if (!data?.length) fail("Nu ai dreptul să modifici acest jucător.");
      return { id: v.id };
    }
    const { data, error } = await db.from("players").insert({ ...row, club_id: ctx.club.id, enrolled_on: v.enrolledOn ?? ctx.today }).select("id").single();
    if (error) throw error;
    return { id: data.id };
  });
}

/** „Popescu Andrei" → „POPESCU A." (cum îi scrie staff-ul în liste). */
function defaultDisplayName(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return full.toLocaleUpperCase("ro");
  return `${parts[0].toLocaleUpperCase("ro")} ${parts[1][0].toLocaleUpperCase("ro")}.`;
}

export async function setPlayerActive(input: { id: string; active: boolean }) {
  return run({ roles: [...OFFICE], revalidate: PATHS, message: input.active ? t.form.reactivated : t.form.deactivated }, async ({ db }) => {
    const v = z.object({ id: z.uuid(), active: z.boolean() }).parse(input);
    const { data, error } = await db.from("players").update({ is_active: v.active }).eq("id", v.id).select("id");
    if (error) throw error;
    if (!data?.length) fail("Nu ai dreptul să modifici acest jucător.");
    return null;
  });
}

// ---------------------------------------------------------------------------
// Echipe
// ---------------------------------------------------------------------------
const TeamInput = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1).max(60),
  programme: optText(40),
  yearFrom: z.union([z.coerce.number().int().min(1950).max(2100), z.literal("")]).transform((v) => (v === "" ? null : v)).nullable(),
  yearTo: z.union([z.coerce.number().int().min(1950).max(2100), z.literal("")]).transform((v) => (v === "" ? null : v)).nullable(),
  gender: z.enum(["m", "f", "mixed", ""]).transform((v) => v || null),
  playersOnPitch: z.union([z.coerce.number().int().min(4).max(11), z.literal("")]).transform((v) => (v === "" ? null : v)).nullable(),
  halfMinutes: z.union([z.coerce.number().int().min(5).max(60), z.literal("")]).transform((v) => (v === "" ? null : v)).nullable(),
  color: z.union([z.string().regex(/^#[0-9a-fA-F]{6}$/), z.literal("")]).transform((v) => v || null).nullable(),
});
export type TeamInput = z.input<typeof TeamInput>;

export async function saveTeam(input: TeamInput) {
  return run<{ id: string }>({ roles: ["admin", "secretary", "sporting_director", "physio"], revalidate: PATHS, message: input.id ? t.teams.saved : t.teams.created }, async ({ db, ctx }) => {
    const v = TeamInput.parse(input);
    const { data: season } = await db.from("seasons").select("id").eq("is_current", true).maybeSingle();
    const row = {
      name: v.name, programme: v.programme ?? null, birth_year_from: v.yearFrom, birth_year_to: v.yearTo ?? v.yearFrom,
      gender: v.gender, players_on_pitch: v.playersOnPitch, half_minutes: v.halfMinutes, color: v.color,
    };
    if (v.id) {
      const { data, error } = await db.from("groups").update(row).eq("id", v.id).select("id");
      if (error) throw error;
      if (!data?.length) fail("Nu ai dreptul să modifici echipa.");
      return { id: v.id };
    }
    const sort = Math.max(0, ...ctx.groups.map((g) => g.sort)) + 1;
    const { data, error } = await db.from("groups").insert({ ...row, club_id: ctx.club.id, sort, season_id: season?.id ?? null }).select("id").single();
    if (error) throw error;
    return { id: data.id };
  });
}

// ---------------------------------------------------------------------------
// Părinți
// ---------------------------------------------------------------------------
const GuardianInput = z.object({
  id: z.uuid().optional(),
  fullName: z.string().trim().min(2, t.form.nameRequired).max(120),
  phone: optText(40),
  email: z.union([z.email(), z.literal("")]).transform((v) => v || null).nullable().optional(),
  notes: optText(1000),
  children: z.array(z.object({
    playerId: z.uuid(),
    relation: z.enum(["mother", "father", "parent", "guardian", "other"]),
    isBilling: z.boolean(),
  })).max(10),
});
export type GuardianInput = z.input<typeof GuardianInput>;

export async function saveGuardian(input: GuardianInput) {
  return run<{ id: string }>({ roles: [...OFFICE], revalidate: PATHS, message: input.id ? t.guardians.saved : t.guardians.created }, async ({ db, ctx }) => {
    const v = GuardianInput.parse(input);
    const row = { full_name: v.fullName, phone: v.phone ?? null, email: v.email ?? null, notes: v.notes ?? null };
    let id = v.id;
    if (id) {
      const { data, error } = await db.from("guardians").update(row).eq("id", id).select("id");
      if (error) throw error;
      if (!data?.length) fail("Nu ai dreptul să modifici acest părinte.");
    } else {
      const { data, error } = await db.from("guardians").insert({ ...row, club_id: ctx.club.id }).select("id").single();
      if (error) throw error;
      id = data.id;
    }
    const wanted = new Map(v.children.map((c) => [c.playerId, c]));
    const { data: existing } = await db.from("guardian_players").select("player_id").eq("guardian_id", id);
    const remove = (existing ?? []).map((e) => e.player_id).filter((p) => !wanted.has(p));
    if (remove.length) {
      const { error } = await db.from("guardian_players").delete().eq("guardian_id", id).in("player_id", remove);
      if (error) throw error;
    }
    if (wanted.size) {
      const { error } = await db.from("guardian_players").upsert(
        [...wanted.values()].map((c) => ({ guardian_id: id!, player_id: c.playerId, relation: c.relation, is_billing: c.isBilling })),
        { onConflict: "guardian_id,player_id" },
      );
      if (error) throw error;
    }
    return { id: id! };
  });
}

export async function deleteGuardian(id: string) {
  return run({ roles: [...OFFICE], revalidate: PATHS }, async ({ db }) => {
    const gid = z.uuid().parse(id);
    const { data, error } = await db.from("guardians").update({ deleted_at: new Date().toISOString() }).eq("id", gid).select("id");
    if (error) throw error;
    if (!data?.length) fail("Nu ai dreptul să ștergi acest părinte.");
    return null;
  });
}

export async function restoreGuardian(id: string) {
  return run({ roles: [...OFFICE], revalidate: PATHS }, async ({ db }) => {
    const gid = z.uuid().parse(id);
    const { error } = await db.from("guardians").update({ deleted_at: null }).eq("id", gid);
    if (error) throw error;
    return null;
  });
}

/**
 * Cont în aplicație pentru părinte: utilizator + profil cu rolul „guardian", legat de fișa părintelui.
 * Profilul se scrie cu clientul de serviciu (secretariatul nu are drept pe conturi), după verificarea
 * explicită a rolului și a clubului; fișa părintelui se leagă cu identitatea utilizatorului (RLS).
 */
export async function inviteGuardian(id: string) {
  return run<AccessLink>({ roles: [...OFFICE], revalidate: PATHS, message: t.guardians.inviteSent }, async (session) => {
    const { db, ctx } = session;
    const gid = z.uuid().parse(id);
    const { data: g, error } = await db.from("guardians").select("id, full_name, email, user_id").eq("id", gid).is("deleted_at", null).maybeSingle();
    if (error) throw error;
    if (!g) fail("Părintele nu a fost găsit.");
    if (!g.email) fail(t.guardians.inviteNeedsEmail);
    let userId = g.user_id;
    if (!userId) {
      const existing = await findUserByEmail(g.email);
      if (existing) {
        userId = existing.id;
      } else {
        try {
          userId = (await createUser({ email: g.email })).id;
        } catch (e) {
          if (e instanceof AuthError) fail(e.message);
          throw e;
        }
      }
      const service = createServiceDb();
      const { data: profile } = await service.from("profiles").select("id, club_id").eq("id", userId).maybeSingle();
      if (!profile) {
        const { error: pErr } = await service.from("profiles").insert({ id: userId, club_id: ctx.club.id, role: "guardian", full_name: g.full_name, email: g.email });
        if (pErr) {
          if (!existing) await deleteUser(userId).catch(() => {});
          throw pErr;
        }
      } else {
        // contul există deja (alt rol sau alt club): adăugăm doar rolul de părinte în acest club
        await service.from("memberships").upsert({ user_id: userId, club_id: ctx.club.id, role: "guardian", is_active: true }, { onConflict: "user_id,club_id,role" });
      }
      const { error: lErr } = await db.from("guardians").update({ user_id: userId }).eq("id", gid);
      if (lErr) throw lErr;
    }
    return issueAccessLink(session, { id: userId, email: g.email, name: g.full_name }, "invite");
  });
}
