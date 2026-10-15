import { CalendarClock, ShieldAlert } from "lucide-react";
import { describeZone, formatDate, relativeDay, type ClubStatus, type Player } from "@club/shared";
import { Card } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/status";
import { getT } from "@/messages";

/** Starea curentă a jucătorului, așa cum a setat-o preparatorul: stare, zonă, observație, restricții, revenire. */
export function StatusCard({ player, status, today }: { player: Player; status: ClubStatus | null; today: string }) {
  const t = getT().player.status;
  const zone = describeZone({
    zone: player.status_zone, side: player.status_side, detail: player.status_zone_detail, uncertain: player.status_zone_uncertain,
  });
  return (
    <Card aria-label={t.title}>
      <div className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <StatusChip status={status} size="lg" full />
          {zone ? <p className="font-semibold">{zone}</p> : null}
        </div>
        {!status ? <p className="text-ink-3">{t.unset}</p> : null}
        {player.status_note ? <p className="text-ink-2">{player.status_note}</p> : null}
        {player.training_restrictions ? (
          <p className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-ink-3" aria-hidden />
            <span>
              <span className="block text-sm text-ink-3">{t.restrictions}</span>
              <span className="font-semibold">{player.training_restrictions}</span>
            </span>
          </p>
        ) : null}
        {player.status_return_on ? (
          <p className="flex items-start gap-2">
            <CalendarClock className="mt-0.5 size-5 shrink-0 text-ink-3" aria-hidden />
            <span>
              <span className="block text-sm text-ink-3">{t.returnOn}</span>
              <span className="font-semibold">
                {formatDate(player.status_return_on, { year: false })}
                {player.status_return_on >= today ? ` (${relativeDay(player.status_return_on, today)})` : ""}
              </span>
            </span>
          </p>
        ) : null}
      </div>
    </Card>
  );
}
