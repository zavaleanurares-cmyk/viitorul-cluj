"use server";
import { z } from "zod";
import { createAnonDb } from "@club/db";
import { friendlyError } from "@club/shared";
import { visitorIp } from "@/lib/public-site";
import { getT } from "@/messages";

export type PublicResult = { ok: true } | { ok: false; error: string };

/** Trimiterile prea rapide (sub 3 secunde de la deschiderea formularului) și câmpul-capcană completat sunt roboți. */
function looksLikeBot(meta: { startedAt: number; website?: string }): boolean {
  return !!meta.website || !Number.isFinite(meta.startedAt) || Date.now() - meta.startedAt < 3000;
}

const Enrolment = z.object({
  childName: z.string().trim().min(3).max(120),
  birthDate: z.iso.date(),
  groupId: z.union([z.uuid(), z.literal("")]).optional(),
  previousClub: z.string().trim().max(120).optional(),
  position: z.enum(["GK", "DEF", "MID", "FWD", ""]).optional(),
  notes: z.string().trim().max(1000).optional(),
  parentName: z.string().trim().min(3).max(120),
  relation: z.enum(["mother", "father", "parent", "guardian", "other"]).default("parent"),
  email: z.union([z.email(), z.literal("")]).optional(),
  phone: z.string().trim().max(20).optional(),
  consent: z.literal(true),
});

export async function submitEnrolment(slug: string, input: z.input<typeof Enrolment>, meta: { startedAt: number; website?: string }): Promise<PublicResult> {
  const t = getT();
  const v = Enrolment.safeParse(input);
  if (!v.success) return { ok: false, error: input.consent ? t.club.enrolment.errors.invalid : t.site.enrol.consent };
  if (!v.data.email && !v.data.phone) return { ok: false, error: t.club.enrolment.errors.contact };
  if (looksLikeBot(meta)) return { ok: false, error: t.site.errors.tooFast };
  const d = v.data;
  const { error } = await createAnonDb().rpc("submit_enrolment_request", {
    p_slug: slug,
    p: {
      child_name: d.childName, birth_date: d.birthDate, group_id: d.groupId ?? "", previous_club: d.previousClub ?? "",
      position: d.position ?? "", notes: d.notes ?? "", parent_name: d.parentName, relation: d.relation,
      parent_email: d.email ?? "", parent_phone: d.phone ?? "", consent: true,
    },
    p_ip: (await visitorIp()) ?? undefined,
  });
  if (error) return { ok: false, error: friendlyError(error) || t.site.errors.generic };
  return { ok: true };
}
