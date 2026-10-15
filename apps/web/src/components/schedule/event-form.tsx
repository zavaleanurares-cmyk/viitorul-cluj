"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { EVENT_KIND_LABELS, WEEKDAYS_SHORT_RO, type EventKind } from "@club/shared";
import { Button } from "@/components/ui/button";
import { Card, CardBody, Notice } from "@/components/ui/card";
import { Checkbox, Field, FormError, Input, Select, Segmented, Textarea } from "@/components/ui/form";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";
import { cn } from "@/lib/cn";
import { checkVenue, saveEvent, type EventInput } from "@/app/(app)/program/actions";

type Option = { id: string; name: string };

export function EventForm({ initial, kinds, teams, venues, competitions, opponents }: {
  initial: EventInput; kinds: EventKind[]; teams: Option[]; venues: Option[]; competitions: Array<Option & { groupId: string | null }>; opponents: string[];
}) {
  const t = useT().schedule.form;
  const router = useRouter();
  const [v, setV] = useState<EventInput>(initial);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const save = useAction(saveEvent, { onSuccess: (r) => router.push(`/program/${r.id}`) });
  const set = <K extends keyof EventInput>(k: K, value: EventInput[K]) => setV((s) => ({ ...s, [k]: value }));
  const match = v.match ?? { opponentName: "", competitionId: "", round: "", isHome: true };

  // verificăm suprapunerile pe teren după ce utilizatorul se oprește din scris
  const recheck = (next: EventInput) => {
    if (timer.current) clearTimeout(timer.current);
    if (!next.venueId) { setConflicts([]); return; }
    timer.current = setTimeout(async () => {
      const res = await checkVenue({ venueId: next.venueId ?? "", date: next.date, start: next.start, end: next.end, excludeId: next.id ?? null });
      setConflicts(res.ok ? res.data : []);
    }, 300);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const update = (patch: Partial<EventInput>) => { const next = { ...v, ...patch }; setV(next); if ("venueId" in patch || "date" in patch || "start" in patch || "end" in patch) recheck(next); };

  const toggleTeam = (id: string) => set("groupIds", v.groupIds.includes(id) ? v.groupIds.filter((g) => g !== id) : [...v.groupIds, id]);
  const repeat = v.repeat ?? null;
  const toggleDay = (d: number) => {
    const days = repeat?.weekdays ?? [];
    set("repeat", { until: repeat?.until ?? v.date, weekdays: days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort() });
  };
  const isoDay = (() => { const [y, m, d] = v.date.split("-").map(Number); const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); return wd === 0 ? 7 : wd; })();

  return (
    <form className="mx-auto max-w-2xl space-y-4" onSubmit={(e) => { e.preventDefault(); save.run(v); }}>
      <Card>
        <CardBody className="space-y-4">
          {!v.id && kinds.length > 1 ? (
            <Segmented label={t.kind} value={v.kind} onChange={(k) => set("kind", k)} options={kinds.map((k) => ({ value: k, label: EVENT_KIND_LABELS[k] }))} />
          ) : null}

          {v.kind === "match" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t.opponent} className="sm:col-span-2">
                <Input list="opponents" value={match.opponentName} onChange={(e) => set("match", { ...match, opponentName: e.target.value })} autoComplete="off" />
                <datalist id="opponents">{opponents.map((o) => <option key={o} value={o} />)}</datalist>
              </Field>
              {competitions.length ? (
                <Field label={t.competition}>
                  <Select value={match.competitionId ?? ""} onChange={(e) => set("match", { ...match, competitionId: e.target.value })}>
                    <option value="">{t.noCompetition}</option>
                    {competitions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </Field>
              ) : null}
              <Field label={t.round} optional>
                <Input value={match.round ?? ""} onChange={(e) => set("match", { ...match, round: e.target.value })} inputMode="numeric" />
              </Field>
              <div className="sm:col-span-2">
                <Segmented label={t.homeAway} value={match.isHome ? "home" : "away"} onChange={(x) => set("match", { ...match, isHome: x === "home" })}
                  options={[{ value: "home", label: t.home }, { value: "away", label: t.away }]} />
              </div>
            </div>
          ) : (
            <Field label={t.title} hint={t.titleHint} optional>
              <Input value={v.title ?? ""} onChange={(e) => set("title", e.target.value)} />
            </Field>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t.date}><Input type="date" value={v.date} onChange={(e) => update({ date: e.target.value })} required /></Field>
            <Field label={t.start}><Input type="time" value={v.start} onChange={(e) => update({ start: e.target.value })} required step={300} /></Field>
            <Field label={t.end}><Input type="time" value={v.end} onChange={(e) => update({ end: e.target.value })} required step={300} /></Field>
          </div>

          <Field label={t.venue}>
            <Select value={v.venueId ?? ""} onChange={(e) => update({ venueId: e.target.value })}>
              <option value="">{t.noVenue}</option>
              {venues.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </Select>
          </Field>
          {conflicts.length ? (
            <Notice tone="yellow" title={conflicts[0]}>{t.conflictHint}</Notice>
          ) : null}

          {teams.length ? (
            <fieldset>
              <legend className="mb-1 text-sm font-semibold text-ink-2">{t.teams}</legend>
              <div className="flex flex-wrap gap-2">
                {teams.map((g) => {
                  const on = v.groupIds.includes(g.id);
                  return (
                    <button key={g.id} type="button" aria-pressed={on} onClick={() => toggleTeam(g.id)}
                      className={cn("h-12 rounded-[var(--radius-control)] border px-4 font-semibold", on ? "border-brand bg-brand text-brand-ink" : "border-border-control bg-surface hover:bg-canvas")}>
                      {g.name}
                    </button>
                  );
                })}
              </div>
              {v.kind !== "booking" && v.kind !== "other" && !v.groupIds.length ? <p className="mt-1 text-sm text-ink-3">{t.teamsHint}</p> : null}
            </fieldset>
          ) : null}

          {!v.id ? (
            <div className="rounded-[var(--radius-control)] border border-line p-3">
              <Checkbox checked={!!repeat} label={t.repeat}
                onChange={(e) => set("repeat", e.target.checked ? { weekdays: [isoDay], until: v.date } : null)} />
              {repeat ? (
                <div className="mt-2 space-y-3">
                  <fieldset>
                    <legend className="mb-1 text-sm font-semibold text-ink-2">{t.weekdays}</legend>
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAYS_SHORT_RO.map((d, i) => {
                        const on = repeat.weekdays.includes(i + 1);
                        return (
                          <button key={d} type="button" aria-pressed={on} onClick={() => toggleDay(i + 1)}
                            className={cn("size-12 rounded-[var(--radius-control)] border font-semibold", on ? "border-brand bg-brand text-brand-ink" : "border-border-control bg-surface hover:bg-canvas")}>
                            {d}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                  <Field label={t.until}><Input type="date" value={repeat.until} min={v.date} onChange={(e) => set("repeat", { ...repeat, until: e.target.value })} /></Field>
                </div>
              ) : null}
            </div>
          ) : null}

          <Field label={t.notes} optional><Textarea value={v.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></Field>
        </CardBody>
      </Card>
      <FormError>{save.error}</FormError>
      <div className="flex justify-end">
        <Button type="submit" variant="primary" pending={save.pending}>{v.id ? t.save : t.create}</Button>
      </div>
    </form>
  );
}
