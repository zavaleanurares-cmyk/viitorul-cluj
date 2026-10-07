import { DEFAULT_STATUS_CODES, type Availability, type StatusTone } from "@club/shared";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui/card";
import { StatusesManager, type StatusItem } from "@/components/admin/statuses-manager";
import { getT } from "@/messages";

export const metadata = { title: "Stări" };

export default async function Page() {
  const { db, ctx } = await requireRole("physio");
  const t = getT().admin.statuses;
  const [players, history] = await Promise.all([
    db.from("players").select("status_id, is_active"),
    db.from("status_history").select("status_id"),
  ]);
  const used = new Set([...(players.data ?? []), ...(history.data ?? [])].map((r) => r.status_id));
  const statuses: StatusItem[] = ctx.statuses.map((s) => ({
    id: s.id,
    code: s.code,
    label: s.label,
    shortLabel: s.short_label,
    tone: s.tone as StatusTone,
    icon: s.icon,
    availability: s.availability as Availability,
    isActive: s.is_active,
    isDefault: (DEFAULT_STATUS_CODES as readonly string[]).includes(s.code),
    playersNow: (players.data ?? []).filter((p) => p.status_id === s.id && p.is_active).length,
    used: used.has(s.id),
  }));
  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      <StatusesManager statuses={statuses} />
    </>
  );
}
