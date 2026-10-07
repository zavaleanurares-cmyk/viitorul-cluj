import {
  INJURY_CONTACT, INJURY_CONTEXT, INJURY_SEVERITY, INJURY_TYPES, RTP_STAGES, formatDate, label, relativeDay,
} from "@club/shared";
import { DataList } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { getT } from "@/messages";
import { daysLost, injuryIsActive, injuryZoneText } from "./domain";
import type { InjuryRow } from "./queries";

/** Etapa de return-to-play ca progres pe trepte (0–5), cu numele etapei scris în clar. */
export function RtpSteps({ stage }: { stage: number }) {
  const t = getT().players.medical;
  const last = RTP_STAGES.length - 1;
  const current = Math.min(Math.max(stage, 0), last);
  return (
    <div>
      <ol className="flex gap-1" aria-label={t.rtp}>
        {RTP_STAGES.map((name, i) => (
          <li
            key={i}
            title={`${i}. ${name}`}
            aria-current={i === current ? "step" : undefined}
            className={cn(
              "flex h-7 flex-1 items-center justify-center rounded-md border text-sm font-bold",
              i < current ? "border-ink-2 bg-ink-2 text-white"
                : i === current ? "border-ink bg-ink text-white ring-2 ring-ink ring-offset-1"
                : "border-line-strong bg-surface text-ink-3",
            )}
          >
            {i}
            <span className="sr-only"> — {name}</span>
          </li>
        ))}
      </ol>
      <p className="mt-1.5 text-sm">
        <span className="text-ink-3">{t.rtpStage(current, last)}: </span>
        <span className="font-semibold">{RTP_STAGES[current]}</span>
      </p>
    </div>
  );
}

/** Datele unei accidentări, doar afișare (fișa medicală și cazul partenerului). */
export function InjuryFacts({ injury, previous, today }: {
  injury: InjuryRow; previous?: Pick<InjuryRow, "occurred_on" | "zone" | "side" | "zone_detail" | "zone_uncertain"> | null; today: string;
}) {
  const t = getT().players.medical;
  const active = injuryIsActive(injury);
  const lost = daysLost(injury, today);
  const mechanism = [
    injury.contact && injury.contact !== "unknown" ? label(INJURY_CONTACT, injury.contact) : null,
    injury.context && injury.context !== "unknown" ? label(INJURY_CONTEXT, injury.context).toLocaleLowerCase("ro") : null,
  ].filter(Boolean).join(", ");
  const items = [
    { label: t.occurredOn, value: formatDate(injury.occurred_on) },
    injury.injury_type ? { label: t.type, value: label(INJURY_TYPES, injury.injury_type) } : null,
    mechanism ? { label: t.mechanism, value: mechanism } : null,
    injury.diagnosis ? { label: t.diagnosis, value: injury.diagnosis } : null,
    injury.severity ? { label: t.severity, value: label(INJURY_SEVERITY, injury.severity) } : null,
    active
      ? {
          label: t.expectedReturn,
          value: injury.expected_return_on
            ? `${formatDate(injury.expected_return_on)} (${relativeDay(injury.expected_return_on, today)})`
            : t.notSet,
        }
      : { label: t.actualReturn, value: formatDate(injury.actual_return_on) },
    !active && injury.expected_return_on ? { label: t.expectedReturn, value: formatDate(injury.expected_return_on) } : null,
    { label: t.daysLost, value: active ? t.daysLostSoFar(lost) : t.daysLostTotal(lost) },
  ].filter((x) => x !== null);

  return (
    <div className="space-y-3">
      {previous ? (
        <p className="rounded-[var(--radius-control)] bg-sunken px-3 py-2 text-sm font-semibold">
          {t.recurrenceOf(formatDate(previous.occurred_on), injuryZoneText(previous, true))}
        </p>
      ) : null}
      <DataList items={items} className="text-[0.9375rem]" />
      <RtpSteps stage={injury.rtp_stage} />
      {injury.notes ? (
        <div>
          <p className="text-sm text-ink-3">{t.notes}</p>
          <p className="whitespace-pre-line">{injury.notes}</p>
        </div>
      ) : null}
    </div>
  );
}
