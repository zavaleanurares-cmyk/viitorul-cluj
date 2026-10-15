"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeftRight, Ban, Bandage, Check, ChevronLeft, FileWarning, Minus, Plus, RectangleVertical, Trash2 } from "lucide-react";
import { ELIGIBILITY_LABELS, FORMATIONS } from "@club/shared";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { useT } from "@/messages";
import { cn } from "@/lib/cn";
import { addMatchEvent, closeMatch, deleteMatchEvent, reopenMatch, saveSquad } from "@/app/(app)/program/[id]/meci/actions";

type Player = { id: string; name: string; short: string; number: number | null; position: string | null; blocked: { reason: string; detail: string | null } | null };
type SquadRow = { playerId: string; role: "starter" | "sub"; slot: number | null; captain: boolean; minutes: number | null; rating: number | null };
type MatchEvent = { id: string; minute: number; kind: string; playerId: string | null; relatedId: string | null };
type Step = "lot" | "form" | "live" | "notes" | "done";
type Sheet = null | { mode: "goal" } | { mode: "assist"; scorer: string } | { mode: "out" } | { mode: "in"; out: string } | { mode: "yellow" } | { mode: "red" };

const BLOCK_ICON: Record<string, typeof Ban> = { injured: Bandage, visa: FileWarning, suspended: Ban };

