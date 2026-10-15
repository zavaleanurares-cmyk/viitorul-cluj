"use server";
import { z } from "zod";
import { run, fail } from "@/lib/actions";
import { getT } from "@/messages";
import { STANDARD_BATTERIES } from "@/components/physical/standard-batteries";

const t = getT().performance.tests;
const PATHS = ["/fizic/teste", "/fizic/teste/baterie"];

/** Adaugă o baterie standard (testele lipsă se creează, cele existente se refolosesc după cod). */
export async function addStandardBattery(input: { key: string }) {
  return run({ roles: ["physio"], revalidate: PATHS, message: t.batteryAdded }, async ({ db }) => {
    const b = STANDARD_BATTERIES.find((x) => x.key === input.key);
    if (!b) fail(t.errors.unknownBattery);
    const { data, error } = await db.rpc("create_fitness_battery", { p: { name: b.name, description: b.description, tests: b.tests } });
    if (error) throw error;
    return { id: data as string };
  });
}

const Custom = z.object({ name: z.string().trim().min(2).max(80), testIds: z.array(z.uuid()).min(1).max(20) });

export async function createBattery(input: z.input<typeof Custom>) {
  return run({ roles: ["physio"], revalidate: PATHS, message: t.batteryAdded }, async ({ db }) => {
    const v = Custom.safeParse(input);
    if (!v.success) fail(t.errors.batteryInvalid);
    const { data, error } = await db.rpc("create_fitness_battery", { p: { name: v.data.name, tests: v.data.testIds.map((id) => ({ id })) } });
    if (error) throw error;
    return { id: data as string };
  });
}

export async function deleteBattery(input: { id: string }) {
  return run({ roles: ["physio"], revalidate: PATHS, message: t.batteryDeleted }, async ({ db }) => {
    const id = z.uuid().parse(input.id);
    // rezultatele rămân pe teste; se șterge doar gruparea
    const { data, error } = await db.from("fitness_batteries").delete().eq("id", id).select("id");
    if (error) throw error;
    if (!data?.length) fail(t.errors.unknownBattery);
    return null;
  });
}

const Grid = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rows: z.array(z.object({ playerId: z.uuid(), testId: z.uuid(), value: z.number().min(0).max(99999).nullable() })).max(2000),
});

export async function saveTestGrid(input: z.input<typeof Grid>) {
  return run({ roles: ["physio"], revalidate: [...PATHS, "layout:/lot/jucatori/[id]"] }, async ({ db }) => {
    const v = Grid.parse(input);
    const { data, error } = await db.rpc("save_test_grid", {
      p_date: v.date, p_rows: v.rows.map((r) => ({ player_id: r.playerId, test_id: r.testId, value: r.value })),
    });
    if (error) throw error;
    return { saved: (data as number) ?? 0 };
  });
}
