import "server-only";
import {
  ageOn, AVAILABILITY_LABELS, describeZone, FEET, formatDate, formatDateShort, formatDateTime, INJURY_CONTACT, INJURY_CONTEXT,
  INJURY_SEVERITY, INJURY_TYPES, isoWeekday, label, POSITIONS, RTP_STAGES, todayIn, WEEKDAYS_SHORT_RO, average,
  type AppContext, type StatusTone,
} from "@club/shared";
import { TONE_HEX } from "@/components/ui/status";
import { availabilityOf, daysLost, injuryZoneText } from "@/components/players/domain";
import { getT } from "@/messages";
import { Report, type Cell } from "./pdf";
import { STATUS_HISTORY_LIMIT, type PlayerSheet } from "./data";

const num = (v: number | string | null | undefined, digits = 1) =>
  v === null || v === undefined || v === "" ? "—" : Number(v).toLocaleString("ro-RO", { maximumFractionDigits: digits });

/** Fișa jucătorului, PDF A4 pe verticală. */
export async function buildPlayerSheetPdf(sheet: PlayerSheet, ctx: AppContext): Promise<Uint8Array> {
  const t = getT().reports;
  const s = t.sheet;
  const d = t.doc;
  const { player: p } = sheet;
  const tz = ctx.settings.timezone;
  const statusById = new Map(ctx.statuses.map((x) => [x.id, x]));
  const dot = (tone: string | undefined) => TONE_HEX[(tone as StatusTone) ?? "gray"] ?? TONE_HEX.gray;

  const r = await Report.create({
    club: ctx.club.name,
    title: s.title(p.display_name),
    subtitle: [p.full_name !== p.display_name ? p.full_name : null, sheet.group?.name].filter(Boolean).join(" · ") || undefined,
    generated: d.generated(formatDateTime(new Date().toISOString(), tz)),
    footer: d.footer,
    pageLabel: d.page,
  });

  // ---- date ----
  const age = ageOn(p.birth_date, ctx.today);
  const visaExpired = !!p.medical_visa_expires_on && p.medical_visa_expires_on < ctx.today;
  r.heading(s.sections.identity);
  r.keyValues([
    [s.fields.fullName, p.full_name],
    [s.fields.displayName, p.display_name],
    [s.fields.birthDate, p.birth_date ? formatDate(p.birth_date) : null],
    [s.fields.age, age === null ? null : d.years(age)],
    [s.fields.group, sheet.group?.name ?? null],
    [s.fields.number, p.shirt_number],
    [s.fields.position, [p.position ? label(POSITIONS, p.position) : null, p.position_detail].filter(Boolean).join(", ") || null],
    [s.fields.foot, p.dominant_foot ? label(FEET, p.dominant_foot) : null],
    [s.fields.visa, p.medical_visa_expires_on ? `${formatDate(p.medical_visa_expires_on)}${visaExpired ? ` (${s.fields.visaExpired})` : ""}` : null],
    [s.fields.active, p.is_active ? d.yes : s.fields.inactive],
  ]);

  // ---- stare curentă ----
  r.heading(s.sections.status);
  r.keyValues([
    [s.fields.status, sheet.status ? sheet.status.label : null],
    [s.fields.availability, AVAILABILITY_LABELS[availabilityOf(sheet.status)]],
    [s.fields.zone, describeZone({ zone: p.status_zone, side: p.status_side, detail: p.status_zone_detail, uncertain: p.status_zone_uncertain }) || null],
    [s.fields.returnOn, p.status_return_on ? formatDate(p.status_return_on) : null],
    [s.fields.updated, p.status_updated_at ? formatDateTime(p.status_updated_at, tz) : null],
    [s.fields.restrictions, p.training_restrictions],
  ]);
  if (p.status_note) r.keyValues([[s.fields.note, p.status_note]], 1);

  // ---- accidentări ----
  r.heading(s.sections.injuries);
  if (sheet.injuries.length) {
    const total = sheet.injuries.reduce((sum, i) => sum + daysLost(i, ctx.today), 0);
    r.paragraph(s.injuries.summary(sheet.injuries.length, total, sheet.injuries.filter((i) => !i.actual_return_on).length), { muted: true });
    r.space(4);
  }
  r.table(
    [
      { header: s.injuries.cols.date, width: 12 },
      { header: s.injuries.cols.zone, width: 24 },
      { header: s.injuries.cols.diagnosis, width: 36 },
      { header: s.injuries.cols.returned, width: 16 },
      { header: s.injuries.cols.days, width: 10, align: "right" },
    ],
    sheet.injuries.map((i): Cell[] => {
      const mechanism = [i.contact && i.contact !== "unknown" ? label(INJURY_CONTACT, i.contact) : null, i.context && i.context !== "unknown" ? label(INJURY_CONTEXT, i.context) : null]
        .filter(Boolean).join(", ").toLowerCase();
      const zone = [
        injuryZoneText(i) || d.none,
        [i.injury_type ? label(INJURY_TYPES, i.injury_type) : null, i.severity && i.severity !== "unknown" ? label(INJURY_SEVERITY, i.severity) : null].filter(Boolean).join(" · "),
        mechanism ? `${s.injuries.mechanism}: ${mechanism}` : null,
        i.recurrence_of ? s.injuries.recurrence : null,
      ].filter(Boolean).join("\n");
      const diagnosis = [
        i.diagnosis,
        i.notes,
        i.injury_treatments.length
          ? `${s.injuries.treatments}:\n${[...i.injury_treatments].reverse().map((tr) => `${formatDateShort(tr.treated_on)} · ${tr.description}`).join("\n")}`
          : null,
      ].filter(Boolean).join("\n") || d.none;
      const returned = i.actual_return_on
        ? formatDateShort(i.actual_return_on)
        : [d.ongoing, i.expected_return_on ? s.injuries.expected(formatDateShort(i.expected_return_on)) : null, s.injuries.stage(RTP_STAGES[i.rtp_stage] ?? String(i.rtp_stage))]
            .filter(Boolean).join("\n");
      return [{ text: formatDateShort(i.occurred_on), bold: true }, zone, diagnosis, returned, { text: daysLost(i, ctx.today), bold: true }];
    }),
    { empty: s.injuries.empty },
  );

  // ---- istoricul stărilor ----
  r.heading(s.sections.statusHistory);
  r.table(
    [
      { header: s.statusHistory.cols.date, width: 13 },
      { header: s.statusHistory.cols.status, width: 22 },
      { header: s.statusHistory.cols.zone, width: 22 },
      { header: s.statusHistory.cols.note, width: 30 },
      { header: s.statusHistory.cols.returnOn, width: 13 },
    ],
    sheet.statusHistory.map((h): Cell[] => {
      const st = h.status_id ? statusById.get(h.status_id) : undefined;
      return [
        formatDateShort(todayIn(tz, new Date(h.created_at))),
        { text: st?.label ?? d.none, bold: true, dot: dot(st?.tone) },
        describeZone({ zone: h.zone, side: h.side, detail: h.zone_detail, uncertain: h.zone_uncertain }, true),
        h.note,
        h.return_on ? formatDateShort(h.return_on) : "",
      ];
    }),
    { empty: s.statusHistory.empty },
  );
  if (sheet.statusHistory.length >= STATUS_HISTORY_LIMIT) r.paragraph(s.statusHistory.limited(STATUS_HISTORY_LIMIT), { muted: true, size: 8.5 });

  // ---- chestionare ----
  r.heading(s.sections.wellness, 150);
  if (sheet.wellness.length) {
    r.paragraph(
      s.wellness.summary(sheet.wellness.length, num(average(sheet.wellness.map((w) => w.fatigue))), num(average(sheet.wellness.map((w) => w.muscle_load)))),
      { muted: true },
    );
    r.space(4);
  }
  r.table(
    [
      { header: s.wellness.cols.date, width: 16 },
      { header: s.wellness.cols.fatigue, width: 11, align: "center" },
      { header: s.wellness.cols.load, width: 14, align: "center" },
      { header: s.wellness.cols.pain, width: 22 },
      { header: s.wellness.cols.intensity, width: 11, align: "center" },
      { header: s.wellness.cols.note, width: 26 },
    ],
    sheet.wellness.map((w): Cell[] => {
      const wd = WEEKDAYS_SHORT_RO[isoWeekday(w.entry_date) - 1];
      return [
        `${wd}, ${formatDateShort(w.entry_date)}`,
        { text: w.fatigue ?? d.none, bold: (w.fatigue ?? 0) >= ctx.settings.alerts.fatigue_threshold },
        { text: w.muscle_load ?? d.none, bold: (w.muscle_load ?? 0) >= ctx.settings.alerts.muscle_load_threshold },
        describeZone({ zone: w.pain_zone, side: w.pain_side }, true),
        w.pain_intensity ?? "",
        w.pain_note,
      ];
    }),
    { empty: s.wellness.empty },
  );

  // ---- teste ----
  r.heading(s.sections.tests);
  r.table(
    [
      { header: s.tests.cols.test, width: 34 },
      { header: s.tests.cols.date, width: 16 },
      { header: s.tests.cols.value, width: 16, align: "right" },
      { header: s.tests.cols.average, width: 16, align: "right" },
      { header: s.tests.cols.best, width: 18, align: "right" },
    ],
    sheet.tests.map((x): Cell[] => [
      x.name, formatDateShort(x.testedOn), { text: `${num(x.value, 2)} ${x.unit}`, bold: true },
      x.average === null ? d.none : `${num(x.average, 2)} ${x.unit}`,
      x.best === null ? d.none : `${num(x.best, 2)} ${x.unit}`,
    ]),
    { empty: s.tests.empty },
  );

  // ---- antropometrie ----
  r.heading(s.sections.anthropometrics);
  r.table(
    [
      { header: s.anthropometrics.cols.date, width: 15 },
      { header: s.anthropometrics.cols.height, width: 14, align: "right" },
      { header: s.anthropometrics.cols.weight, width: 14, align: "right" },
      { header: s.anthropometrics.cols.fat, width: 13, align: "right" },
      { header: s.anthropometrics.cols.muscle, width: 16, align: "right" },
      { header: s.anthropometrics.cols.notes, width: 28 },
    ],
    sheet.anthropometrics.map((a): Cell[] => [
      formatDateShort(a.measured_on), num(a.height_cm), num(a.weight_kg), num(a.body_fat_pct), num(a.muscle_mass_kg), a.notes,
    ]),
    { empty: s.anthropometrics.empty },
  );

  // ---- programe ----
  r.heading(s.sections.programs);
  r.table(
    [
      { header: s.programs.cols.program, width: 30 },
      { header: s.programs.cols.period, width: 24 },
      { header: s.programs.cols.days, width: 14 },
      { header: s.programs.cols.state, width: 14 },
      { header: s.programs.cols.adherence, width: 18, align: "right" },
    ],
    sheet.programs.map(({ assignment: a, adherence, state }): Cell[] => [
      { text: a.program.name, bold: true },
      `${formatDateShort(a.start_date)} – ${a.end_date ? formatDateShort(a.end_date) : s.programs.openEnded}`,
      [...a.weekdays].sort((x, y) => x - y).map((w) => WEEKDAYS_SHORT_RO[w - 1]).join(", "),
      s.programs.state[state],
      adherence.percent === null ? d.none : `${adherence.percent}%\n${s.programs.done(adherence.done, adherence.expected)}`,
    ]),
    { empty: s.programs.empty },
  );

  return r.bytes();
}
