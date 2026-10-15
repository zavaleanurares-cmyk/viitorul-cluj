"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronRight, Plus, Search, ShieldAlert, ShieldCheck } from "lucide-react";
import { POSITIONS, formatDateShort, label, norm, type ClubStatus, type Group, type PlayerListItem } from "@club/shared";
import { Button, LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import { Checkbox, Input, Select } from "@/components/ui/form";
import { Avatar } from "@/components/ui/misc";
import { Badge, ReviewBadge, StatusChip } from "@/components/ui/status";
import { cn } from "@/lib/cn";
import { useT } from "@/messages";
import { visaState } from "./domain";
import { PlayerFormDialog } from "./player-form-dialog";

type Filters = { q: string; grupa: string; stare: string; inactivi: boolean };

const GRID = "md:grid-cols-[minmax(0,1.6fr)_7rem_7rem_9.5rem_minmax(0,1fr)_1.25rem]";
const NO_GROUP = "fara-grupa";

/** Lista jucătorilor: căutare și filtre în browser (lista are cel mult câteva sute de rânduri). */
export function PlayersList({ players, groups, statuses, photos, canManage, today, visaWarnDays, initial }: {
  players: PlayerListItem[]; groups: Group[]; statuses: ClubStatus[]; photos: Record<string, string>;
  canManage: boolean; today: string; visaWarnDays: number; initial: Filters;
}) {
  const t = useT().players.list;
  const router = useRouter();
  const [f, setF] = useState<Filters>(initial);
  const [adding, setAdding] = useState(false);

  // filtrele stau și în adresă, ca linkul să poată fi trimis mai departe
  const update = (patch: Partial<Filters>) => {
    const next = { ...f, ...patch };
    setF(next);
    const q = new URLSearchParams();
    if (next.q.trim()) q.set("q", next.q.trim());
    if (next.grupa) q.set("grupa", next.grupa);
    if (next.stare) q.set("stare", next.stare);
    if (next.inactivi) q.set("inactivi", "1");
    const s = q.toString();
    window.history.replaceState(null, "", s ? `?${s}` : window.location.pathname);
  };

  const statusById = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);
  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const hasUngrouped = players.some((p) => !p.group_id);
  const pool = players.filter((p) => f.inactivi || p.is_active);

  const shown = useMemo(() => {
    const q = norm(f.q);
    return players.filter((p) => {
      if (!f.inactivi && !p.is_active) return false;
      if (f.grupa === NO_GROUP ? !!p.group_id : f.grupa && p.group_id !== f.grupa) return false;
      if (f.stare && p.status_id !== f.stare) return false;
      if (q && !norm(p.display_name).includes(q) && !norm(p.full_name).includes(q)) return false;
      return true;
    });
  }, [players, f]);

  const filtered = !!(f.q.trim() || f.grupa || f.stare);

  return (
    <>
      <div className="mb-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_12rem_12rem_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-ink-3" aria-hidden />
          <Input
            type="search" aria-label={t.search} placeholder={t.search} value={f.q} className="pl-10"
            onChange={(e) => update({ q: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 md:contents">
          {groups.length > 1 || hasUngrouped ? (
            <Select aria-label={t.group} value={f.grupa} onChange={(e) => update({ grupa: e.target.value })}>
              <option value="">{t.allGroups}</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              {hasUngrouped ? <option value={NO_GROUP}>{t.noGroup}</option> : null}
            </Select>
          ) : null}
          <Select aria-label={t.status} value={f.stare} onChange={(e) => update({ stare: e.target.value })}>
            <option value="">{t.allStatuses}</option>
            {statuses.filter((s) => s.is_active || s.id === f.stare).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </Select>
        </div>
        {canManage ? (
          <Button icon={<Plus className="size-5" aria-hidden />} onClick={() => setAdding(true)}>{t.add}</Button>
        ) : null}
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4">
        <p className="text-sm text-ink-3" aria-live="polite">{t.count(shown.length, pool.length)}</p>
        {canManage && players.some((p) => !p.is_active) ? (
          <Checkbox label={t.showInactive} checked={f.inactivi} onChange={(e) => update({ inactivi: e.target.checked })} className="min-h-0 py-1" />
        ) : null}
      </div>

      {!players.length ? (
        <EmptyState
          title={t.emptyTitle}
          description={canManage ? t.emptyPhysio : t.emptyOther}
          action={canManage ? <LinkButton href="/import">{t.importLink}</LinkButton> : undefined}
        />
      ) : !shown.length ? (
        <EmptyState
          title={t.noMatchTitle}
          description={t.noMatch}
          action={filtered ? <Button variant="secondary" onClick={() => update({ q: "", grupa: "", stare: "" })}>{t.resetFilters}</Button> : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-line/70 bg-surface shadow-[var(--shadow-card)]">
          <div className={cn("hidden border-b border-line bg-canvas px-3 py-2 text-sm font-semibold text-ink-3 md:grid md:gap-x-3", GRID)}>
            <span>{t.colPlayer}</span>
            <span>{t.colGroup}</span>
            <span>{t.colPosition}</span>
            <span>{t.colStatus}</span>
            <span>{t.colVisa}</span>
            <span />
          </div>
          <ul>
            {shown.map((p) => {
              const status = p.status_id ? statusById.get(p.status_id) : undefined;
              const group = p.group_id ? groupById.get(p.group_id) : undefined;
              const position = label(POSITIONS, p.position, "");
              const visa = visaState(p.medical_visa_expires_on, today, visaWarnDays);
              const visaDate = formatDateShort(p.medical_visa_expires_on);
              const visaWarn =
                visa === "expired" ? t.visaExpired(visaDate) : visa === "expiring" ? t.visaExpiring(visaDate) : null;
              return (
                <li key={p.id} className="border-b border-line last:border-b-0">
                  <Link
                    href={`/lot/jucatori/${p.id}/stare`}
                    className={cn(
                      "grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3 py-2 hover:bg-canvas active:bg-sunken md:min-h-14",
                      GRID, !p.is_active && "opacity-70",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <Avatar name={p.display_name} src={p.photo_path ? photos[p.photo_path] : null} size={40} />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="truncate font-bold leading-tight">{p.display_name}</span>
                          {p.needs_review ? <ReviewBadge note={p.review_note} /> : null}
                          {!p.is_active ? <Badge tone="outline">{t.inactive}</Badge> : null}
                        </span>
                        {p.full_name !== p.display_name ? <span className="block truncate text-sm text-ink-3">{p.full_name}</span> : null}
                        <span className="block truncate text-sm text-ink-3 md:hidden">
                          {[group?.name, position].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </span>
                    <span className="hidden truncate md:block">{group?.name ?? "—"}</span>
                    <span className="hidden truncate md:block">{position || "—"}</span>
                    <span className="justify-self-end md:justify-self-start"><StatusChip status={status} /></span>
                    {visaWarn ? (
                      <span className="col-span-2 flex items-center gap-1.5 text-sm font-semibold md:col-span-1">
                        <ShieldAlert className={cn("size-4 shrink-0", visa === "expired" ? "text-st-red" : "text-st-orange")} aria-hidden />
                        {visaWarn}
                      </span>
                    ) : (
                      <span className="hidden items-center gap-1.5 text-sm text-ink-3 md:flex">
                        {visa === "valid" ? <ShieldCheck className="size-4 shrink-0" aria-hidden /> : null}
                        {visa === "valid" ? visaDate : t.visaMissing}
                      </span>
                    )}
                    <ChevronRight className="hidden size-5 text-ink-3 md:block" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {canManage ? (
        <PlayerFormDialog
          open={adding}
          onClose={() => setAdding(false)}
          groups={groups}
          known={players}
          today={today}
          defaultGroupId={f.grupa && f.grupa !== NO_GROUP ? f.grupa : undefined}
          onCreated={(id) => router.push(`/lot/jucatori/${id}/stare`)}
        />
      ) : null}
    </>
  );
}