export function MatchCentre(props: {
  eventId: string; title: string; subtitle: string; isHome: boolean; opponent: string; clubName: string;
  status: string; score: [number, number]; formations: string[]; savedFormation: string | null; onPitch: number; maxSquad: number;
  totalMinutes: number; suggestedMinute: number; canRun: boolean; canReopen: boolean;
  players: Player[]; squad: SquadRow[]; events: MatchEvent[];
}) {
  const m = useT();
  const t = m.match;
  const router = useRouter();
  const toast = useToast();
  const byId = useMemo(() => new Map(props.players.map((p) => [p.id, p])), [props.players]);
  const name = (id: string | null) => (id ? byId.get(id)?.name ?? "—" : "—");

  const initialSelected = props.squad.length
    ? props.squad.map((s) => s.playerId)
    : props.players.filter((p) => !p.blocked).slice(0, props.maxSquad).map((p) => p.id);
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const formation0 = props.savedFormation && props.formations.includes(props.savedFormation) ? props.savedFormation : props.formations[0] ?? "4-3-3";
  const [formation, setFormation] = useState(formation0);
  const slotsCount = FORMATIONS[formation]?.length ?? props.onPitch;
  const [lineup, setLineup] = useState<Array<string | null>>(() => {
    const arr: Array<string | null> = Array(slotsCount).fill(null);
    for (const s of props.squad) if (s.role === "starter" && s.slot !== null && s.slot < slotsCount) arr[s.slot] = s.playerId;
    return arr;
  });
  const [captain, setCaptain] = useState<string | null>(props.squad.find((s) => s.captain)?.playerId ?? null);
  const [slotSel, setSlotSel] = useState<number | null>(null);
  const [step, setStep] = useState<Step>(props.status === "finished" ? "done" : props.status === "live" ? "live" : props.squad.some((s) => s.role === "starter") ? "form" : "lot");
  const [minute, setMinute] = useState(props.suggestedMinute);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [ratings, setRatings] = useState<Record<string, number>>(() => Object.fromEntries(props.squad.filter((s) => s.rating).map((s) => [s.playerId, s.rating!])));
  const [report, setReport] = useState("");
  const [busy, setBusy] = useState(false);

  const call = async <T,>(fn: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>, ok?: string) => {
    setBusy(true);
    const res = await fn().catch(() => ({ ok: false as const, error: m.common.states.offline }));
    setBusy(false);
    if (!res.ok) { toast(res.error, "error"); return false; }
    if (ok) toast(ok);
    router.refresh();
    return true;
  };

  // ---- derivate -----------------------------------------------------------------------------
  const onField = useMemo(() => {
    const set = lineup.filter(Boolean) as string[];
    for (const e of [...props.events].sort((a, b) => a.minute - b.minute)) {
      if (e.kind === "sub" && e.playerId && e.relatedId) {
        const i = set.indexOf(e.playerId);
        if (i >= 0) set[i] = e.relatedId;
      }
    }
    return set;
  }, [lineup, props.events]);
  const bench = selected.filter((id) => !lineup.includes(id));
  const usedSubs = new Set(props.events.filter((e) => e.kind === "sub" && e.relatedId).map((e) => e.relatedId!));
  const benchLive = selected.filter((id) => !onField.includes(id) && !usedSubs.has(id) && !props.events.some((e) => e.kind === "sub" && e.playerId === id));
  const played = props.squad.filter((s) => s.role === "starter" || usedSubs.has(s.playerId)).map((s) => s.playerId);
  const eventText = (e: MatchEvent) => {
    switch (e.kind) {
      case "goal": return t.eventText.goal(name(e.playerId), e.relatedId ? name(e.relatedId) : null);
      case "goal_against": return t.eventText.goal_against;
      case "own_goal": return t.eventText.own_goal;
      case "opp_own_goal": return t.eventText.opp_own_goal;
      case "yellow": return t.eventText.yellow(name(e.playerId));
      case "red": return t.eventText.red(name(e.playerId));
      case "sub": return t.eventText.sub(name(e.relatedId), name(e.playerId));
      default: return e.kind;
    }
  };

  const squadPayload = () => selected.map((id) => {
    const slot = lineup.indexOf(id);
    return { player_id: id, role: (slot >= 0 ? "starter" : "sub") as "starter" | "sub", slot: slot >= 0 ? slot : null, is_captain: captain === id };
  });

  const stepsOrder: Step[] = ["lot", "form", "live", "notes"];
  const stepIndex = step === "done" ? 4 : stepsOrder.indexOf(step);

  const header = (
    <header className="mb-3">
      <a href={`/program/${props.eventId}`} className="mb-1 inline-flex h-10 items-center gap-1 text-sm font-semibold text-ink-2 hover:text-ink">
        <ChevronLeft className="size-4" aria-hidden /> {t.back}
      </a>
      <h1 className="text-2xl">{props.title}</h1>
      <p className="text-ink-3">{props.subtitle}</p>
      {step !== "done" && props.canRun ? (
        <ol aria-label={t.stepsLabel} className="mt-3 grid grid-cols-4 gap-1">
          {stepsOrder.map((s, i) => (
            <li key={s} aria-current={i === stepIndex ? "step" : undefined} className={cn("text-xs font-semibold", i === stepIndex ? "text-ink" : "text-ink-3")}>
              <span className={cn("mb-1 block h-1 rounded-full", i <= stepIndex ? "bg-brand" : "bg-line")} />
              {i + 1} {t.steps[s as keyof typeof t.steps]}
            </li>
          ))}
        </ol>
      ) : null}
    </header>
  );

  // ---- 1 · lotul ---------------------------------------------------------------------------
  if (step === "lot" && props.canRun) {
    const tooMany = selected.length > props.maxSquad;
    const tooFew = selected.length < Math.min(props.onPitch, props.players.filter((p) => !p.blocked).length);
    return (
      <div className="mx-auto max-w-xl pb-24">
        {header}
        <p className="text-xl font-bold">{t.squad.title(selected.length, props.maxSquad)}</p>
        <p className="mb-3 text-sm text-ink-3">{t.squad.hint}</p>
        {tooMany ? <Notice tone="red" className="mb-3" title={t.squad.tooMany(props.maxSquad)} /> : null}
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line/70 bg-surface shadow-[var(--shadow-card)]">
          {props.players.map((p) => {
            const on = selected.includes(p.id);
            const Icon = p.blocked ? BLOCK_ICON[p.blocked.reason] ?? Ban : null;
            return (
              <li key={p.id}>
                <button type="button" disabled={!!p.blocked} aria-pressed={p.blocked ? undefined : on}
                  onClick={() => { setSelected(on ? selected.filter((x) => x !== p.id) : [...selected, p.id]); if (on) setLineup(lineup.map((x) => (x === p.id ? null : x))); }}
                  className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left enabled:hover:bg-canvas disabled:cursor-default">
                  {p.blocked && Icon ? (
                    <Icon className="size-6 shrink-0 text-st-red" aria-hidden />
                  ) : (
                    <span aria-hidden className={cn("inline-flex size-6 shrink-0 items-center justify-center rounded-md border-2", on ? "border-brand bg-brand text-brand-ink" : "border-border-control")}>
                      {on ? <Check className="size-4" strokeWidth={3} /> : null}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{p.number ? `${p.number} · ` : ""}{p.name}</span>
                    {p.blocked ? <span className="block text-sm text-ink-2">{p.blocked.detail ?? ELIGIBILITY_LABELS[p.blocked.reason]}</span> : null}
                  </span>
                  {p.blocked ? <span className="inline-flex h-6 items-center rounded-full bg-st-red px-2.5 text-xs font-bold text-white">{ELIGIBILITY_LABELS[p.blocked.reason] ?? t.squad.blocked}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="fixed inset-x-0 bottom-16 z-20 border-t border-line bg-surface px-4 py-3 md:static md:mt-4 md:border-0 md:bg-transparent md:p-0">
          <Button variant="primary" className="w-full md:w-auto" disabled={tooMany || tooFew} onClick={() => setStep("form")}>{t.squad.next}</Button>
        </div>
      </div>
    );
  }

  // ---- 2 · formația ------------------------------------------------------------------------
  if (step === "form" && props.canRun) {
    const coords = FORMATIONS[formation] ?? [];
    const changeFormation = (f: string) => {
      const n = FORMATIONS[f]?.length ?? props.onPitch;
      setFormation(f);
      setLineup((l) => Array.from({ length: n }, (_, i) => l[i] ?? null));
    };
    const assign = (playerId: string) => {
      const i = slotSel !== null ? slotSel : lineup.indexOf(null);
      if (i < 0) return;
      const next = lineup.map((x) => (x === playerId ? null : x));
      next[i] = playerId;
      setLineup(next);
      setSlotSel(null);
    };
    const free = lineup.includes(null);
    return (
      <div className="mx-auto max-w-xl pb-24">
        {header}
        <div role="radiogroup" aria-label={t.form.formation} className="mb-3 flex flex-wrap gap-2">
          {props.formations.map((f) => (
            <button key={f} type="button" role="radio" aria-checked={formation === f} onClick={() => changeFormation(f)}
              className={cn("h-11 min-w-20 flex-1 whitespace-nowrap rounded-[var(--radius-control)] border px-3 font-semibold", formation === f ? "border-brand bg-brand text-brand-ink" : "border-transparent bg-sunken")}>
              {f.replace(/ \(\d+\)$/, "")}
            </button>
          ))}
        </div>
        <div role="group" aria-label={t.form.pitch} className="relative h-[26rem] overflow-hidden rounded-[var(--radius-card)] border border-line-strong bg-sunken">
          <div aria-hidden className="absolute inset-2.5 rounded border-2 border-line-strong" />
          <div aria-hidden className="absolute inset-x-2.5 top-1/2 border-t-2 border-line-strong" />
          <div aria-hidden className="absolute left-1/2 top-1/2 size-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-line-strong" />
          <div aria-hidden className="absolute inset-x-1/4 top-2.5 h-14 border-2 border-t-0 border-line-strong" />
          <div aria-hidden className="absolute inset-x-1/4 bottom-2.5 h-14 border-2 border-b-0 border-line-strong" />
          {coords.map(([x, y], i) => {
            const id = lineup[i];
            const p = id ? byId.get(id) : null;
            const on = slotSel === i;
            return (
              <button key={i} type="button" aria-pressed={on} onClick={() => setSlotSel(on ? null : i)}
                aria-label={`${t.form.slot(i)}: ${p ? p.name : t.form.free}${captain && id === captain ? `, ${t.form.captain}` : ""}`}
                className={cn("absolute flex min-w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 rounded-lg p-1", on && "outline-3 outline-offset-0 outline-focus [outline-style:solid]")}
                style={{ left: `${x}%`, top: `${y}%` }}>
                <span className={cn("inline-flex size-9 items-center justify-center rounded-full text-sm font-bold", p ? "bg-ink text-white" : "border-2 border-dashed border-border-control bg-surface text-ink-2")}>
                  {p ? p.number ?? "•" : <Plus className="size-4" aria-hidden />}
                </span>
                <span className="max-w-24 truncate rounded bg-surface px-1 text-xs font-bold">{p ? p.short : t.form.free}{captain && id === captain ? " (C)" : ""}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-sm text-ink-3">{free ? t.form.hintEmpty : t.form.hint}</p>
        {slotSel !== null && lineup[slotSel] ? (
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => { setCaptain(lineup[slotSel]); setSlotSel(null); }}>{t.form.makeCaptain}</Button>
            <Button size="sm" variant="ghost" onClick={() => { const n = [...lineup]; n[slotSel] = null; setLineup(n); setSlotSel(null); }}>{t.form.clearSlot}</Button>
          </div>
        ) : null}
        <section className="mt-4" aria-labelledby="bench-title">
          <h2 id="bench-title" className="mb-2 text-lg">{t.form.bench(bench.length)}</h2>
          <div className="flex flex-wrap gap-2">
            {bench.map((id) => (
              <button key={id} type="button" onClick={() => assign(id)}
                className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium hover:bg-line bg-sunken transition-colors">
                {byId.get(id)?.number ?? ""} {byId.get(id)?.name}
              </button>
            ))}
          </div>
        </section>
        <div className="fixed inset-x-0 bottom-16 z-20 flex gap-2 border-t border-line bg-surface px-4 py-3 md:static md:mt-4 md:border-0 md:bg-transparent md:p-0">
          <Button variant="secondary" onClick={() => setStep("lot")}>{t.form.back}</Button>
          <Button variant="primary" className="flex-1 md:flex-none" disabled={free} pending={busy}
            onClick={async () => { if (await call(() => saveSquad({ eventId: props.eventId, formation, rows: squadPayload() }))) setStep("live"); }}>
            {t.form.start}
          </Button>
        </div>
      </div>
    );
  }

  // ---- 3 · live ------------------------------------------------------------------------------
  if (step === "live" && props.canRun) {
    const add = async (event: { kind: string; player_id?: string | null; related_player_id?: string | null }) => {
      setSheet(null);
      await call(() => addMatchEvent({ eventId: props.eventId, event: { minute, ...event } as never }));
    };
    const options = (ids: string[], pick: (id: string) => void) => ids.map((id) => (
      <button key={id} type="button" onClick={() => pick(id)}
        className="flex h-13 min-h-12 items-center gap-3 rounded-[var(--radius-control)] bg-sunken px-4 text-left font-medium transition-colors hover:bg-line">
        <span className="w-7 text-ink-3">{byId.get(id)?.number ?? ""}</span>{name(id)}
      </button>
    ));
    const [us, them] = props.isHome ? [props.clubName, props.opponent] : [props.opponent, props.clubName];
    const [a, b] = props.isHome ? props.score : [props.score[1], props.score[0]];
    return (
      <div className="mx-auto max-w-xl pb-24">
        {header}
        <Card className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 p-4 text-center">
          <span className="font-semibold">{us}</span>
          <span className="text-4xl font-bold tabular-nums" aria-live="polite">{a} – {b}</span>
          <span className="font-semibold">{them}</span>
        </Card>
        <div className="mt-3 flex items-center justify-center gap-3">
          <button type="button" aria-label={t.live.minuteDown} onClick={() => setMinute(Math.max(0, minute - 1))} className="inline-flex size-11 items-center justify-center rounded-full bg-sunken transition-colors hover:bg-line"><Minus className="size-5" aria-hidden /></button>
          <label className="flex items-center gap-2 font-semibold">{t.live.minute}
            <input type="number" min={0} max={150} value={minute} onChange={(e) => setMinute(Math.max(0, Math.min(150, Number(e.target.value) || 0)))}
              className="h-12 w-20 rounded-[var(--radius-control)] border border-border-control bg-surface text-center text-xl font-bold tabular-nums" />
          </label>
          <button type="button" aria-label={t.live.minuteUp} onClick={() => setMinute(Math.min(150, minute + 1))} className="inline-flex size-11 items-center justify-center rounded-full bg-sunken transition-colors hover:bg-line"><Plus className="size-5" aria-hidden /></button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {[
            { label: t.live.goal, Icon: Plus, onClick: () => setSheet({ mode: "goal" }) },
            { label: t.live.goalAgainst, Icon: Minus, onClick: () => add({ kind: "goal_against" }) },
            { label: t.live.sub, Icon: ArrowLeftRight, onClick: () => setSheet({ mode: "out" }) },
            { label: t.live.yellow, Icon: RectangleVertical, onClick: () => setSheet({ mode: "yellow" }) },
          ].map((x) => (
            <button key={x.label} type="button" disabled={busy} onClick={x.onClick}
              className="flex h-20 flex-col items-center justify-center gap-1 rounded-[var(--radius-card)] bg-surface font-semibold shadow-[var(--shadow-card)] ring-1 ring-line transition-colors hover:bg-canvas disabled:opacity-50">
              <x.Icon className="size-5" aria-hidden />{x.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSheet({ mode: "red" })}>{t.live.red}</Button>
          <Button variant="ghost" size="sm" onClick={() => add({ kind: "opp_own_goal" })}>{t.live.oppOwnGoal}</Button>
          <Button variant="ghost" size="sm" onClick={() => add({ kind: "own_goal" })}>{t.live.ownGoal}</Button>
        </div>

        <Card className="mt-4 overflow-hidden">
          <h2 className="px-4 pb-2 pt-4 text-lg">{t.live.events}</h2>
          {props.events.length === 0 ? <p className="px-4 pb-4 text-ink-3">{t.live.noEvents}</p> : (
            <ul className="divide-y divide-line border-t border-line">
              {[...props.events].reverse().map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-2">
                  <span className="w-10 font-bold tabular-nums">{e.minute}&apos;</span>
                  <span className="flex-1">{eventText(e)}</span>
                  <button type="button" aria-label={t.live.remove(eventText(e))} disabled={busy}
                    onClick={() => call(() => deleteMatchEvent({ eventId: props.eventId, id: e.id }), t.live.removed)}
                    className="inline-flex size-11 items-center justify-center rounded-lg text-ink-2 hover:bg-sunken"><Trash2 className="size-5" aria-hidden /></button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Button variant="ghost" className="mt-2" onClick={() => setStep("form")}>{t.live.lineup}</Button>

        <div className="fixed inset-x-0 bottom-16 z-20 border-t border-line bg-surface px-4 py-3 md:static md:mt-4 md:border-0 md:bg-transparent md:p-0">
          <Button variant="primary" className="w-full md:w-auto" onClick={() => setStep("notes")}>{t.live.end}</Button>
        </div>

        {sheet ? (
          <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
            <button type="button" aria-label={m.common.actions.close} tabIndex={-1} className="absolute inset-0 bg-ink/50" onClick={() => setSheet(null)} />
            <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-[var(--radius-sheet)] bg-surface p-4 pb-safe md:inset-x-auto md:left-1/2 md:top-1/2 md:bottom-auto md:w-[28rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[var(--radius-sheet)]">
              <h2 id="sheet-title" className="mb-3 text-lg">
                {sheet.mode === "goal" ? t.live.whoScored : sheet.mode === "assist" ? t.live.assist : sheet.mode === "out" ? t.live.whoOut
                  : sheet.mode === "in" ? t.live.whoIn(name(sheet.out)) : sheet.mode === "yellow" ? t.live.whoYellow : t.live.whoRed}
              </h2>
              <div className="grid gap-2">
                {sheet.mode === "goal" ? options(onField, (id) => setSheet({ mode: "assist", scorer: id })) : null}
                {sheet.mode === "assist" ? (
                  <>
                    <Button variant="secondary" onClick={() => add({ kind: "goal", player_id: sheet.scorer })}>{t.live.noAssist}</Button>
                    {options(onField.filter((x) => x !== sheet.scorer), (id) => add({ kind: "goal", player_id: sheet.scorer, related_player_id: id }))}
                  </>
                ) : null}
                {sheet.mode === "out" ? options(onField, (id) => setSheet({ mode: "in", out: id })) : null}
                {sheet.mode === "in" ? options(benchLive, (id) => add({ kind: "sub", player_id: sheet.out, related_player_id: id })) : null}
                {sheet.mode === "yellow" || sheet.mode === "red" ? options([...onField, ...benchLive], (id) => add({ kind: sheet.mode, player_id: id })) : null}
                <Button variant="ghost" onClick={() => setSheet(null)}>{m.common.actions.cancel}</Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  // ---- 4 · note -----------------------------------------------------------------------------
  if (step === "notes" && props.canRun) {
    return (
      <div className="mx-auto max-w-xl pb-24">
        {header}
        <p className="text-xl font-bold">{t.notes.title(Object.keys(ratings).length, played.length)}</p>
        <p className="mb-3 text-sm text-ink-3">{t.notes.hint}</p>
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line/70 bg-surface shadow-[var(--shadow-card)]">
          {played.map((id) => (
            <li key={id} className="space-y-2 px-4 py-3">
              <p className="font-semibold">{byId.get(id)?.number ? `${byId.get(id)!.number} · ` : ""}{name(id)}</p>
              <div role="radiogroup" aria-label={t.notes.rating(name(id))} className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button key={v} type="button" role="radio" aria-checked={ratings[id] === v} onClick={() => setRatings({ ...ratings, [id]: v })}
                    className={cn("h-11 flex-1 rounded-[var(--radius-control)] border font-bold", ratings[id] === v ? "border-brand bg-brand text-brand-ink" : "border-transparent bg-sunken")}>
                    {v}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-semibold text-ink-2">{t.notes.report}</span>
          <Textarea value={report} onChange={(e) => setReport(e.target.value)} />
        </label>
        <div className="fixed inset-x-0 bottom-16 z-20 flex gap-2 border-t border-line bg-surface px-4 py-3 md:static md:mt-4 md:border-0 md:bg-transparent md:p-0">
          <Button variant="secondary" onClick={() => setStep("live")}>{t.steps.live}</Button>
          <Button variant="primary" className="flex-1 md:flex-none" pending={busy}
            onClick={async () => { if (await call(() => closeMatch({ eventId: props.eventId, ratings, report }))) setStep("done"); }}>
            {t.notes.finish}
          </Button>
        </div>
      </div>
    );
  }

  // ---- încheiat (sau doar citire) ---------------------------------------------------------------
  const scorers = props.events.filter((e) => e.kind === "goal" || e.kind === "opp_own_goal");
  const minutes = props.squad.filter((s) => (s.minutes ?? 0) > 0).sort((x, y) => (y.minutes ?? 0) - (x.minutes ?? 0));
  return (
    <div className="mx-auto max-w-xl space-y-4">
      {header}
      {!props.canRun && props.status !== "finished" ? <Notice tone="blue" title={t.readOnly} /> : null}
      {props.status === "finished" || step === "done" ? (
        <div className="flex flex-col items-center gap-2 text-center">
          <span aria-hidden className="inline-flex size-14 items-center justify-center rounded-full bg-st-green text-white"><Check className="size-7" strokeWidth={2.5} /></span>
          <h2 className="text-2xl">{t.done.title(props.score[0], props.score[1])}</h2>
          <ul className="text-ink-2">
            <li>{t.done.minutes}</li>
            <li>{t.done.cards}</li>
          </ul>
        </div>
      ) : null}
      <Card className="overflow-hidden">
        <h2 className="px-4 pb-2 pt-4 text-lg">{t.done.scorers}</h2>
        {scorers.length === 0 ? <p className="px-4 pb-4 text-ink-3">{t.done.noScorers}</p> : (
          <ul className="divide-y divide-line border-t border-line">
            {scorers.map((e) => <li key={e.id} className="flex gap-3 px-4 py-2"><span className="w-10 font-bold tabular-nums">{e.minute}&apos;</span>{eventText(e)}</li>)}
          </ul>
        )}
      </Card>
      {minutes.length ? (
        <Card className="overflow-hidden">
          <h2 className="px-4 pb-2 pt-4 text-lg">{t.done.players}</h2>
          <ul className="divide-y divide-line border-t border-line">
            {minutes.map((s) => (
              <li key={s.playerId} className="flex justify-between gap-3 px-4 py-2">
                <span className="font-semibold">{name(s.playerId)}{s.captain ? " (C)" : ""}</span>
                <span className="tabular-nums text-ink-2">{t.notes.minutes(s.minutes ?? 0)}{s.rating ? ` · ${s.rating}/5` : ""}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <a href={`/program/${props.eventId}`} className="inline-flex h-11 items-center rounded-full px-4 font-medium hover:bg-line bg-sunken transition-colors">{t.done.toEvent}</a>
        {props.canReopen && props.status === "finished" ? (
          <Button variant="ghost" pending={busy} onClick={async () => { if (await call(() => reopenMatch(props.eventId), t.done.reopened)) setStep("live"); }}>{t.done.reopen}</Button>
        ) : null}
      </div>
    </div>
  );
}
