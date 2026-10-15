import { parseWellnessConfig } from "@club/shared";
import { requireRole } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { GroupsManager, type GroupItem } from "@/components/admin/groups-manager";
import { getT } from "@/messages";

export const metadata = { title: "Grupe" };

export default async function Page() {
  const { db, ctx } = await requireRole("physio", "admin");
  const t = getT().admin.groups;
  const [players, staffGroups, coaches] = await Promise.all([
    db.from("players").select("group_id, is_active"),
    db.from("staff_groups").select("user_id, group_id"),
    db.from("profiles").select("id, full_name, is_active").eq("role", "coach").order("full_name"),
  ]);
  const coachIds = new Set((coaches.data ?? []).map((c) => c.id));
  const groups: GroupItem[] = ctx.groups.map((g) => {
    const inGroup = (players.data ?? []).filter((p) => p.group_id === g.id);
    return {
      id: g.id,
      name: g.name,
      isActive: g.is_active,
      reminderHour: g.reminder_hour,
      wellness: parseWellnessConfig(g.wellness_config),
      coachIds: (staffGroups.data ?? []).filter((s) => s.group_id === g.id && coachIds.has(s.user_id)).map((s) => s.user_id),
      activePlayers: inGroup.filter((p) => p.is_active).length,
      totalPlayers: inGroup.length,
    };
  });

  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      {groups.length ? null : <EmptyState title={t.emptyTitle} description={t.empty} />}
      <GroupsManager
        groups={groups}
        coaches={(coaches.data ?? []).map((c) => ({ id: c.id, name: c.full_name, active: c.is_active }))}
        clubReminderHour={ctx.settings.reminder_hour}
      />
    </>
  );
}
