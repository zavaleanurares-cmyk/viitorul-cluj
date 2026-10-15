"use client";
import { useMemo, useState } from "react";
import { Check, Search, SkipForward, UserPlus, UserSearch } from "lucide-react";
import { norm, type MatchCandidate, type MatchProposal, type NameDecision } from "@club/shared";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { Badge } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import { useT } from "@/messages";
import { defaultDecision, findConflicts, isClearSuggestion } from "./matching";
import { Section, StatRow, StepNav } from "./parts";
import type { Decisions, ImportContext, ImportPlayer, NameItem } from "./types";

const choice =
  "inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] border px-3 py-1.5 text-left text-sm font-semibold";
const action =
  "inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-medium whitespace-nowrap";
const choiceOn = "border-brand bg-brand text-brand-ink";
const choiceOff = "border-transparent bg-sunken text-ink hover:bg-line";

/**
 * Pasul 3: fiecare nume distinct din fișier este legat de un jucător din evidență, creat ca
 * jucător nou sau sărit. Propunerile vin din `proposeMatch`; decizia este a preparatorului.
 */
export function MatchStep({ names, proposals, user, effective, context, onDecide, onDecideMany, onBack, onNext }: {
  names: NameItem[]; proposals: Map<string, MatchProposal>; user: Decisions; effective: Decisions; context: ImportContext;
  onDecide: (key: string, decision: NameDecision | null) => void; onDecideMany: (patch: Decisions) => void;
  onBack: () => void; onNext: () => void;
}) {
  const t = useT().imports;
  const m = t.match;
  const [pickFor, setPickFor] = useState<NameItem | null>(null);
  const [editing, setEditing] = useState<Set<string>>(new Set());

  const playerById = useMemo(() => new Map(context.players.map((p) => [p.id, p])), [context.players]);
  const groupName = (id: string | null) => context.groups.find((g) => g.id === id)?.name ?? m.noGroup;

  const sections = useMemo(() => {
    const pending: NameItem[] = [];
    const matched: NameItem[] = [];
    const created: NameItem[] = [];
    const skipped: NameItem[] = [];
    for (const item of names) {
      const d = defaultDecision(item, proposals.get(item.key));
      (d === undefined ? pending : d.action === "match" ? matched : d.action === "create" ? created : skipped).push(item);
    }
    return { pending, matched, created, skipped };
  }, [names, proposals]);

  const unresolved = names.filter((n) => !effective[n.key]);
  const conflicts = findConflicts(names, effective);
  // confirmarea în bloc acoperă doar propunerile clare; restul se confirmă una câte una
  const suggestions = sections.pending.filter((n) => {
    const suggested = proposals.get(n.key)?.suggested;
    return !user[n.key] && !!suggested && isClearSuggestion(n.name, playerById.get(suggested));
  });
  const count = (action: NameDecision["action"]) => names.filter((n) => effective[n.key]?.action === action).length;

  const row = (item: NameItem, compact: boolean) => (
    <MatchRow
      key={item.key} item={item} proposal={proposals.get(item.key)} decision={effective[item.key]} overridden={!!user[item.key]}
      compact={compact && !editing.has(item.key)} playerById={playerById} groupName={groupName}
      onDecide={(d) => onDecide(item.key, d)} onPick={() => setPickFor(item)}
      onEdit={() => setEditing(new Set(editing).add(item.key))}
      onReset={compact ? () => { onDecide(item.key, null); const next = new Set(editing); next.delete(item.key); setEditing(next); } : undefined}
    />
  );

  return (
    <div>
      <StatRow stats={[
        { label: m.statNames, value: names.length, tone: "gray" },
        { label: m.statMatched, value: count("match"), tone: "green" },
        { label: m.statNew, value: count("create"), tone: "green" },
        { label: m.statSkipped, value: count("skip"), tone: "gray" },
        { label: m.statPending, value: unresolved.length, tone: "orange" },
      ]} />

      {conflicts.length ? (
        <Notice tone="red" title={m.conflictTitle} className="mt-4">
          <ul className="list-disc pl-5">
            {conflicts.map((c) => <li key={c.player_id}>{m.conflictItem(c.names.join(", "), playerById.get(c.player_id)?.display_name ?? "?")}</li>)}
          </ul>
        </Notice>
      ) : null}

      {sections.pending.length ? (
        <Section
          title={m.pendingTitle(sections.pending.length)} description={m.pendingDescription}
          action={suggestions.length ? (
            <Button
              variant="secondary" size="sm" icon={<Check className="size-4" aria-hidden />}
              onClick={() => onDecideMany(Object.fromEntries(suggestions.map((n) => [n.key, { action: "match" as const, player_id: proposals.get(n.key)!.suggested! }])))}
            >
              {m.acceptSuggestions(suggestions.length)}
            </Button>
          ) : null}
        >
          <ul data-list="pending" className="divide-y divide-line rounded-[var(--radius-card)] border border-line/70 bg-surface shadow-[var(--shadow-card)]">{sections.pending.map((n) => row(n, false))}</ul>
        </Section>
      ) : (
        <Notice tone="green" title={m.nothingPending} className="mt-4" />
      )}

      {([
        ["matched", m.autoMatchedTitle, m.autoMatchedDescription],
        ["created", m.autoCreatedTitle, m.autoCreatedDescription],
        ["skipped", m.autoSkippedTitle, m.autoSkippedDescription],
      ] as const).map(([key, title, description]) => sections[key].length ? (
        <details key={key} className="group mt-4 rounded-[var(--radius-card)] border border-line/70 bg-surface shadow-[var(--shadow-card)]">
          <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 py-2 font-semibold">
            <span>{title(sections[key].length)}</span>
            <span className="text-sm font-normal text-ink-3 group-open:hidden">{m.open}</span>
            <span className="hidden text-sm font-normal text-ink-3 group-open:inline">{m.close}</span>
          </summary>
          <p className="border-t border-line px-4 py-2 text-sm text-ink-3">{description}</p>
          <ul className="divide-y divide-line border-t border-line">{sections[key].map((n) => row(n, true))}</ul>
        </details>
      ) : null)}

      <PlayerPicker
        item={pickFor} players={context.players} groups={context.groups} onClose={() => setPickFor(null)}
        onPick={(playerId) => { if (pickFor) onDecide(pickFor.key, { action: "match", player_id: playerId }); setPickFor(null); }}
      />

      <StepNav
        back={t.nav.back} onBack={onBack} next={t.nav.toConfirm} onNext={onNext}
        disabled={unresolved.length > 0 || conflicts.length > 0}
        hint={unresolved.length ? m.unresolvedHint(unresolved.length) : conflicts.length ? m.conflictHint : undefined}
      />
    </div>
  );
}

