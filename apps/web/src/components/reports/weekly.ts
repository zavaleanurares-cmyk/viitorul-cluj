import "server-only";
import writeExcelFile from "write-excel-file/node";
import type { Cell as XCell, SheetData } from "write-excel-file/node";
import {
  AVAILABILITY_LABELS, describeZone, formatDate, formatDateShort, formatDateTime, INJURY_SEVERITY, INJURY_TYPES, label,
  WEEKDAYS_RO, WEEKDAYS_SHORT_RO, zoneLabel,
  type AppContext, type StatusTone, type WellnessEntry,
} from "@club/shared";
import { TONE_HEX } from "@/components/ui/status";
import { daysLost, injuryZoneText } from "@/components/players/domain";
import { getT } from "@/messages";
import { Report, type Cell } from "./pdf";
import type { WeeklyInjury, WeeklyReport } from "./data";

const zoneOf = (p: { status_zone: string | null; status_side: string | null; status_zone_detail: string | null; status_zone_uncertain: boolean }, short = false) =>
  describeZone({ zone: p.status_zone, side: p.status_side, detail: p.status_zone_detail, uncertain: p.status_zone_uncertain }, short);

const injuryKind = (i: WeeklyInjury) =>
  [injuryZoneText(i, true) || "—", i.injury_type ? label(INJURY_TYPES, i.injury_type) : null].filter(Boolean).join(" · ");

function missing(report: WeeklyReport) {
  const none = report.players.filter((p) => p.daysDone === 0);
  const some = report.players.filter((p) => {
    const done = p.days.slice(0, report.elapsedDays).filter(Boolean).length;
    return p.daysDone > 0 && done < report.elapsedDays;
  });
  return { none, some };
}

