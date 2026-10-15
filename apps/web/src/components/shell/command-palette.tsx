"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CalendarDays, Search, Shield, User, Users, X } from "lucide-react";
import { formatDateTime } from "@club/shared";
import { useT } from "@/messages";
import { cn } from "@/lib/cn";
import { searchClub, type SearchResults } from "./actions";

type Item = { key: string; group: string; label: string; meta?: string; href: string; icon: typeof User };

/** Căutarea globală (⌘K): jucători, echipe, evenimente, părinți. Tastatură: săgeți, Enter, Esc. */
/** Se montează doar cât e deschisă, deci pornește mereu goală. */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const t = useT().common.search;
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef("");

  useEffect(() => {
    inputRef.current?.focus();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);

  const onQuery = (value: string) => {
    setQuery(value);
    const q = value.trim();
    latest.current = q;
    if (timer.current) clearTimeout(timer.current);
    if (q.length < 2) { setResults(null); setLoading(false); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const res = await searchClub(q);
      if (latest.current !== q) return; // a sosit un răspuns vechi
      setLoading(false);
      if (res.ok) { setResults(res.data); setCursor(0); }
    }, 180);
  };

  const items = useMemo<Item[]>(() => {
    if (!results) return [];
    return [
      ...results.players.map((p) => ({ key: "p" + p.id, group: t.players, label: p.full_name, meta: [p.shirt_number ? `#${p.shirt_number}` : null, p.team].filter(Boolean).join(" · "), href: `/lot/jucatori/${p.id}`, icon: User })),
      ...results.teams.map((g) => ({ key: "t" + g.id, group: t.teams, label: g.name, href: `/lot?echipa=${g.id}`, icon: Shield })),
      ...results.events.map((e) => ({ key: "e" + e.id, group: t.events, label: e.title, meta: formatDateTime(e.starts_at), href: `/program/${e.id}`, icon: CalendarDays })),
      ...results.guardians.map((g) => ({ key: "g" + g.id, group: t.guardians, label: g.full_name, meta: g.phone ?? undefined, href: `/lot/parinti?q=${encodeURIComponent(g.full_name)}`, icon: Users })),
    ];
  }, [results, t]);

  const go = (it: Item) => { onClose(); router.push(it.href); };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={t.open}>
      <button type="button" aria-label="Închide" className="absolute inset-0 bg-ink/50" onClick={onClose} tabIndex={-1} />
      <div className="absolute inset-x-0 top-0 flex max-h-dvh flex-col bg-surface shadow-lg md:inset-x-auto md:left-1/2 md:top-[12vh] md:max-h-[70vh] md:w-[40rem] md:-translate-x-1/2 md:rounded-[var(--radius-sheet)]">
        <div className="flex items-center gap-2 border-b border-line px-3 pt-safe">
          <Search className="size-5 shrink-0 text-ink-3" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, items.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
              if (e.key === "Enter" && items[cursor]) { e.preventDefault(); go(items[cursor]); }
            }}
            placeholder={t.placeholder}
            role="combobox"
            aria-expanded={items.length > 0}
            aria-controls={listId}
            aria-activedescendant={items[cursor] ? `${listId}-${items[cursor].key}` : undefined}
            aria-label={t.open}
            className="h-14 min-w-0 flex-1 bg-transparent text-lg outline-none"
          />
          <button type="button" onClick={onClose} aria-label="Închide" className="inline-flex size-12 items-center justify-center rounded-lg hover:bg-sunken">
            <X className="size-6" aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto p-2">
          {query.trim().length < 2 ? (
            <p className="p-3 text-ink-3">{t.hint}</p>
          ) : !loading && results && items.length === 0 ? (
            <p className="p-3 text-ink-3">{t.none(query.trim())}</p>
          ) : (
            <ul id={listId} role="listbox" aria-label={t.open}>
              {items.map((it, i) => {
                const Icon = it.icon;
                const first = i === 0 || items[i - 1].group !== it.group;
                return (
                  <li key={it.key} role="presentation">
                    {first ? <p className="px-3 pb-1 pt-3 text-xs font-semibold text-ink-3">{it.group}</p> : null}
                    <div id={`${listId}-${it.key}`} role="option" aria-selected={i === cursor} tabIndex={-1}
                      onMouseEnter={() => setCursor(i)} onClick={() => go(it)}
                      className={cn("flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-3", i === cursor && "bg-sunken")}>
                      <Icon className="size-5 shrink-0 text-ink-3" aria-hidden />
                      <span className="min-w-0 flex-1 truncate font-semibold">{it.label}</span>
                      {it.meta ? <span className="shrink-0 text-sm text-ink-3">{it.meta}</span> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
