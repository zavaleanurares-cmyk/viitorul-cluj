"use server";
import { z } from "zod";
import { fail, run } from "@/lib/actions";

const Rows = z.array(z.object({
  player_id: z.uuid(),
  status: z.enum(["present", "late", "absent", "injured"]),
  reason: z.enum(["sick", "injured", "school", "family", "unexcused", "other"]).nullable(),
  recorded_at: z.iso.datetime({ offset: true }),
})).max(80);

/** Trimite prezența (din ecran sau din coada offline). Idempotent: aceeași variantă trimisă de două ori nu schimbă nimic. */
export async function syncAttendance(input: { eventId: string; rows: z.input<typeof Rows> }) {
  return run<number>({ roles: ["admin", "secretary", "sporting_director", "physio", "coach"], revalidate: ["/program", "/azi"] }, async ({ db }) => {
    const eventId = z.uuid().parse(input.eventId);
    const rows = Rows.parse(input.rows);
    const { data, error } = await db.rpc("save_attendance", { p_event: eventId, p_rows: rows });
    if (error) fail(error.message);
    return (data as number) ?? 0;
  });
}
