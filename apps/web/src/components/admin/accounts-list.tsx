"use client";
import { useMemo, useState } from "react";
import { ChevronRight, Search, UserPlus, Users } from "lucide-react";
import { ROLE_LABELS, norm, type AppRole, type Group } from "@club/shared";
import { Button, LinkButton } from "@/components/ui/button";
import { EmptyState, Notice } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import { useT } from "@/messages";
import { AccountDialog, NewStaffDialog, PlayerAccountDialog } from "./account-dialogs";
import type { AccountRow, AccountState, PlayerOption } from "./queries";

const GRID = "md:grid-cols-[minmax(0,1.3fr)_9.5rem_minmax(0,1fr)_6.5rem_9.5rem_1.25rem]";
const STATE_TONE: Record<AccountState, "green" | "yellow" | "gray"> = { active: "green", invited: "yellow", disabled: "gray", anonymized: "gray" };
const ROLE_ORDER: AppRole[] = ["physio", "coach", "sporting_director", "owner", "medical_partner", "player"];

type Filters = { q: string; rol: string; stare: string };

/** Lista conturilor clubului, cu căutare și filtre în browser; conturile se deschid într-o fereastră de editare. */
export function AccountsList({ accounts, groups, withoutAccount, initial, openAccountId, newPlayerId }: {
  accounts: AccountRow[]; groups: Group[]; withoutAccount: PlayerOption[]; initial: Filters;
  /** cont de deschis la încărcare (linkul din fișa unui jucător care are deja cont) */
  openAccountId?: string;
  /** jucător fără cont, preselectat în formularul de creare */
  newPlayerId?: string;
}) {
  const t = useT().admin.accounts;
  const [f, setF] = useState<Filters>(initial);
  const [editing, setEditing] = useState<string | null>(openAccountId ?? null);
  const [newStaff, setNewStaff] = useState(false);
  const [newPlayer, setNewPlayer] = useState(!!newPlayerId);
  const activeGroups = groups.filter((g) => g.is_active);
  const groupName = useMemo(() => new Map(groups.map((g) => [g.id, g.name])), [groups]);

  const update = (patch: Partial<Filters>) => {
    const next = { ...f, ...patch };
    setF(next);
    const q = new URLSearchParams();
    if (next.q.trim()) q.set("q", next.q.trim());
    if (next.rol) q.set("rol", next.rol);
    if (next.stare) q.set("stare", next.stare);
    const s = q.toString();
    window.history.replaceState(null, "", s ? `?${s}` : window.location.pathname);
  };

  const shown = useMemo(() => {
    const q = norm(f.q);
    return accounts.filter((a) => {
      if (f.rol && a.role !== f.rol) return false;
      if (f.stare && a.state !== f.stare) return false;
      if (q && !norm(a.fullName).includes(q) && !norm(a.email).includes(q) && !norm(a.player?.displayName).includes(q)) return false;
      return true;
    });
  }, [accounts, f]);

  const roles = ROLE_ORDER.filter((r) => accounts.some((a) => a.role === r));
  const current = editing ? accounts.find((a) => a.id === editing) ?? null : null;
  const detail = (a: AccountRow) =>
    a.role === "coach" ? a.groupIds.map((g) => groupName.get(g)).filter(Boolean).join(", ") || t.noGroups
    : a.role === "player" ? a.player?.displayName ?? t.noPlayer
    : "";

  return (
    <>
      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[auto_auto_1fr]">
        <Button icon={<UserPlus className="size-5" aria-hidden />} onClick={() => setNewStaff(true)}>{t.newStaff}</Button>
        <Button variant="secondary" icon={<UserPlus className="size-5" aria-hidden />} disabled={!withoutAccount.length} onClick={() => setNewPlayer(true)}>
          {t.newPlayer}
        </Button>
        {withoutAccount.length ? (
          <LinkButton href="/administrare/conturi/grupa" icon={<Users className="size-5" aria-hidden />} className="sm:col-span-2 lg:col-span-1 lg:justify-self-start">
            {t.bulkLink}
          </LinkButton>
        ) : null}
      </div>
      <Notice tone="gray" className="mb-4">
        {t.inviteOnly}
        {withoutAccount.length ? ` ${t.withoutAccount(withoutAccount.length)}` : ""}
      </Notice>

      <div className="mb-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_13rem_11rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input type="search" aria-label={t.search} placeholder={t.search} value={f.q} className="pl-10" onChange={(e) => update({ q: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-2 md:contents">
          <Select aria-label={t.role} value={f.rol} onChange={(e) => update({ rol: e.target.value })}>
            <option value="">{t.allRoles}</option>
            {roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </Select>
          <Select aria-label={t.state} value={f.stare} onChange={(e) => update({ stare: e.target.value })}>
            <option value="">{t.allStates}</option>
            {(["active", "invited", "disabled"] as const).map((s) => <option key={s} value={s}>{t.states[s]}</option>)}
          </Select>
        </div>
      </div>
      <p className="mb-2 text-sm text-ink-3" aria-live="polite">{t.count(shown.length, accounts.length)}</p>

      {!shown.length ? (
        <EmptyState
          title={t.noMatchTitle} description={t.noMatch}
          action={<Button variant="secondary" onClick={() => update({ q: "", rol: "", stare: "" })}>{t.resetFilters}</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-line/70 bg-surface shadow-[var(--shadow-card)]">
          <div className={cn("hidden border-b border-line bg-canvas px-4 py-2 text-sm font-semibold text-ink-3 md:grid md:gap-x-3", GRID)}>
            <span>{t.colAccount}</span>
            <span>{t.role}</span>
            <span>{t.colDetail}</span>
            <span>{t.state}</span>
            <span>{t.colLastSignIn}</span>
            <span />
          </div>
          <ul>
            {shown.map((a) => (
              <li key={a.id} className="border-b border-line last:border-b-0">
                <button
                  type="button" onClick={() => setEditing(a.id)} aria-label={t.open(a.fullName)}
                  className={cn(
                    "grid w-full min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-2 text-left hover:bg-canvas active:bg-sunken md:min-h-14",
                    GRID, (a.state === "disabled" || a.state === "anonymized") && "opacity-70",
                  )}
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-x-2">
                      <span className="truncate font-bold leading-tight">{a.fullName}</span>
                      {a.isSelf ? <Badge tone="outline">{t.you}</Badge> : null}
                    </span>
                    <span className="block truncate text-sm text-ink-3">{a.email || "—"}</span>
                    <span className="block truncate text-sm text-ink-3 md:hidden">{[ROLE_LABELS[a.role], detail(a)].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="hidden truncate md:block">{ROLE_LABELS[a.role]}</span>
                  <span className="hidden truncate md:block">{detail(a) || "—"}</span>
                  <span className="justify-self-end md:justify-self-start"><Badge tone={STATE_TONE[a.state]}>{t.states[a.state]}</Badge></span>
                  <span className="col-span-2 text-sm text-ink-3 md:col-span-1">
                    <span className="md:hidden">{t.colLastSignIn}: </span>
                    {a.lastSignIn ?? t.never}
                  </span>
                  <ChevronRight className="hidden size-5 text-ink-3 md:block" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <NewStaffDialog open={newStaff} onClose={() => setNewStaff(false)} groups={activeGroups} />
      <PlayerAccountDialog open={newPlayer} onClose={() => setNewPlayer(false)} players={withoutAccount} groups={groups} initialPlayerId={newPlayerId} />
      {current ? <AccountDialog key={current.id} account={current} onClose={() => setEditing(null)} groups={activeGroups} freePlayers={withoutAccount} /> : null}
    </>
  );
}