/** Raportul săptămânal al grupei, PDF A4 pe orizontală (grila de chestionare are 8 coloane). */
export async function buildWeeklyPdf(report: WeeklyReport, ctx: AppContext): Promise<Uint8Array> {
  const t = getT().reports;
  const w = t.week;
  const d = t.doc;
  const r = await Report.create({
    club: ctx.club.name,
    title: w.title(report.group.name),
    subtitle: w.subtitle(formatDate(report.monday), formatDate(report.dates[6])),
    generated: d.generated(formatDateTime(new Date().toISOString(), ctx.settings.timezone)),
    footer: d.footer,
    pageLabel: d.page,
    landscape: true,
  });

  // ---- disponibilitate ----
  r.heading(w.sections.availability);
  r.paragraph(w.availabilitySummary(report.players.length, report.counts.full, report.counts.limited, report.counts.out, formatDate(ctx.today)), { muted: true });
  r.space(4);
  r.table(
    [
      { header: w.cols.nr, width: 4, align: "right" },
      { header: w.cols.player, width: 17 },
      { header: w.cols.status, width: 15 },
      { header: w.cols.zone, width: 19 },
      { header: w.cols.returnOn, width: 9 },
      { header: w.cols.restrictions, width: 18 },
      { header: w.cols.note, width: 18 },
    ],
    report.players.map((x, i): Cell[] => [
      { text: i + 1, muted: true },
      { text: x.player.display_name, bold: true },
      { text: x.status?.short_label ?? d.none, bold: true, dot: TONE_HEX[(x.status?.tone as StatusTone) ?? "gray"] ?? TONE_HEX.gray },
      zoneOf(x.player, true),
      x.player.status_return_on ? formatDateShort(x.player.status_return_on) : "",
      x.player.training_restrictions,
      x.player.status_note,
    ]),
    { empty: t.noPlayers },
  );

  // ---- chestionare ----
  r.heading(w.sections.wellness, 120);
  r.paragraph(w.wellnessLegend, { muted: true, size: 9 });
  r.space(4);
  const cell = (e: WellnessEntry | null): Cell => {
    if (!e) return { text: "–", muted: true };
    const scores = `${e.fatigue ?? "–"} / ${e.muscle_load ?? "–"}`;
    const pain = e.pain_zone ? `${zoneLabel(e.pain_zone, e.pain_side, true)}${e.pain_intensity ? ` (${e.pain_intensity})` : ""}` : e.pain_note ? e.pain_note : "";
    const alert = (e.fatigue ?? 0) >= ctx.settings.alerts.fatigue_threshold || (e.muscle_load ?? 0) >= ctx.settings.alerts.muscle_load_threshold;
    return { text: pain ? `${scores}\n${pain}` : scores, bold: alert };
  };
  r.table(
    [
      { header: w.cols.player, width: 16 },
      ...report.dates.map((date, i) => ({ header: `${WEEKDAYS_SHORT_RO[i]} ${formatDateShort(date, false)}`, width: 11.2 })),
      { header: w.daysDone, width: 5.6, align: "right" as const },
    ],
    report.players.map((x): Cell[] => [{ text: x.player.display_name, bold: true }, ...x.days.map(cell), `${x.daysDone}`]),
    { size: 8.5, empty: t.noPlayers },
  );

  // ---- cine nu a completat ----
  r.heading(w.sections.missing, 30);
  if (report.elapsedDays === 0) {
    r.paragraph(w.futureWeek, { muted: true });
  } else {
    const m = missing(report);
    if (!m.none.length && !m.some.length) r.paragraph(w.missingNone(report.elapsedDays));
    if (m.none.length) {
      r.paragraph(`${w.missingAll} (${m.none.length}):`, { bold: true });
      r.paragraph(m.none.map((x) => x.player.display_name).join(", "));
      r.space(4);
    }
    if (m.some.length) {
      r.paragraph(`${w.missingSome} (${m.some.length}):`, { bold: true });
      r.paragraph(m.some.map((x) => w.missingOf(x.player.display_name, x.days.slice(0, report.elapsedDays).filter(Boolean).length, report.elapsedDays)).join(", "));
    }
  }

  // ---- accidentări ----
  r.heading(w.sections.injuries);
  r.paragraph(w.newInjuries, { bold: true });
  r.space(2);
  r.table(
    [
      { header: w.injuryCols.player, width: 16 },
      { header: w.injuryCols.date, width: 9 },
      { header: w.injuryCols.zone, width: 22 },
      { header: w.injuryCols.diagnosis, width: 28 },
      { header: w.injuryCols.severity, width: 14 },
      { header: w.injuryCols.expected, width: 11 },
    ],
    report.newInjuries.map((i): Cell[] => [
      { text: i.playerName, bold: true }, formatDateShort(i.occurred_on), injuryKind(i), i.diagnosis,
      i.severity && i.severity !== "unknown" ? label(INJURY_SEVERITY, i.severity) : "",
      i.expected_return_on ? formatDateShort(i.expected_return_on) : "",
    ]),
    { empty: w.noInjuries },
  );
  r.space(6);
  r.paragraph(w.returns, { bold: true });
  r.space(2);
  r.table(
    [
      { header: w.injuryCols.player, width: 16 },
      { header: w.injuryCols.returned, width: 9 },
      { header: w.injuryCols.zone, width: 22 },
      { header: w.injuryCols.diagnosis, width: 28 },
      { header: w.injuryCols.date, width: 14 },
      { header: w.injuryCols.days, width: 11, align: "right" },
    ],
    report.returns.map((i): Cell[] => [
      { text: i.playerName, bold: true }, formatDateShort(i.actual_return_on), injuryKind(i), i.diagnosis,
      formatDateShort(i.occurred_on), daysLost(i, ctx.today),
    ]),
    { empty: w.noReturns },
  );

  // ---- aderență ----
  r.heading(w.sections.adherence);
  if (!report.adherence.any) {
    r.paragraph(w.noPrograms, { muted: true });
  } else {
    if (report.adherence.percent !== null) {
      r.paragraph(w.adherenceSummary(report.adherence.percent, report.adherence.under50), { muted: true });
      r.space(4);
    }
    r.table(
      [
        { header: w.adherenceCols.player, width: 20 },
        { header: w.adherenceCols.programs, width: 44 },
        { header: w.adherenceCols.done, width: 12, align: "right" },
        { header: w.adherenceCols.expected, width: 12, align: "right" },
        { header: w.adherenceCols.percent, width: 12, align: "right" },
      ],
      report.players.filter((x) => x.adherence).map((x): Cell[] => [
        { text: x.player.display_name, bold: true }, x.adherence!.programs.join(", "), x.adherence!.done, x.adherence!.expected,
        { text: x.adherence!.percent === null ? d.none : `${x.adherence!.percent}%`, bold: x.adherence!.percent !== null && x.adherence!.percent < 50 },
      ]),
    );
  }

  return r.bytes();
}

