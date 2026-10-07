import { POSITIONS, label } from "@club/shared";
import type { Messages } from "@/messages";
import { periodLabel, weekdaysLabel } from "./format";

type AssignmentLike = {
  target_type: string; group_id: string | null; position: string | null;
  start_date: string; end_date: string | null; weekdays: number[]; playerIds: string[];
};

/** „Grupa Seniori", „Fundaș, toate grupele", „POPESCU", „Selecție manuală (4)" */
export function targetLabel(a: AssignmentLike, playerNames: Map<string, string>, groupNames: Map<string, string>, t: Messages["planning"]["assignments"]): string {
  const group = a.group_id ? groupNames.get(a.group_id) ?? t.target.unknownGroup : null;
  switch (a.target_type) {
    case "group": return t.target.group(group ?? t.target.unknownGroup);
    case "position": return t.target.position(label(POSITIONS, a.position, a.position ?? "—"), group);
    case "player": return t.target.player(playerNames.get(a.playerIds[0] ?? "") ?? t.target.unknownPlayer);
    default: return t.target.manual(a.playerIds.length);
  }
}

export function scheduleLabels(a: AssignmentLike, t: Messages["planning"]["assignments"]): { days: string; period: string } {
  return { days: weekdaysLabel(a.weekdays, t.everyDay), period: periodLabel(a.start_date, a.end_date, t.period) };
}
