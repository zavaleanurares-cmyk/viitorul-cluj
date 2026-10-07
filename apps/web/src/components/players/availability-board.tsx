"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { describeZone, diffDays, formatDateShort, relativeDay, type ClubStatus, type PlayerListItem, type StatusTone } from "@club/shared";
import { ReviewBadge, StatusChip, TONE_BAR } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import { useT } from "@/messages";
import { StatusDialog } from "./status-dialog";

export type BoardSection = { key: string; title: string; hint?: string; players: PlayerListItem[] };

const GRID =
  "md:grid-cols-[minmax(9rem,1.1fr)_8.5rem_minmax(0,1.2fr)_8rem_minmax(0,1.1fr)_minmax(0,1.6fr)_1.25rem]";

/**
 * Tabloul de disponibilitate. Fiecare rând are în stânga o bară groasă în culoarea stării.
 * Preparatorul schimbă starea dintr-o atingere; ceilalți ajung la fișa jucătorului.
 */
export function AvailabilityBoard({ sections, statuses, canEdit, today }: {
  sections: BoardSection[]; statuses: ClubStatus[]; canEdit: boolean; today: string;
}) {
  const t = useT().players.board;
  const [editing, setEditing] = useState<PlayerListItem | null>(null);
  const byId = new Map(statuses.map((s) => [s.id, s]));

  return (
    <>
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface print:hidden">
        <div className={cn("hidden border-b border-line bg-canvas py-2 pl-5 pr-3 text-sm font-semibold text-ink-3 md:grid md:gap-x-3", GRID)}>
          <span>{t.colPlayer}</span>
          <span>{t.colStatus}</span>
          <span>{t.colZone}</span>
          <span>{t.colReturn}</span>
          <span>{t.colRestrictions}</span>
          <span>{t.colNote}</span>
          <span />
        </div>
        {sections.map((section) => (
          <section key={section.key} aria-label={section.title}>
            <h2 className="flex items-baseline gap-2 border-b border-line bg-canvas px-3 py-1.5 text-sm font-bold text-ink-2">
              {section.title}
              <span className="font-semibold text-ink-3">{section.hint ?? section.players.length}</span>
            </h2>
            <ul>
              {section.players.map((p) => {
                const status = p.status_id ? byId.get(p.status_id) : undefined;
                const tone = (status?.tone ?? "gray") as StatusTone;
                const zone = describeZone(
                  { zone: p.status_zone, side: p.status_side, detail: p.status_zone_detail, uncertain: p.status_zone_uncertain },
                  true,
                );
                const overdue = !!p.status_return_on && diffDays(today, p.status_return_on) < 0;
                const returnText = p.status_return_on
                  ? `${formatDateShort(p.status_return_on, false)} · ${overdue ? t.returnOverdue : relativeDay(p.status_return_on, today)}`
                  : "";
                const review = p.needs_review ? <ReviewBadge note={p.review_note} /> : null;

                const content: ReactNode = (
                  <>
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate text-[1.0625rem] font-bold leading-tight">
                        <span className="sr-only">{canEdit ? t.changeStatusFor("") : t.openPlayer("")}</span>
                        {p.display_name}
                      </span>
                      <span className="md:hidden">{review}</span>
                    </span>
                    <span className="justify-self-end md:justify-self-start">
                      <StatusChip status={status} />
                    </span>

                    {/* telefon: detaliile, doar dacă există */}
                    {zone || returnText || p.training_restrictions || p.status_note || (canEdit && p.needs_review && p.review_note) ? (
                      <span className="col-span-2 block space-y-0.5 text-[0.9375rem] leading-snug md:hidden">
                        {zone || returnText ? (
                          <span className="block">
                            {zone ? <span className="font-semibold">{zone}</span> : null}
                            {zone && returnText ? <span className="text-ink-3"> · </span> : null}
                            {returnText ? <span className={cn(overdue && "font-semibold")}>{t.returnOn(returnText)}</span> : null}
                          </span>
                        ) : null}
                        {p.training_restrictions ? (
                          <span className="block"><span className="text-ink-3">{t.restrictions}: </span>{p.training_restrictions}</span>
                        ) : null}
                        {p.status_note ? <span className="block text-ink-2">{p.status_note}</span> : null}
                        {canEdit && p.needs_review && p.review_note ? <span className="block text-sm text-ink-3">{p.review_note}</span> : null}
                      </span>
                    ) : null}

                    {/* ecrane mari: coloane */}
                    <span className="hidden min-w-0 font-semibold md:block">{zone}</span>
                    <span className={cn("hidden min-w-0 md:block", overdue && "font-semibold")}>{returnText}</span>
                    <span className="hidden min-w-0 md:block">{p.training_restrictions}</span>
                    <span className="hidden min-w-0 text-ink-2 md:block">
                      {p.status_note}
                      {review ? <span className={cn("block", p.status_note && "mt-1")}>{review}</span> : null}
                      {canEdit && p.needs_review && p.review_note ? <span className="mt-0.5 block text-sm text-ink-3">{p.review_note}</span> : null}
                    </span>
                    <ChevronRight className="hidden size-5 self-center text-ink-3 md:block" aria-hidden />
                  </>
                );
                const rowClass = cn(
                  "grid min-h-13 w-full flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2 pl-3 pr-3 text-left",
                  "hover:bg-canvas active:bg-sunken md:items-start md:gap-y-0 md:py-2.5",
                  GRID,
                );
                return (
                  <li key={p.id} className="flex border-b border-line last:border-b-0">
                    <span className={cn("w-2 shrink-0", TONE_BAR[tone] ?? TONE_BAR.gray)} aria-hidden />
                    {canEdit ? (
                      <button type="button" className={rowClass} onClick={() => setEditing(p)} aria-haspopup="dialog">
                        {content}
                      </button>
                    ) : (
                      <Link href={`/jucatori/${p.id}`} className={rowClass}>
                        {content}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      {canEdit ? (
        <StatusDialog
          player={editing}
          statuses={statuses}
          onClose={() => setEditing(null)}
          fileHref={editing ? `/jucatori/${editing.id}` : undefined}
        />
      ) : null}
    </>
  );
}
