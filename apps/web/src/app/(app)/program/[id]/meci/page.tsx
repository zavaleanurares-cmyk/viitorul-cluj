import { notFound, redirect } from "next/navigation";
import { can, formationsFor, formatEventWhen } from "@club/shared";
import { requireCapability } from "@/lib/auth";
import { MatchCentre } from "@/components/match/match-centre";
import { getEvent } from "@/components/schedule/queries";
import { requestTime } from "@/lib/request-time";

export const metadata = { title: "Meci" };

/** Centrul meciului: lot (cu blocările), formație, evenimente live, note și închidere. */
export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { db, ctx } = await requireCapability("viewSchedule");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const e = await getEvent(db, id);
  if (!e || !e.match) notFound();
  const office = can(ctx.role, "manageSchedule");
  const runs = office || (ctx.role === "coach" && e.groupIds.some((g) => ctx.staffGroupIds.includes(g)));
  if (!runs && e.match.status === "scheduled") redirect(`/program/${id}`);

  const [players, squad, events, eligibility, comp, matchRow] = await Promise.all([
    db.from("players").select("id, full_name, display_name, shirt_number, position").in("group_id", e.groupIds)
      .eq("is_active", true).is("anonymized_at", null).order("shirt_number").order("display_name"),
    db.from("match_squad").select("player_id, role, slot, is_captain, minutes").eq("event_id", id),
    db.from("match_events").select("id, minute, kind, player_id, related_player_id").eq("event_id", id).order("minute").order("created_at"),
    db.rpc("match_eligibility", { p_event: id }),
    e.match.competition_id ? db.from("competitions").select("half_minutes").eq("id", e.match.competition_id).maybeSingle() : Promise.resolve({ data: null }),
    db.from("matches").select("formation").eq("event_id", id).maybeSingle(),
  ]);
  // notele le vede doar staff-ul care conduce meciul (RLS)
  const { data: ratingRows } = runs ? await db.from("match_ratings").select("player_id, rating").eq("event_id", id) : { data: [] };
  const rating = new Map((ratingRows ?? []).map((r) => [r.player_id, r.rating]));
  const teams = ctx.groups.filter((g) => e.groupIds.includes(g.id));
  const onPitch = Math.max(...teams.map((g) => g.players_on_pitch ?? 11), 5);
  const half = comp.data?.half_minutes ?? Math.max(...teams.map((g) => g.half_minutes ?? 45));
  // minutul de joc: din ora de începere, fără pauza de 15 minute dintre reprize
  const sinceStart = Math.floor((requestTime() - Date.parse(e.starts_at)) / 60000);
  const elapsed = sinceStart > half + 15 ? sinceStart - 15 : Math.min(sinceStart, half);
  const blocked = new Map<string, { reason: string; detail: string | null }>();
  for (const b of (eligibility.data ?? []) as Array<{ player_id: string; reason: string; detail: string | null }>) {
    if (!blocked.has(b.player_id)) blocked.set(b.player_id, { reason: b.reason, detail: b.detail });
  }

  return (
    <MatchCentre
      eventId={id}
      title={`${e.match.is_home ? "" : "@ "}${e.match.opponent ?? e.title}`}
      subtitle={`${formatEventWhen(e.starts_at, null, ctx.settings.timezone)}${e.match.competition ? ` · ${e.match.competition}` : ""}`}
      isHome={e.match.is_home}
      opponent={e.match.opponent ?? e.title}
      clubName={ctx.club.short_name || ctx.club.name}
      status={e.match.status}
      score={[e.match.goals_for, e.match.goals_against]}
      formations={formationsFor(onPitch)}
      savedFormation={matchRow.data?.formation ?? null}
      onPitch={onPitch}
      maxSquad={onPitch + 7}
      totalMinutes={half * 2}
      suggestedMinute={Math.max(0, Math.min(half * 2, elapsed))}
      canRun={runs}
      canReopen={office}
      players={(players.data ?? []).map((p) => ({ id: p.id, name: p.full_name, short: p.display_name, number: p.shirt_number, position: p.position, blocked: blocked.get(p.id) ?? null }))}
      squad={(squad.data ?? []).map((s) => ({ playerId: s.player_id, role: s.role as "starter" | "sub", slot: s.slot, captain: s.is_captain, minutes: s.minutes, rating: rating.get(s.player_id) ?? null }))}
      events={(events.data ?? []).map((x) => ({ id: x.id, minute: x.minute, kind: x.kind, playerId: x.player_id, relatedId: x.related_player_id }))}
    />
  );
}
