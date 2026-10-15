"use client";
import Link from "next/link";
import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import type { ClubStatus, PlayerListItem, StatusTone } from "@club/shared";
import { setPlayerStatus } from "@/app/(app)/jucatori/actions";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Field, FormError, Input, Textarea } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { StatusIcon, TONE_BAR, TONE_SOLID } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { availabilityOf } from "./domain";
import { ZonePicker, type ZoneValue } from "./zone-picker";

export type StatusDialogPlayer = Pick<
  PlayerListItem,
  | "id" | "display_name" | "status_id" | "status_note" | "status_zone" | "status_side" | "status_zone_detail"
  | "status_zone_uncertain" | "status_return_on" | "training_restrictions" | "needs_review" | "review_note"
>;

/** „Schimbă starea": o stare a clubului, observații, zonă, dată de revenire, restricții. */
export function StatusDialog({ player, statuses, onClose, fileHref }: {
  player: StatusDialogPlayer | null; statuses: ClubStatus[]; onClose: () => void; fileHref?: string;
}) {
  if (!player) return null;
  return <StatusForm key={player.id} player={player} statuses={statuses} onClose={onClose} fileHref={fileHref} />;
}

function StatusForm({ player, statuses, onClose, fileHref }: {
  player: StatusDialogPlayer; statuses: ClubStatus[]; onClose: () => void; fileHref?: string;
}) {
  const t = useT().players.statusDialog;
  const c = useT().common;
  const options = statuses.filter((s) => s.is_active || s.id === player.status_id);
  const [statusId, setStatusId] = useState<string | null>(player.status_id);
  const [note, setNote] = useState(player.status_note ?? "");
  const [zone, setZone] = useState<ZoneValue>({
    zone: player.status_zone,
    side: player.status_side,
    detail: player.status_zone_detail ?? "",
    uncertain: player.status_zone_uncertain,
  });
  const [returnOn, setReturnOn] = useState(player.status_return_on ?? "");
  const [restrictions, setRestrictions] = useState(player.training_restrictions ?? "");
  const save = useAction(setPlayerStatus, { onSuccess: onClose });

  const selected = options.find((s) => s.id === statusId) ?? null;
  const fit = !!selected && availabilityOf(selected) === "full";

  return (
    <Dialog
      open
      onClose={onClose}
      title={<>{t.title}: <span className="whitespace-nowrap">{player.display_name}</span></>}
      footer={
        <>
          {fileHref ? (
            <Link href={fileHref} className="mr-auto inline-flex h-12 items-center px-2 font-semibold text-ink-2 underline underline-offset-4 hover:text-ink">
              {t.openFile}
            </Link>
          ) : null}
          <Button variant="secondary" onClick={onClose}>{c.actions.cancel}</Button>
          <Button
            pending={save.pending}
            disabled={!selected || !selected.is_active}
            onClick={() =>
              statusId && save.run({
                playerId: player.id, statusId, note,
                zone: zone.zone, side: zone.side, detail: zone.detail, uncertain: zone.uncertain,
                returnOn, restrictions,
              })
            }
          >
            {t.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {player.needs_review ? (
          <Notice tone="yellow" title={<span className="inline-flex items-center gap-1.5"><TriangleAlert className="size-4" aria-hidden />{t.reviewNote}</span>}>
            {player.review_note}
          </Notice>
        ) : null}

        <div role="radiogroup" aria-label={t.status} className="grid grid-cols-2 gap-2">
          {options.map((s) => {
            const tone = s.tone as StatusTone;
            const on = s.id === statusId;
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={!s.is_active}
                onClick={() => setStatusId(s.id)}
                className={cn(
                  "flex h-14 items-center gap-2 rounded-[var(--radius-control)] border px-3 text-left font-bold tracking-wide disabled:opacity-50",
                  on ? cn(TONE_SOLID[tone] ?? TONE_SOLID.gray, "border-ink ring-2 ring-ink") : "border-transparent bg-sunken hover:bg-line",
                )}
              >
                {on ? null : <span className={cn("size-3 shrink-0 rounded-full", TONE_BAR[tone] ?? TONE_BAR.gray)} aria-hidden />}
                <StatusIcon icon={s.icon} className="size-5" />
                <span className="min-w-0 leading-tight">
                  <span className="block truncate">{s.short_label}</span>
                  {s.label.toLocaleUpperCase("ro") !== s.short_label.toLocaleUpperCase("ro") ? (
                    <span className="block truncate text-xs font-semibold tracking-normal opacity-90">{s.label}</span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>

        <Field label={t.note} optional>
          <Textarea value={note} rows={2} maxLength={1000} placeholder={t.notePlaceholder} onChange={(e) => setNote(e.target.value)} />
        </Field>

        {fit ? (
          zone.zone || zone.detail || returnOn || restrictions ? <p className="text-sm text-ink-3">{t.clearedForFit}</p> : null
        ) : (
          <>
            <ZonePicker value={zone} onChange={setZone} collapsible />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t.returnOn} optional>
                <Input type="date" value={returnOn} onChange={(e) => setReturnOn(e.target.value)} />
              </Field>
              <Field label={t.restrictions} optional>
                <Input value={restrictions} maxLength={500} placeholder={t.restrictionsPlaceholder} onChange={(e) => setRestrictions(e.target.value)} />
              </Field>
            </div>
          </>
        )}
        <FormError>{save.error}</FormError>
      </div>
    </Dialog>
  );
}
