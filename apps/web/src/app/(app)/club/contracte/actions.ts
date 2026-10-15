"use server";
import { z } from "zod";
import { headers } from "next/headers";
import { STANDARD_CONTRACTS } from "@club/shared";
import { run, fail } from "@/lib/actions";
import { getT } from "@/messages";

const t = getT().club.contracts;
const OFFICE = ["admin", "secretary"] as const;
const PATHS = ["/club/contracte"];

const Tpl = z.object({ id: z.uuid().nullish(), name: z.string().trim().min(2).max(120), kind: z.enum(["enrolment", "photo_consent", "medical_consent", "transport", "sponsorship", "other"]), body: z.string().trim().min(20).max(50000) });

export async function saveContractTemplate(input: z.input<typeof Tpl>) {
  return run({ roles: [...OFFICE], revalidate: PATHS, message: t.templateSaved }, async ({ db }) => {
    const v = Tpl.safeParse(input);
    if (!v.success) fail(t.errors.templateInvalid);
    const { data, error } = await db.rpc("save_contract_template", { p: { id: v.data.id ?? null, name: v.data.name, kind: v.data.kind, body: v.data.body } });
    if (error) throw error;
    return { id: data as string };
  });
}

export async function addStandardContract(input: { key: string }) {
  return run({ roles: [...OFFICE], revalidate: PATHS, message: t.templateSaved }, async ({ db }) => {
    const s = STANDARD_CONTRACTS.find((x) => x.key === input.key);
    if (!s) fail(t.errors.templateInvalid);
    const { data, error } = await db.rpc("save_contract_template", { p: { name: s.name, kind: s.kind, body: s.body } });
    if (error) throw error;
    return { id: data as string };
  });
}

const Send = z.object({ templateId: z.uuid(), playerIds: z.array(z.uuid()).min(1).max(500), dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish() });

export async function sendContracts(input: z.input<typeof Send>) {
  return run({ roles: [...OFFICE], revalidate: PATHS }, async ({ db }) => {
    const v = Send.safeParse(input);
    if (!v.success) fail(t.errors.invalid);
    const { data, error } = await db.rpc("send_contracts", { p_template: v.data.templateId, p_players: v.data.playerIds, p_due_on: v.data.dueOn ?? undefined });
    if (error) throw error;
    return data as { sent: number; skipped: Array<{ player: string }> };
  });
}

export async function remindContracts(input: { ids: string[] }) {
  return run({ roles: [...OFFICE], revalidate: PATHS }, async ({ db }) => {
    const ids = z.array(z.uuid()).min(1).max(500).parse(input.ids);
    const { data, error } = await db.rpc("remind_contracts", { p_ids: ids });
    if (error) throw error;
    return { reminded: (data as number) ?? 0 };
  });
}

export async function voidContract(input: { id: string; reason: string }) {
  return run({ roles: [...OFFICE], revalidate: PATHS, message: t.voided }, async ({ db }) => {
    const { error } = await db.rpc("void_contract", { p_id: z.uuid().parse(input.id), p_reason: z.string().trim().min(2).max(500).parse(input.reason) });
    if (error) throw error;
    return null;
  });
}

async function clientInfo() {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || null;
  return { ip, ua: h.get("user-agent") };
}

const Sign = z.object({ id: z.uuid(), name: z.string().trim().min(3).max(120), signaturePath: z.string().min(10).max(300) });

/** Semnarea (părintele sau jucătorul adult). IP-ul și browserul rămân în urma de audit. */
export async function signContract(input: z.input<typeof Sign>) {
  return run({ roles: ["guardian", "player"], revalidate: ["/contracte", "/azi"], message: t.family.signed }, async ({ db }) => {
    const v = Sign.parse(input);
    const { ip, ua } = await clientInfo();
    const { data, error } = await db.rpc("sign_contract", { p_id: v.id, p_name: v.name, p_signature_path: v.signaturePath, p_ip: ip ?? undefined, p_user_agent: ua ?? undefined });
    if (error) throw error;
    return { hash: data as string };
  });
}

export async function declineContract(input: { id: string; reason: string }) {
  return run({ roles: ["guardian", "player"], revalidate: ["/contracte", "/azi"], message: t.family.declined }, async ({ db }) => {
    const { error } = await db.rpc("decline_contract", { p_id: z.uuid().parse(input.id), p_reason: z.string().trim().min(2).max(500).parse(input.reason) });
    if (error) throw error;
    return null;
  });
}

export async function recordView(input: { id: string }) {
  return run({ roles: ["guardian", "player"], revalidate: [] }, async ({ db }) => {
    const { ip } = await clientInfo();
    await db.rpc("view_contract", { p_id: z.uuid().parse(input.id), p_ip: ip ?? undefined });
    return null;
  });
}
