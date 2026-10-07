"use client";
import { useMemo, useState } from "react";
import { POSITIONS, label, norm } from "@club/shared";
import { useT } from "@/messages";
import { cn } from "@/lib/cn";
import { Input } from "@/components/ui/form";
import type { GroupOption, PlayerOption } from "./types";

/**
 * Listă de jucători cu căutare și bife, grupată pe grupe. Folosită la alocarea programelor
 * (un jucător sau o selecție) și la copierea planurilor.
 */
export function PlayerChecklist({ players, groups, value, onChange, single, marks, markLabel }: {
  players: PlayerOption[];
  groups: GroupOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  /** un singur jucător poate fi ales */
  single?: boolean;
  /** jucătorii marcați (ex. au deja plan în zilele alese) */
  marks?: Set<string>;
  markLabel?: string;
}) {
  const t = useT().planning.assign;
  const [q, setQ] = useState("");
  const selected = useMemo(() => new Set(value), [value]);

  const sections = useMemo(() => {
    const needle = norm(q);
    const shown = needle ? players.filter((p) => norm(p.name).includes(needle)) : players;
    const known = new Set(groups.map((g) => g.id));
    return [
      ...groups.map((g) => ({ id: g.id, name: g.name, players: shown.filter((p) => p.group_id === g.id) })),
      { id: "", name: t.noGroup, players: shown.filter((p) => !p.group_id || !known.has(p.group_id)) },
    ].filter((s) => s.players.length);
  }, [players, groups, q, t.noGroup]);

  const toggle = (id: string) => {
    if (single) return onChange(selected.has(id) ? [] : [id]);
    onChange(selected.has(id) ? value.filter((x) => x !== id) : [...value, id]);
  };
  const setGroup = (ids: string[], on: boolean) => {
    const rest = value.filter((id) => !ids.includes(id));
    onChange(on ? [...rest, ...ids] : rest);
  };

  return (
    <div>
      <Input type="search" inputMode="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchPlayer} aria-label={t.searchPlayer} />
      <div className="mt-2 max-h-80 overflow-y-auto rounded-[var(--radius-control)] border border-line">
        {sections.length ? sections.map((s) => {
          const ids = s.players.map((p) => p.id);
          const all = ids.every((id) => selected.has(id));
          return (
            <section key={s.id || "none"}>
              <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-line bg-canvas px-3 py-1">
                <h3 className="text-sm font-bold">{s.name}</h3>
                {!single ? (
                  <button type="button" onClick={() => setGroup(ids, !all)}
                    className="inline-flex h-10 items-center rounded-[var(--radius-control)] px-2 text-sm font-semibold underline underline-offset-2 hover:bg-sunken">
                    {all ? t.clearGroup(s.name) : t.selectGroup(s.name)}
                  </button>
                ) : null}
              </header>
              <ul className="divide-y divide-line">
                {s.players.map((p) => {
                  const on = selected.has(p.id);
                  return (
                    <li key={p.id}>
                      <label className={cn("flex min-h-12 cursor-pointer items-center gap-3 px-3 py-1.5", on && "bg-canvas")}>
                        <input
                          type={single ? "radio" : "checkbox"}
                          name={single ? "player-choice" : undefined}
                          checked={on}
                          onChange={() => toggle(p.id)}
                          className="size-6 shrink-0 accent-[var(--color-brand)]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{p.name}</span>
                          {marks?.has(p.id) && markLabel ? <span className="block text-sm text-ink-3">{markLabel}</span> : null}
                        </span>
                        {p.position ? <span className="shrink-0 text-sm text-ink-3">{label(POSITIONS, p.position, "")}</span> : null}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        }) : <p className="px-3 py-6 text-center text-ink-3">{t.noPlayersFound}</p>}
      </div>
      {!single ? <p className="mt-1 text-sm font-semibold text-ink-2" aria-live="polite">{t.selected(value.length)}</p> : null}
    </div>
  );
}
