import Link from "next/link";
import { Check, MessageSquare, Plus, TriangleAlert, Users } from "lucide-react";
import {
  WEEKDAYS_RO, WEEKDAYS_SHORT_RO, addDays, formatDate, formatDateShort, listPlayers, weekDates, weekStart,
  type ClubStatus, type PlayerListItem,
} from "@club/shared";
import { z } from "zod";
import { requireRole, visibleGroups } from "@/lib/auth";
import { getT } from "@/messages";
import { cn } from "@/lib/cn";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { PrevNext, TableWrap } from "@/components/ui/misc";
import { StatusChip } from "@/components/ui/status";
import { NavSelect } from "@/components/planning/nav-select";
import { getPlanCells, type PlanCell } from "@/components/planning/queries";

export const metadata = { title: "Planuri zilnice" };

const ALL = "toate";
type Search = { grupa?: string; saptamana?: string; zi?: string; filtru?: string };

const isDate = (s: string | undefined): s is string => !!s && z.iso.date().safeParse(s).success;

/** Planurile zilnice: vedere pe săptămână (jucători × zile) și vedere pe zi. */
export default async function PlansPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const { db, ctx } = await requireRole("physio");
  const t = getT().planning.plans;

  const groups = visibleGroups(ctx);
  const selected = sp.grupa === ALL ? ALL : groups.find((g) => g.id === sp.grupa)?.id ?? groups[0]?.id ?? ALL;
  const day = isDate(sp.zi) ? sp.zi : null;
  const monday = weekStart(day ?? (isDate(sp.saptamana) ? sp.saptamana : ctx.today));
  const days = weekDates(monday);
  const onlyUnavailable = sp.filtru === "indisponibili";

  const statusById = new Map<string, ClubStatus>(ctx.statuses.map((s) => [s.id, s]));
  const statusOf = (p: PlayerListItem) => (p.status_id ? statusById.get(p.status_id) : undefined);
  const inGroup = await listPlayers(db, selected === ALL ? {} : { groupId: selected });
  const unavailable = inGroup.filter((p) => (statusOf(p)?.availability ?? "full") !== "full");
  const players = onlyUnavailable ? unavailable : inGroup;

  const href = (patch: { grupa?: string; saptamana?: string; zi?: string | null; filtru?: boolean }) => {
    const next = {
      grupa: patch.grupa ?? selected,
      zi: patch.zi === undefined ? day : patch.zi,
      saptamana: patch.saptamana ?? monday,
      filtru: patch.filtru ?? onlyUnavailable,
    };
    const q = new URLSearchParams();
    if (next.grupa !== (groups[0]?.id ?? ALL)) q.set("grupa", next.grupa);
    if (next.zi) q.set("zi", next.zi);
    else if (next.saptamana !== weekStart(ctx.today)) q.set("saptamana", next.saptamana);
    if (next.filtru) q.set("filtru", "indisponibili");
    const s = q.toString();
    return s ? `/planuri?${s}` : "/planuri";
  };

  const cells = await getPlanCells(db, players.map((p) => p.id), day ?? days[0], day ?? days[6]);
  const todayInWeek = days.includes(ctx.today);
  const defaultDay = todayInWeek ? ctx.today : days[0];

  const controls = (
    <div className="mb-3 space-y-3">
      <div className="grid gap-2 md:grid-cols-[16rem_minmax(0,1fr)] md:items-center">
        <NavSelect
          label={t.group}
          value={selected}
          options={[
            ...groups.map((g) => ({ value: g.id, label: g.name, href: href({ grupa: g.id }) })),
            { value: ALL, label: t.allGroups, href: href({ grupa: ALL }) },
          ]}
        />
        {day ? (
          <PrevNext
            prevHref={href({ zi: addDays(day, -1) })}
            nextHref={href({ zi: addDays(day, 1) })}
            todayHref={day === ctx.today ? undefined : href({ zi: ctx.today })}
            label={<span className="first-letter:uppercase">{formatDate(day, { weekday: true, year: false })}</span>}
          />
        ) : (
          <PrevNext
            prevHref={href({ saptamana: addDays(monday, -7) })}
            nextHref={href({ saptamana: addDays(monday, 7) })}
            todayHref={todayInWeek ? undefined : href({ saptamana: weekStart(ctx.today) })}
            label={t.weekLabel(formatDateShort(days[0], false), formatDateShort(days[6]))}
          />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <nav aria-label={t.view} className="inline-flex gap-1 rounded-[0.75rem] bg-sunken p-1">
          {[
            { on: !day, href: href({ zi: null }), label: t.week },
            { on: !!day, href: href({ zi: day ?? defaultDay }), label: t.day },
          ].map((v) => (
            <Link key={v.label} href={v.href} aria-current={v.on ? "page" : undefined}
              className={cn("inline-flex h-8 items-center rounded-[0.5rem] px-3.5 text-[0.875rem] font-medium transition-colors", v.on ? "bg-surface text-ink shadow-[0_1px_3px_rgb(0_0_0/0.12)]" : "text-ink-2 hover:text-ink")}>
              {v.label}
            </Link>
          ))}
        </nav>
        <Link href={href({ filtru: !onlyUnavailable })} aria-current={onlyUnavailable ? "true" : undefined}
          className={cn(
            "inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 font-medium whitespace-nowrap",
            onlyUnavailable ? "border-brand bg-brand text-brand-ink" : "border-transparent bg-sunken text-ink hover:bg-line",
          )}>
          {onlyUnavailable ? <Check className="size-5" strokeWidth={3} aria-hidden /> : null}
          {t.onlyUnavailable} ({unavailable.length})
        </Link>
      </div>
    </div>
  );

  return (
    <>
      <PageHeader title={t.title} description={t.description} />
      {controls}
      {!players.length ? (
        <EmptyState
          icon={<Users className="size-8" aria-hidden />}
          title={t.empty.title}
          description={onlyUnavailable ? t.empty.noUnavailable : t.empty.noGroup}
          action={onlyUnavailable ? <LinkButton href={href({ filtru: false })}>{t.empty.showAll}</LinkButton> : undefined}
        />
      ) : day ? (
        <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {players.map((p) => {
            const cell = cells.get(`${p.id}:${day}`);
            return (
              <li key={p.id}>
                <Link href={`/planuri/${p.id}/${day}`}
                  aria-label={(cell ? t.open : t.create)(p.display_name, formatDate(day, { year: false }))}
                  className="flex h-full min-h-16 items-center gap-3 rounded-[var(--radius-card)] border border-line/70 bg-surface p-3 hover:border-line-strong hover:bg-canvas shadow-[var(--shadow-card)]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{p.display_name}</span>
                    <span className="mt-1 flex items-center gap-2">
                      <StatusChip status={statusOf(p)} size="sm" />
                      <span className="truncate text-sm text-ink-3">
                        {cell ? cell.title || (cell.total ? getT().planning.exercises(cell.total) : t.noItems) : t.noPlan}
                      </span>
                    </span>
                  </span>
                  {cell ? <CellBadge cell={cell} /> : (
                    <span className="inline-flex h-10 items-center gap-1 rounded-full border-dashed px-2.5 text-sm font-medium text-ink-2">
                      <Plus className="size-4" aria-hidden />{t.addPlan}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <>
          <TableWrap>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 w-36 min-w-36 border-r border-line bg-canvas md:w-56">{t.player}</th>
                {days.map((d, i) => (
                  <th key={d} scope="col" className={cn("min-w-16 !px-1 text-center", d === ctx.today && "!text-ink")}>
                    <Link href={href({ zi: d })} title={`${WEEKDAYS_RO[i]}, ${formatDate(d, { year: false })}`}
                      className={cn("mx-auto flex h-11 w-14 flex-col items-center justify-center rounded-[var(--radius-control)] leading-tight hover:bg-sunken", d === ctx.today && "bg-brand text-brand-ink hover:bg-brand")}>
                      <span>{WEEKDAYS_SHORT_RO[i]}</span>
                      <span className="font-normal">{formatDateShort(d, false)}</span>
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id}>
                  <th scope="row" className="sticky left-0 z-10 w-36 min-w-36 max-w-36 border-r border-t border-line bg-surface !py-1 md:w-56 md:max-w-56">
                    <Link href={`/lot/jucatori/${p.id}/plan`} className="flex min-h-12 flex-col justify-center gap-0.5 text-base font-bold text-ink underline-offset-2 hover:underline">
                      <span className="truncate">{p.display_name}</span>
                      {(statusOf(p)?.availability ?? "full") !== "full" ? <StatusChip status={statusOf(p)} size="sm" className="self-start" /> : null}
                    </Link>
                  </th>
                  {days.map((d) => {
                    const cell = cells.get(`${p.id}:${d}`);
                    const date = formatDate(d, { year: false });
                    return (
                      <td key={d} className={cn("!px-1 !py-1 text-center", d === ctx.today && "bg-canvas")}>
                        <Link href={`/planuri/${p.id}/${d}`}
                          aria-label={`${(cell ? t.open : t.create)(p.display_name, date)}${cell ? `, ${t.cellTitle(cell.done, cell.total)}${cell.pain ? `, ${t.pain}` : ""}` : ""}`}
                          title={cell ? `${cell.title ? `${cell.title}: ` : ""}${t.cellTitle(cell.done, cell.total)}${cell.pain ? `, ${t.pain}` : ""}` : t.create(p.display_name, date)}
                          className="mx-auto flex h-12 w-14 items-center justify-center rounded-[var(--radius-control)] hover:bg-sunken">
                          {cell ? <CellBadge cell={cell} compact /> : <Plus className={cn("size-5", d < ctx.today ? "text-line-strong" : "text-ink-3")} aria-hidden />}
                        </Link>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-3">
            <span>{t.legend}</span>
            <span className="inline-flex items-center gap-1"><Check className="size-4 text-st-green" strokeWidth={3} aria-hidden />{t.legendDone}</span>
            <span className="inline-flex items-center gap-1"><TriangleAlert className="size-4 text-st-red" aria-hidden />{t.pain}</span>
          </p>
        </>
      )}
    </>
  );
}

/** „3/5", cu bifă când planul este făcut integral și semn de avertizare când jucătorul a semnalat durere. */
function CellBadge({ cell, compact }: { cell: PlanCell; compact?: boolean }) {
  const t = getT().planning.plans;
  const complete = cell.total > 0 && cell.done >= cell.total;
  return (
    <span className={cn(
      "relative inline-flex h-10 shrink-0 items-center justify-center gap-1 rounded-full text-sm font-bold",
      compact ? "w-full px-0.5" : "px-2",
      cell.pain ? "border-st-red bg-st-red-soft" : complete ? "border-st-green bg-st-green-soft" : "border-transparent bg-sunken",
    )}>
      {cell.pain ? <TriangleAlert className="size-3.5 shrink-0 text-st-red" aria-hidden /> : complete ? <Check className="size-3.5 shrink-0 text-st-green" strokeWidth={3} aria-hidden /> : null}
      {cell.total ? t.cell(cell.done, cell.total) : "0"}
      {cell.comments && !compact ? <MessageSquare className="size-3.5 shrink-0 text-ink-3" aria-hidden /> : null}
    </span>
  );
}
