import { formatDate, getWellnessEntry, wellnessConfigForGroup } from "@club/shared";
import { requireRole } from "@/lib/auth";
import { Notice, PageHeader } from "@/components/ui/card";
import { NoPlayer } from "@/components/player/no-player";
import { WellnessForm } from "@/components/player/wellness-form";
import { getT } from "@/messages";

export const metadata = { title: "Chestionar" };

export default async function QuestionnairePage() {
  const { db, ctx } = await requireRole("player");
  const t = getT().player.wellness;
  if (!ctx.player) return <NoPlayer />;
  const player = ctx.player;

  const entry = await getWellnessEntry(db, player.id, ctx.today);
  const config = wellnessConfigForGroup(ctx.groups.find((g) => g.id === player.group_id));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t.title} description={formatDate(ctx.today, { weekday: true, year: false })} />
      {entry ? <Notice tone="green" className="mb-5">{t.alreadyDone}</Notice> : null}
      <WellnessForm
        key={entry?.updated_at ?? "nou"}
        config={config}
        initial={entry ? {
          fatigue: entry.fatigue, muscle_load: entry.muscle_load,
          pain_zone: entry.pain_zone, pain_side: entry.pain_side, pain_intensity: entry.pain_intensity, pain_note: entry.pain_note,
          sleep_quality: entry.sleep_quality, sleep_hours: entry.sleep_hours === null ? null : Number(entry.sleep_hours),
          stress: entry.stress, mood: entry.mood,
        } : null}
      />
    </div>
  );
}
