import "server-only";
import { unwrap, type Db, type Tables } from "@club/shared";

/**
 * Interogările modulului „chestionare". Toate rulează cu clientul utilizatorului (RLS activ):
 * antrenorul primește doar grupele lui, iar alertele vin doar pentru preparator.
 */

export type RpeEntry = Tables<"rpe_entries">;
export type Alert = Tables<"alerts">;
export type AlertWithPlayer = Alert & { players: { id: string; display_name: string; group_id: string | null } };

export async function listRpeFor(db: Db, playerIds: string[], from: string, to: string): Promise<RpeEntry[]> {
  if (!playerIds.length) return [];
  return unwrap(
    await db.from("rpe_entries").select("*").in("player_id", playerIds).gte("entry_date", from).lte("entry_date", to).order("entry_date"),
  );
}

const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 };

function sortAlerts<T extends Alert>(rows: T[]): T[] {
  return rows.sort(
    (a, b) =>
      (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9) ||
      b.alert_date.localeCompare(a.alert_date) ||
      b.created_at.localeCompare(a.created_at),
  );
}

/** Alertele deschise ale clubului (RLS: doar preparatorul primește rânduri). */
export async function listOpenAlerts(db: Db): Promise<AlertWithPlayer[]> {
  const { data, error } = await db.from("alerts")
    .select("*, players!inner ( id, display_name, group_id )")
    .is("resolved_at", null).order("alert_date", { ascending: false }).limit(500);
  if (error) return [];
  return sortAlerts((data ?? []) as unknown as AlertWithPlayer[]);
}

export async function listPlayerAlerts(db: Db, playerId: string): Promise<Alert[]> {
  const { data, error } = await db.from("alerts").select("*").eq("player_id", playerId)
    .is("resolved_at", null).order("alert_date", { ascending: false }).limit(100);
  if (error) return [];
  return sortAlerts(data ?? []);
}
