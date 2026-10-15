import Link from "next/link";
import { CalendarCheck, Check, ClipboardCheck, Pencil } from "lucide-react";
import { formatDate, getPlayerDay, getWellnessEntry, zoneLabel } from "@club/shared";
import type { Session } from "@/lib/auth";
import { LinkButton } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { DayList } from "@/components/player/day-list";
import { NoPlayer } from "@/components/player/no-player";
import { listRpe } from "@/components/player/queries";
import { RpeCard } from "@/components/player/rpe-card";
import { StatusCard } from "@/components/player/status-card";
import { getT } from "@/messages";

function capitalize(s: string) {
  return s.charAt(0).toLocaleUpperCase("ro") + s.slice(1);
}

/** Ziua jucătorului (Vestiar): starea, chestionarul, planul zilei, RPE. */
export async function PlayerToday({ db, ctx }: Pick<Session, "db" | "ctx">) {
  const t = getT().player;
  if (!ctx.player) return <NoPlayer />;
  const player = ctx.player;

  const [day, entry, rpe] = await Promise.all([
    getPlayerDay(db, player.id, ctx.today),
    getWellnessEntry(db, player.id, ctx.today),
    listRpe(db, player.id, ctx.today, ctx.today),
  ]);
  const status = ctx.statuses.find((s) => s.id === player.status_id) ?? null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header>
        <p className="text-ink-3">{t.today.title}</p>
        <h1 className="text-2xl md:text-3xl">{capitalize(formatDate(ctx.today, { weekday: true, year: false }))}</h1>
      </header>

      <StatusCard player={player} status={status} today={ctx.today} />

      {entry ? (
        <Card className="p-4" aria-label={t.today.questionnaireTitle}>
          <div className="flex items-center gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-st-green text-white">
              <Check className="size-5" strokeWidth={3} aria-hidden />
            </span>
            <h2 className="min-w-0 flex-1 text-lg leading-tight">{t.today.questionnaireDone}</h2>
            <LinkButton href="/chestionar" variant="secondary" icon={<Pencil className="size-4" aria-hidden />}>
              {t.today.questionnaireEdit}
            </LinkButton>
          </div>
          <p className="mt-2 text-ink-2">
            {t.today.questionnaireSummary(entry.fatigue, entry.muscle_load)}
            {entry.pain_zone ? ` · ${t.today.questionnairePain(zoneLabel(entry.pain_zone, entry.pain_side, true), entry.pain_intensity)}` : ""}
          </p>
        </Card>
      ) : (
        <Card className="p-4" aria-label={t.today.questionnaireTitle}>
          <h2 className="text-lg">{t.today.questionnaireTitle}</h2>
          <p className="mb-3 text-ink-3">{t.today.questionnaireHint}</p>
          <LinkButton href="/chestionar" variant="primary" size="lg" className="w-full" icon={<ClipboardCheck className="size-6" aria-hidden />}>
            {t.today.questionnaireStart}
          </LinkButton>
        </Card>
      )}

      {day.total > 0 || day.plan || day.programs.length ? (
        <DayList day={day} editable backHref="/azi" />
      ) : (
        <EmptyState
          icon={<CalendarCheck className="size-8" aria-hidden />}
          title={t.today.emptyTitle}
          description={t.today.emptyDescription}
          action={<Link href="/plan" className="font-semibold underline">{t.today.seeWeek}</Link>}
        />
      )}

      <RpeCard entries={rpe.map((r) => ({ session_type: r.session_type, rpe: r.rpe, duration_min: r.duration_min, load: r.load }))} />
    </div>
  );
}
