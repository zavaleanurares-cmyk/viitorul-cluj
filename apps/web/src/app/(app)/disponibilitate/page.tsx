import Link from "next/link";
import { Users } from "lucide-react";
import {
  AVAILABILITY_LABELS, can, describeZone, formatDate, formatDateShort, listPlayers,
  type Availability, type ClubStatus, type PlayerListItem,
} from "@club/shared";
import { requireCapability, visibleGroups } from "@/lib/auth";
import { EmptyState, Notice, PageHeader } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { TabLinks } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { getT } from "@/messages";
import { AvailabilityBoard, type BoardSection } from "@/components/players/availability-board";
import { AVAILABILITY_ORDER, availabilityOf } from "@/components/players/domain";
import { PrintButton } from "@/components/players/print-button";

const ALL = "toate";
const NO_GROUP = "fara-grupa";
type Filter = "nu-apti" | "verificare" | null;

const PRINT_CSS =
  "@media print{@page{margin:12mm}div:has(>aside.no-print){display:block!important}main{max-width:none!important;padding:0!important}}";

const TILE_BAR: Record<Availability, string> = { full: "bg-st-green", limited: "bg-st-orange", out: "bg-st-red" };

/** Tabloul de disponibilitate: ce vede antrenorul dimineața. */
export default async function Page({ searchParams }: { searchParams: Promise<{ grupa?: string; filtru?: string }> }) {
  const { db, ctx } = await requireCapability("viewAvailabilityBoard");
  const sp = await searchParams;
  const t = getT().players;
  const b = t.board;
  const canEdit = can(ctx.role, "manage");

  const groups = visibleGroups(ctx);
  const all = await listPlayers(db);
  const statusById = new Map<string, ClubStatus>(ctx.statuses.map((s) => [s.id, s]));
  const availability = (p: PlayerListItem) => availabilityOf(p.status_id ? statusById.get(p.status_id) : null);
  const groupIds = new Set(groups.map((g) => g.id));
  const ungrouped = all.filter((p) => !p.group_id || !groupIds.has(p.group_id));

  if (!groups.length && !all.length) {
    return (
      <>
        <PageHeader title={b.title} />
        <EmptyState
          icon={<Users className="size-8" aria-hidden />}
          title={ctx.role === "coach" ? b.noGroupsTitle : b.emptyGroupTitle}
          description={ctx.role === "coach" ? b.noGroupsDescription : canEdit ? b.emptyGroupPhysio : b.emptyGroupOther}
        />
      </>
    );
  }

  const multi = groups.length + (ungrouped.length ? 1 : 0) > 1;
  const selected =
    multi && sp.grupa === ALL ? ALL
    : sp.grupa === NO_GROUP && ungrouped.length ? NO_GROUP
    : groups.find((g) => g.id === sp.grupa)?.id ?? groups[0]?.id ?? NO_GROUP;
  const filter: Filter = sp.filtru === "nu-apti" ? "nu-apti" : sp.filtru === "verificare" && canEdit ? "verificare" : null;

  const inSelection =
    selected === ALL ? all
    : selected === NO_GROUP ? ungrouped
    : all.filter((p) => p.group_id === selected);

  const counts: Record<Availability, number> = { full: 0, limited: 0, out: 0 };
  for (const p of inSelection) counts[availability(p)]++;
  const notFit = inSelection.length - counts.full;
  const review = inSelection.filter((p) => p.needs_review).length;
  const reviewElsewhere = canEdit && selected !== ALL ? all.filter((p) => p.needs_review).length - review : 0;

  const shown = inSelection.filter((p) =>
    filter === "nu-apti" ? availability(p) !== "full" : filter === "verificare" ? p.needs_review : true,
  );
  const sorted = [...shown].sort(
    (x, y) =>
      AVAILABILITY_ORDER.indexOf(availability(x)) - AVAILABILITY_ORDER.indexOf(availability(y)) ||
      x.display_name.localeCompare(y.display_name, "ro"),
  );

  const availabilityTitle: Record<Availability, string> = {
    out: t.availability.out, limited: t.availability.limitedLong, full: t.availability.full,
  };
  let sections: BoardSection[];
  if (selected === ALL) {
    sections = [
      ...groups.map((g) => ({ key: g.id, title: g.name, players: sorted.filter((p) => p.group_id === g.id) })),
      { key: NO_GROUP, title: b.noGroup, players: sorted.filter((p) => !p.group_id || !groupIds.has(p.group_id)) },
    ].filter((s) => s.players.length);
  } else {
    sections = AVAILABILITY_ORDER.map((a) => ({
      key: a, title: availabilityTitle[a], players: sorted.filter((p) => availability(p) === a),
    })).filter((s) => s.players.length);
  }

  const href = (grupa: string, filtru: Filter = filter) => {
    const q = new URLSearchParams();
    if (grupa !== (groups[0]?.id ?? NO_GROUP)) q.set("grupa", grupa);
    if (filtru) q.set("filtru", filtru);
    const s = q.toString();
    return s ? `/disponibilitate?${s}` : "/disponibilitate";
  };

  const tabs = [
    ...groups.map((g) => ({ key: g.id, href: href(g.id), label: g.name })),
    ...(ungrouped.length ? [{ key: NO_GROUP, href: href(NO_GROUP), label: b.noGroup }] : []),
    ...(multi ? [{ key: ALL, href: href(ALL), label: b.allGroups }] : []),
  ];
  const selectionName =
    selected === ALL ? ctx.club.name
    : selected === NO_GROUP ? b.noGroup
    : groups.find((g) => g.id === selected)?.name ?? "";

  const filters: Array<{ key: Filter; label: string; show: boolean }> = [
    { key: null, label: b.filterAll(inSelection.length), show: true },
    { key: "nu-apti", label: b.filterNotFit(notFit), show: true },
    { key: "verificare", label: b.filterReview(review), show: canEdit && (review > 0 || filter === "verificare") },
  ];

  return (
    <>
      {/* tipărire: fără meniul lateral (grila lui ar îngusta foaia) și fără marginile de ecran */}
      <style>{PRINT_CSS}</style>
      <PageHeader
        title={b.title}
        description={
          <>
            <span className="print:hidden">{b.description(formatDate(ctx.today, { weekday: true, year: false }))}</span>
            <span className="hidden font-semibold text-ink print:inline">
              {ctx.club.name} — {selectionName} · {b.printedAt(formatDate(ctx.today, { weekday: true }))}
            </span>
          </>
        }
        action={<PrintButton label={b.print} />}
      />

      {multi ? <TabLinks tabs={tabs} current={selected} className="no-print mb-3" /> : null}

      {/* Sumarul selecției */}
      <dl aria-label={b.summaryLabel} className="mb-3 grid grid-cols-3 gap-2">
        {AVAILABILITY_ORDER.slice().reverse().map((a) => (
          <div key={a} className="flex flex-col-reverse rounded-[var(--radius-card)] border border-line bg-surface px-3 py-2">
            <dd className="text-2xl font-bold leading-none md:text-3xl">{counts[a]}</dd>
            <dt className="mb-1 flex items-center gap-1.5 truncate text-sm text-ink-2" title={AVAILABILITY_LABELS[a]}>
              <span className={cn("size-2.5 shrink-0 rounded-full [print-color-adjust:exact]", TILE_BAR[a])} aria-hidden />{t.availability[a]}
            </dt>
          </div>
        ))}
      </dl>

      <nav aria-label={b.filterLabel} className="no-print mb-3 flex flex-wrap gap-2">
        {filters.filter((f) => f.show).map((f) => (
          <Link
            key={f.key ?? "all"}
            href={href(selected, f.key)}
            aria-current={filter === f.key ? "true" : undefined}
            className={cn(
              "inline-flex h-12 items-center rounded-full border px-4 font-semibold whitespace-nowrap",
              filter === f.key ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-ink hover:bg-canvas",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {reviewElsewhere > 0 ? (
        <Notice tone="yellow" className="no-print mb-3">
          {b.reviewElsewhere(reviewElsewhere)}{" "}
          <Link href={href(ALL, "verificare")} className="font-semibold underline underline-offset-4">{b.reviewElsewhereLink}</Link>
        </Notice>
      ) : null}
      {filter === "verificare" && review > 0 ? <p className="no-print mb-3 text-sm text-ink-3">{b.reviewHint}</p> : null}

      {sections.length ? (
        <>
          <AvailabilityBoard sections={sections} statuses={ctx.statuses} canEdit={canEdit} today={ctx.today} />
          <p className="no-print mt-2 text-sm text-ink-3">{canEdit ? b.editHint : b.readOnlyHint}</p>
          <PrintTable sections={sections} statuses={statusById} single={selected !== ALL} />
        </>
      ) : inSelection.length ? (
        <EmptyState
          title={b.emptyFilterTitle}
          description={filter === "verificare" ? b.emptyReview : b.emptyNotFit}
          action={<LinkButton href={href(selected, null)}>{b.showAll}</LinkButton>}
        />
      ) : (
        <EmptyState
          icon={<Users className="size-8" aria-hidden />}
          title={b.emptyGroupTitle}
          description={canEdit ? b.emptyGroupPhysio : b.emptyGroupOther}
          action={canEdit ? <LinkButton href="/lot">{t.list.title}</LinkButton> : undefined}
        />
      )}
    </>
  );
}

/** Varianta de tipărit: tabel simplu, alb-negru lizibil, cu starea scrisă în clar. */
function PrintTable({ sections, statuses, single }: { sections: BoardSection[]; statuses: Map<string, ClubStatus>; single: boolean }) {
  const b = getT().players.board;
  const cell = "border border-ink/40 px-2 py-1 align-top";
  let n = 0;
  return (
    <table className="hidden w-full border-collapse text-left text-[11pt] leading-snug print:table">
      <thead>
        <tr>
          {["#", b.colPlayer, b.colStatus, b.colZone, b.colReturn, b.colRestrictions, b.colNote].map((h) => (
            <th key={h} scope="col" className={cn(cell, "font-bold")}>{h}</th>
          ))}
        </tr>
      </thead>
      {sections.map((s) => (
        <tbody key={s.key} className="break-inside-auto">
          {single ? null : (
            <tr>
              <th colSpan={7} scope="rowgroup" className={cn(cell, "bg-canvas font-bold [print-color-adjust:exact]")}>{s.title}</th>
            </tr>
          )}
          {s.players.map((p) => {
            const status = p.status_id ? statuses.get(p.status_id) : undefined;
            return (
              <tr key={p.id} className="break-inside-avoid">
                <td className={cn(cell, "w-8 text-right")}>{++n}</td>
                <th scope="row" className={cn(cell, "font-bold whitespace-nowrap")}>{p.display_name}</th>
                <td className={cn(cell, "font-bold whitespace-nowrap")}>{status?.short_label ?? "—"}</td>
                <td className={cell}>
                  {describeZone({ zone: p.status_zone, side: p.status_side, detail: p.status_zone_detail, uncertain: p.status_zone_uncertain }, true)}
                </td>
                <td className={cn(cell, "whitespace-nowrap")}>{p.status_return_on ? formatDateShort(p.status_return_on) : ""}</td>
                <td className={cell}>{p.training_restrictions}</td>
                <td className={cell}>{p.status_note}</td>
              </tr>
            );
          })}
        </tbody>
      ))}
    </table>
  );
}
