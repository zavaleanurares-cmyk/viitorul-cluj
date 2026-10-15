"use client";
import Link from "next/link";
import { Check } from "lucide-react";
import { ALERT_KINDS, formatDateShort, label, relativeDay } from "@club/shared";
import { resolveAlert } from "@/app/(app)/wellness/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/status";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";

export type AlertItem = {
  id: string; kind: string; severity: string; date: string; message: string;
  player?: { id: string; name: string };
};

const SEVERITY_TONE = { critical: "red", warning: "orange", info: "gray" } as const;

/** Alertele deschise, cu închiderea lor („Marchează rezolvată"). Se afișează doar preparatorului. */
export function AlertsList({ alerts, today, collapseAfter = 6 }: { alerts: AlertItem[]; today: string; collapseAfter?: number }) {
  const t = useT().wellness.alerts;
  const head = alerts.slice(0, collapseAfter);
  const rest = alerts.slice(collapseAfter);
  return (
    <>
      <ul className="divide-y divide-line">
        {head.map((a) => <Row key={a.id} alert={a} today={today} />)}
      </ul>
      {rest.length ? (
        <details className="border-t border-line">
          <summary className="flex h-12 cursor-pointer items-center px-4 md:px-5 font-semibold text-ink-2 hover:bg-canvas">{t.more(rest.length)}</summary>
          <ul className="divide-y divide-line border-t border-line">
            {rest.map((a) => <Row key={a.id} alert={a} today={today} />)}
          </ul>
        </details>
      ) : null}
    </>
  );
}

function Row({ alert: a, today }: { alert: AlertItem; today: string }) {
  const t = useT().wellness.alerts;
  const resolve = useAction(resolveAlert);
  const tone = SEVERITY_TONE[a.severity as keyof typeof SEVERITY_TONE] ?? "gray";
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 md:px-5 py-3">
      <div className="min-w-0 flex-1 basis-56">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Badge tone={tone}>{t.severity[a.severity as keyof typeof t.severity] ?? a.severity}</Badge>
          <span className="font-semibold">{label(ALERT_KINDS, a.kind)}</span>
        </p>
        <p className="mt-0.5 text-ink-2">
          {a.player ? (
            <>
              <Link href={`/lot/jucatori/${a.player.id}/wellness`} className="font-semibold text-ink underline underline-offset-4">{a.player.name}</Link>
              {" — "}
            </>
          ) : null}
          {a.message}
          <span className="text-ink-3"> · {formatDateShort(a.date, false)} ({relativeDay(a.date, today)})</span>
        </p>
      </div>
      <Button variant="secondary" pending={resolve.pending} icon={<Check className="size-5" aria-hidden />} onClick={() => resolve.run({ id: a.id })}>
        {t.resolve}
      </Button>
    </li>
  );
}