function MatchRow({ item, proposal, decision, overridden, compact, playerById, groupName, onDecide, onPick, onEdit, onReset }: {
  item: NameItem; proposal: MatchProposal | undefined; decision: NameDecision | undefined; overridden: boolean; compact: boolean;
  playerById: Map<string, ImportPlayer>; groupName: (id: string | null) => string;
  onDecide: (d: NameDecision) => void; onPick: () => void; onEdit: () => void; onReset?: () => void;
}) {
  const m = useT().imports.match;
  const candidates = proposal?.candidates ?? [];
  const matchedId = decision?.action === "match" ? decision.player_id : null;
  const matched = matchedId ? playerById.get(matchedId) : undefined;
  const matchedCandidate = candidates.find((c) => c.player_id === matchedId);
  const describe = (p: ImportPlayer | undefined) => (p ? `${p.display_name} · ${groupName(p.group_id)}` : "?");

  const head = (
    <div className="min-w-0">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-base font-bold">{item.name}</span>
        {!item.hasData ? <Badge>{m.noData}</Badge> : null}
        {overridden && onReset ? <Badge tone="blue">{m.changed}</Badge> : null}
      </p>
      <p className="text-sm text-ink-3">
        {item.hintGroupId || item.keyGroupId ? groupName(item.keyGroupId ?? item.hintGroupId) : m.anyGroup}
        {item.rows > 1 ? ` · ${m.rows(item.rows)}` : ""}
      </p>
    </div>
  );

  if (compact) {
    return (
      <li className="grid items-center gap-x-4 gap-y-1 px-4 py-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
        {head}
        <p className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
          {decision?.action === "match" ? (
            <>
              <span className="font-semibold">{describe(matched)}</span>
              {matchedCandidate ? <Badge tone={matchedCandidate.reason === "memorat" ? "blue" : "gray"}>{m.reason[matchedCandidate.reason]}</Badge> : <Badge tone="blue">{m.manual}</Badge>}
            </>
          ) : decision?.action === "create" ? <span className="font-semibold">{m.willCreate}</span>
            : <span className="text-ink-3">{m.willSkip}</span>}
        </p>
        <Button variant="ghost" size="sm" onClick={onEdit}>{m.change}</Button>
      </li>
    );
  }

  return (
    <li className="grid gap-x-4 gap-y-2 px-4 py-3 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
      <div className="flex items-start justify-between gap-2 md:block">
        {head}
        <div className="mt-1 flex items-center gap-2">
          {decision ? <Badge tone="green"><Check className="size-3.5" aria-hidden />{m.resolved}</Badge> : <Badge tone="yellow">{m.pending}</Badge>}
          {onReset && overridden ? <button type="button" className="text-sm font-semibold underline" onClick={onReset}>{m.reset}</button> : null}
        </div>
      </div>
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap gap-2">
          {candidates.map((c) => (
            <CandidateButton
              key={c.player_id} candidate={c} player={playerById.get(c.player_id)} groupName={groupName}
              selected={matchedId === c.player_id} suggested={!decision && proposal?.suggested === c.player_id}
              onClick={() => onDecide({ action: "match", player_id: c.player_id })}
            />
          ))}
          {matched && !matchedCandidate ? (
            <button type="button" aria-pressed className={cn(choice, choiceOn)} onClick={onPick}>
              <Check className="size-4 shrink-0" aria-hidden />
              <span>{describe(matched)}<span className="block text-xs font-normal opacity-80">{m.manual}</span></span>
            </button>
          ) : null}
          {!candidates.length && !matched ? <p className="text-sm text-ink-3">{m.noCandidates}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={cn(action, choiceOff)} onClick={onPick}>
            <UserSearch className="size-4 shrink-0" aria-hidden />{m.other}
          </button>
          {item.allowCreate ? (
            <button type="button" aria-pressed={decision?.action === "create"} className={cn(action, decision?.action === "create" ? choiceOn : choiceOff)} onClick={() => onDecide({ action: "create" })}>
              <UserPlus className="size-4 shrink-0" aria-hidden />{m.create}
            </button>
          ) : null}
          <button type="button" aria-pressed={decision?.action === "skip"} className={cn(action, decision?.action === "skip" ? choiceOn : choiceOff)} onClick={() => onDecide({ action: "skip" })}>
            <SkipForward className="size-4 shrink-0" aria-hidden />{m.skip}
          </button>
        </div>
      </div>
    </li>
  );
}

function CandidateButton({ candidate, player, groupName, selected, suggested, onClick }: {
  candidate: MatchCandidate; player: ImportPlayer | undefined; groupName: (id: string | null) => string;
  selected: boolean; suggested: boolean; onClick: () => void;
}) {
  const m = useT().imports.match;
  if (!player) return null;
  return (
    <button type="button" aria-pressed={selected} onClick={onClick} className={cn(choice, selected ? choiceOn : choiceOff, suggested && "border-2 border-ink")}>
      {selected ? <Check className="size-4 shrink-0" aria-hidden /> : null}
      <span>
        <span className="block">
          {player.display_name}
          {norm(player.full_name) !== norm(player.display_name) ? <span className="font-normal"> ({player.full_name})</span> : null}
        </span>
        <span className="block text-xs font-normal opacity-80">
          {groupName(player.group_id)}{candidate.same_group ? ` (${m.sameGroup})` : ""} · {m.reason[candidate.reason]} · {Math.round(candidate.score * 100)}%
          {suggested ? ` · ${m.suggested}` : ""}
        </span>
      </span>
    </button>
  );
}

/** Lista cu căutare a tuturor jucătorilor clubului, grupați pe grupe. */
function PlayerPicker({ item, players, groups, onPick, onClose }: {
  item: NameItem | null; players: ImportPlayer[]; groups: ImportContext["groups"]; onPick: (playerId: string) => void; onClose: () => void;
}) {
  const m = useT().imports.match;
  const [query, setQuery] = useState("");
  const q = norm(query);
  const shown = q ? players.filter((p) => norm(p.display_name).includes(q) || norm(p.full_name).includes(q)) : players;
  const hint = item?.hintGroupId ?? null;
  // grupa din fișier prima, apoi celelalte, la urmă jucătorii fără grupă
  const ordered = [...groups].sort((a, b) => Number(b.id === hint) - Number(a.id === hint));
  const blocks = [
    ...ordered.map((g) => ({ id: g.id, name: g.name, players: shown.filter((p) => p.group_id === g.id) })),
    { id: "none", name: m.noGroup, players: shown.filter((p) => !p.group_id || !groups.some((g) => g.id === p.group_id)) },
  ].filter((b) => b.players.length);

  return (
    <Dialog open={!!item} onClose={() => { setQuery(""); onClose(); }} title={item ? m.pickerTitle(item.name) : ""}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-ink-3" aria-hidden />
        <Input type="search" autoFocus className="pl-10" aria-label={m.pickerSearch} placeholder={m.pickerSearch} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {blocks.length ? blocks.map((b) => (
        <section key={b.id} className="mt-3">
          <h3 className="mb-1 text-sm font-semibold text-ink-3">{b.name} · {b.players.length}</h3>
          <ul className="divide-y divide-line rounded-[var(--radius-control)] border border-line">
            {b.players.map((p) => (
              <li key={p.id}>
                <button type="button" className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-1.5 text-left hover:bg-canvas" onClick={() => { setQuery(""); onPick(p.id); }}>
                  <span className="font-semibold">{p.display_name}</span>
                  {norm(p.full_name) !== norm(p.display_name) ? <span className="text-sm text-ink-3">{p.full_name}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )) : <p className="mt-4 text-ink-3">{players.length ? m.pickerEmpty : m.pickerNoPlayers}</p>}
    </Dialog>
  );
}
