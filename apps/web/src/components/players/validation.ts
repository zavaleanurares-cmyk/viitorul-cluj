import { z } from "zod";
import { BODY_ZONES, DataError, zoneIsSided } from "@club/shared";
import { getT } from "@/messages";

const e = getT().players.errors;

/** Validează intrarea unei acțiuni; mesajele implicite (în engleză) ale zod devin un mesaj generic în română. */
export function valid<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const res = schema.safeParse(input);
  if (res.success) return res.data;
  const message = res.error.issues[0]?.message ?? "";
  const custom = message && !/^(Invalid|Too |Expected|Unrecognized|Required)/i.test(message);
  throw new DataError(custom ? message : e.invalid);
}

/** Text opțional: tăiat, gol devine null. */
export const optText = (max: number) =>
  z.string().trim().max(max, e.tooLong(max)).nullish().transform((v) => v || null);

/** Dată opțională AAAA-LL-ZZ; șirul gol devine null. */
export const optDate = z.union([z.iso.date(), z.literal("")]).nullish().transform((v) => v || null);

export const reqDate = z.iso.date(e.dateRequired);

const ZONE_CODES = BODY_ZONES.map((z) => z.code) as [string, ...string[]];

/** Zonă pe harta corpului + parte + detaliu liber + „de confirmat". */
export const zoneFields = {
  zone: z.enum(ZONE_CODES).nullish().transform((v) => v ?? null),
  side: z.string().nullish().transform((v) => (v === "left" || v === "right" || v === "both" ? v : null)),
  detail: optText(200),
  uncertain: z.boolean().default(false),
};

export function cleanZone(v: { zone: string | null; side: string | null; detail: string | null; uncertain: boolean }) {
  const hasAny = !!v.zone || !!v.detail;
  return {
    zone: v.zone,
    side: v.zone && zoneIsSided(v.zone) ? v.side : null,
    detail: v.detail,
    uncertain: hasAny ? v.uncertain : false,
  };
}

/** Număr opțional într-un interval; null / lipsă rămân null. */
export const optNumber = (min: number, max: number, message: string) =>
  z.union([z.number(), z.null(), z.undefined()])
    .transform((v) => (typeof v === "number" && Number.isFinite(v) ? v : null))
    .refine((v) => v === null || (v >= min && v <= max), message);
