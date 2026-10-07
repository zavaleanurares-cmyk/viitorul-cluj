"use server";
import { z } from "zod";
import { fail, run } from "@/lib/actions";
import { deleteFiles } from "@/lib/storage";
import { getT } from "@/messages";

const t = getT().admin;
// numele, sigla și culorile apar în tot interiorul aplicației
const PATHS = ["/administrare/club", "/administrare"];
const Hex = z.string().trim().regex(/^#[0-9a-f]{6}$/i, t.errors.colorInvalid).transform((v) => v.toLowerCase());

const Identity = z.object({
  name: z.string().trim().min(2, t.errors.nameNeeded).max(80),
  shortName: z.string().trim().max(20, t.errors.shortNameLong),
  primaryColor: Hex,
  accentColor: Hex,
});

export async function saveClubIdentity(input: z.infer<typeof Identity>) {
  return run({ roles: ["physio"], revalidate: PATHS, message: t.club.identitySaved }, async ({ db, ctx }) => {
    const v = Identity.parse(input);
    const { error } = await db.from("clubs").update({
      name: v.name, short_name: v.shortName || null, primary_color: v.primaryColor, accent_color: v.accentColor,
    }).eq("id", ctx.club.id);
    if (error) throw error;
  });
}

const Logo = z.object({ path: z.string().max(200).nullable() });

/** Leagă sigla încărcată de club (sau o scoate, cu `path: null`) și șterge fișierul vechi. */
export async function setClubLogo(input: z.infer<typeof Logo>) {
  return run({ roles: ["physio"], revalidate: PATHS, message: input.path ? t.club.logoSaved : t.club.logoRemoved }, async ({ db, ctx }) => {
    const v = Logo.parse(input);
    // calea trebuie să fie în directorul clubului apelantului
    if (v.path !== null && !new RegExp(`^${ctx.club.id}/sigla-[0-9]+\\.(png|webp|jpg)$`).test(v.path)) fail(t.errors.logoInvalid);
    const previous = ctx.club.logo_path;
    const { error } = await db.from("clubs").update({ logo_path: v.path }).eq("id", ctx.club.id);
    if (error) throw error;
    if (previous && previous !== v.path) await deleteFiles(db, "branding", [previous]);
  });
}

const isTimezone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};
const int = (min: number, max: number) => z.number(t.errors.numberNeeded).int(t.errors.numberNeeded).min(min, t.errors.outOfRange(min, max)).max(max, t.errors.outOfRange(min, max));

const Settings = z.object({
  timezone: z.string().refine(isTimezone, t.errors.timezoneInvalid),
  season_start: z.iso.date().nullable(),
  reminder_hour: int(0, 23),
  medical_visa_validity_months: int(1, 36),
  retention_months: int(1, 240),
  alerts: z.object({
    fatigue_threshold: int(1, 10),
    muscle_load_threshold: int(1, 10),
    spike_delta: int(1, 9),
    pain_intensity_threshold: int(1, 10),
    missing_days: int(1, 30),
    visa_days_before: int(1, 180),
  }),
});

/**
 * Setările clubului. Se scrie mereu obiectul complet și validat; cheile pe care acest formular
 * nu le cunoaște (adăugate de alte module) se păstrează neschimbate.
 */
export async function saveClubSettings(input: z.infer<typeof Settings>) {
  return run({ roles: ["physio"], revalidate: PATHS, message: t.club.settingsSaved }, async ({ db, ctx }) => {
    const v = Settings.parse(input);
    const raw = ctx.club.settings;
    const existing = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const existingAlerts = existing.alerts && typeof existing.alerts === "object" && !Array.isArray(existing.alerts) ? existing.alerts : {};
    const settings = { ...existing, ...v, alerts: { ...existingAlerts, ...v.alerts } };
    const { error } = await db.from("clubs").update({ settings }).eq("id", ctx.club.id);
    if (error) throw error;
  });
}
