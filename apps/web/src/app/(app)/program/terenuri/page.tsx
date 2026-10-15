import { Lightbulb } from "lucide-react";
import { addDays, can, weekStart } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/status";
import { VenueDialogButton } from "@/components/schedule/venue-dialog";
import { listEvents, listVenues } from "@/components/schedule/queries";
import { getT } from "@/messages";

export const metadata = { title: "Terenuri" };

export default async function VenuesPage() {
  const { db, ctx } = await requireCapability("viewSchedule");
  const t = getT().schedule.venues;
  const canManage = can(ctx.role, "manageSchedule");
  const from = weekStart(ctx.today);
  const [venues, events] = await Promise.all([
    listVenues(db),
    listEvents(db, { from, to: addDays(from, 6), timezone: ctx.settings.timezone }),
  ]);
  const hours = new Map<string, number>();
  for (const e of events) {
    if (!e.venue || e.status === "cancelled") continue;
    hours.set(e.venue.id, (hours.get(e.venue.id) ?? 0) + (Date.parse(e.ends_at) - Date.parse(e.starts_at)) / 3600000);
  }
  const parentName = new Map(venues.map((v) => [v.id, v.name]));

  return (
    <>
      <PageHeader title={t.title} action={canManage ? <VenueDialogButton parents={venues.map((v) => ({ id: v.id, name: v.name }))} /> : null} />
      {venues.length === 0 ? <EmptyState title={t.emptyTitle} description={t.emptyText} /> : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {venues.map((v) => {
            const h = hours.get(v.id) ?? 0;
            return (
              <li key={v.id} className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg">{v.name}</h2>
                    <p className="text-sm text-ink-3">{[v.surface ? t.surfaces[v.surface] : null, v.parent_id ? parentName.get(v.parent_id) : null, v.address].filter(Boolean).join(" · ") || "—"}</p>
                  </div>
                  {canManage ? (
                    <VenueDialogButton parents={venues.map((x) => ({ id: x.id, name: x.name }))}
                      venue={{ id: v.id, name: v.name, address: v.address ?? "", surface: (v.surface as "natural" | null) ?? "", hasLights: v.has_lights, isOwn: v.is_own, parentId: v.parent_id ?? "" }} />
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone={v.is_own ? "blue" : "outline"}>{v.is_own ? t.own : t.away}</Badge>
                  {v.has_lights ? <Badge tone="outline"><Lightbulb className="size-3.5" aria-hidden />{t.lights}</Badge> : null}
                </div>
                <p className="mt-3 text-sm text-ink-2">{t.week}: <strong className="text-ink">{t.hours(h)}</strong></p>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-sunken" aria-hidden>
                  <div className="h-full bg-ink-2" style={{ width: `${Math.min(100, (h / 40) * 100)}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