// ---------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------
const HEAD = { fontWeight: "bold", backgroundColor: "#E8ECF0", wrap: true, alignVertical: "top" } as const;
const head = (value: string, extra: Partial<Exclude<XCell, null | string | number | boolean | Date>> = {}): XCell => ({ value, ...HEAD, ...extra });
const text = (value: string | null | undefined): XCell => (value ? { value, wrap: true, alignVertical: "top" } : null);
/** Dată calendaristică (AAAA-LL-ZZ) ca celulă de tip dată. */
export const dateCell = (iso: string | null | undefined): XCell =>
  iso ? { value: new Date(`${iso.slice(0, 10)}T00:00:00Z`), type: Date, format: "dd.mm.yyyy", align: "left" } : null;

/** Raportul săptămânal al grupei, Excel cu foi separate. */
export async function buildWeeklyXlsx(report: WeeklyReport, ctx: AppContext): Promise<Buffer> {
  const t = getT().reports;
  const w = t.week;

  const availability: SheetData = [
    [w.cols.nr, w.cols.player, t.list.cols.fullName, w.cols.status, w.cols.availability, w.cols.zone, w.cols.returnOn, w.cols.restrictions, w.cols.note].map((h) => head(h)),
    ...report.players.map((x, i): XCell[] => [
      i + 1, { value: x.player.display_name, fontWeight: "bold" }, x.player.full_name, x.status?.label ?? null, AVAILABILITY_LABELS[x.availability],
      text(zoneOf(x.player)), dateCell(x.player.status_return_on), text(x.player.training_restrictions), text(x.player.status_note),
    ]),
  ];

  const wellness: SheetData = [
    [
      head(w.cols.player),
      ...report.dates.flatMap((date, i): XCell[] => [head(`${WEEKDAYS_RO[i]}, ${formatDateShort(date, false)}`, { columnSpan: 3, align: "center" }), null, null]),
      head(w.daysDone),
    ],
    [head(""), ...report.dates.flatMap((): XCell[] => [head(w.fatigue), head(w.load), head(w.painZone)]), head("")],
    ...report.players.map((x): XCell[] => [
      { value: x.player.display_name, fontWeight: "bold" },
      ...x.days.flatMap((e): XCell[] => e
        ? [e.fatigue, e.muscle_load, text([zoneLabel(e.pain_zone, e.pain_side, true), e.pain_intensity ? `(${e.pain_intensity})` : "", e.pain_note ?? ""].filter(Boolean).join(" "))]
        : [null, null, null]),
      x.daysDone,
    ]),
  ];

  const injuryRow = (i: WeeklyInjury, kind: string): XCell[] => [
    kind, { value: i.playerName, fontWeight: "bold" }, dateCell(i.occurred_on), text(injuryZoneText(i)), i.injury_type ? label(INJURY_TYPES, i.injury_type) : null,
    text(i.diagnosis), i.severity && i.severity !== "unknown" ? label(INJURY_SEVERITY, i.severity) : null,
    dateCell(i.expected_return_on), dateCell(i.actual_return_on), daysLost(i, ctx.today),
  ];
  const c = w.injuryCols;
  const injuries: SheetData = [
    [c.kind, c.player, c.date, w.cols.zone, c.type, c.diagnosis, c.severity, c.expected, c.returned, c.days].map((h) => head(h)),
    ...report.newInjuries.map((i) => injuryRow(i, w.newInjuries)),
    ...report.returns.map((i) => injuryRow(i, w.returns)),
  ];

  const a = w.adherenceCols;
  const adherence: SheetData = [
    [a.player, a.programs, a.done, a.expected, `${a.percent} (%)`].map((h) => head(h)),
    ...report.players.filter((x) => x.adherence).map((x): XCell[] => [
      { value: x.player.display_name, fontWeight: "bold" }, text(x.adherence!.programs.join(", ")), x.adherence!.done, x.adherence!.expected, x.adherence!.percent,
    ]),
  ];

  const widths = (...n: number[]) => n.map((width) => ({ width }));
  return writeExcelFile([
    { data: availability, sheet: w.sheets.availability, stickyRowsCount: 1, columns: widths(5, 22, 28, 22, 18, 30, 12, 30, 40) },
    {
      data: wellness, sheet: w.sheets.wellness, stickyRowsCount: 2, stickyColumnsCount: 1,
      columns: [{ width: 22 }, ...report.dates.flatMap(() => widths(9, 11, 18)), { width: 6 }],
    },
    { data: injuries, sheet: w.sheets.injuries, stickyRowsCount: 1, columns: widths(18, 22, 12, 30, 18, 40, 22, 16, 12, 12) },
    { data: adherence, sheet: w.sheets.adherence, stickyRowsCount: 1, columns: widths(22, 50, 14, 18, 14) },
  ]).toBuffer();
}
