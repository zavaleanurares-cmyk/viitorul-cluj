import "server-only";
import writeExcelFile from "write-excel-file/node";
import type { Cell as XCell, SheetData } from "write-excel-file/node";
import { AVAILABILITY_LABELS, describeZone, label, POSITIONS, todayIn, type AppContext, type PlayerListItem } from "@club/shared";
import { availabilityOf } from "@/components/players/domain";
import { getT } from "@/messages";
import { dateCell } from "./weekly";

/** Lista jucătorilor activi cu starea curentă, Excel cu o singură foaie. */
export async function buildRosterXlsx(players: PlayerListItem[], ctx: AppContext): Promise<Buffer> {
  const t = getT().reports;
  const c = t.list.cols;
  const groupName = new Map(ctx.groups.map((g) => [g.id, g.name]));
  const groupSort = new Map(ctx.groups.map((g, i) => [g.id, i]));
  const statusById = new Map(ctx.statuses.map((s) => [s.id, s]));
  const sorted = [...players].sort(
    (a, b) =>
      (groupSort.get(a.group_id ?? "") ?? 999) - (groupSort.get(b.group_id ?? "") ?? 999) ||
      a.display_name.localeCompare(b.display_name, "ro"),
  );
  const wrap = (value: string | null | undefined): XCell => (value ? { value, wrap: true, alignVertical: "top" } : null);

  const data: SheetData = [
    [c.group, c.number, c.displayName, c.fullName, c.birthDate, c.position, c.status, c.availability, c.zone, c.note, c.returnOn, c.restrictions, c.visa, c.updated, c.review]
      .map((value): XCell => ({ value, fontWeight: "bold", backgroundColor: "#E8ECF0", wrap: true, alignVertical: "top" })),
    ...sorted.map((p): XCell[] => {
      const status = p.status_id ? statusById.get(p.status_id) : undefined;
      return [
        p.group_id ? groupName.get(p.group_id) ?? null : null,
        p.shirt_number,
        { value: p.display_name, fontWeight: "bold" },
        p.full_name,
        dateCell(p.birth_date),
        p.position ? label(POSITIONS, p.position) : null,
        status?.label ?? null,
        AVAILABILITY_LABELS[availabilityOf(status)],
        wrap(describeZone({ zone: p.status_zone, side: p.status_side, detail: p.status_zone_detail, uncertain: p.status_zone_uncertain })),
        wrap(p.status_note),
        dateCell(p.status_return_on),
        wrap(p.training_restrictions),
        dateCell(p.medical_visa_expires_on),
        dateCell(p.status_updated_at ? todayIn(ctx.settings.timezone, new Date(p.status_updated_at)) : null),
        p.needs_review ? t.doc.yes : null,
      ];
    }),
  ];

  return writeExcelFile(data, {
    sheet: t.list.sheet,
    stickyRowsCount: 1,
    columns: [12, 6, 22, 30, 13, 12, 24, 18, 30, 40, 13, 30, 13, 13, 10].map((width) => ({ width })),
  }).toBuffer();
}
